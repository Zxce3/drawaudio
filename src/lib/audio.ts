import { base } from '$app/paths';
import { getRowPitch } from './scales';
import type { Effects, ImpulseType, Song, SoundParams, Track } from './types';

interface Channel {
  input: GainNode;
  panner: StereoPannerNode;
  send: GainNode;
}

/**
 * Multi-track step sequencer + synth built on the Web Audio API.
 *
 * Signal flow:
 *   voice -> track input (volume) -> panner -> bus
 *                                 \-> reverb send -> convolver -> reverb mix \
 *   bus -> distortion -> EQ -> chorus -> master -> compressor -> out         |
 *   bus -> delay (feedback loop) -> delay mix -----------------------------> compressor
 *
 * The song object is read directly (it is the app's reactive state), so edits
 * made while playing are picked up on the next scheduled step.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private worker: Worker | null = null;
  private channels = new Map<string, Channel>();
  private impulses = new Map<ImpulseType, AudioBuffer>();
  private pulseWaves = new Map<number, PeriodicWave>();
  private noiseBuffer: AudioBuffer | null = null;
  private initPromise: Promise<void> | null = null;

  private bus!: GainNode;
  private distortion!: WaveShaperNode;
  private eqLow!: BiquadFilterNode;
  private eqMid!: BiquadFilterNode;
  private eqHigh!: BiquadFilterNode;
  private delay!: DelayNode;
  private delayFeedback!: GainNode;
  private delayMix!: GainNode;
  private convolver!: ConvolverNode;
  private reverbMix!: GainNode;
  private chorusDelay!: DelayNode;
  private chorusMix!: GainNode;
  private chorusDry!: GainNode;
  private master!: GainNode;
  private compressor!: DynamicsCompressorNode;
  private analyser!: AnalyserNode;
  private meterData = new Uint8Array(0);

  // Sequencer state
  private playing = false;
  private nextStep = 0;
  private nextTime = 0;
  private reverse = false;
  private queue: { step: number; time: number }[] = [];
  private raf = 0;
  private stepListeners = new Set<(step: number, time: number) => void>();
  private startTime = 0;

  constructor(private song: Song) {}

  setSong(song: Song) {
    this.song = song;
  }

  get initialized(): boolean {
    return this.ctx !== null && this.impulses.size > 0;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  /** Seconds since playback started (audio clock) */
  get elapsed(): number {
    return this.playing && this.ctx ? Math.max(0, this.ctx.currentTime - this.startTime) : 0;
  }

  /** Create the audio graph. Must be called from a user gesture. */
  initialize(): Promise<void> {
    this.initPromise ??= this.setup().catch((error) => {
      this.initPromise = null;
      throw error;
    });
    return this.initPromise;
  }

  private async setup() {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;

    this.bus = ctx.createGain();
    this.distortion = ctx.createWaveShaper();
    this.distortion.oversample = '4x';
    this.eqLow = ctx.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 200;
    this.eqMid = ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1200;
    this.eqMid.Q.value = 0.8;
    this.eqHigh = ctx.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.value = 4500;

    // Chorus: short modulated delay mixed with the dry signal
    this.chorusDelay = ctx.createDelay(0.1);
    this.chorusDelay.delayTime.value = 0.025;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.6;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.006;
    lfo.connect(lfoDepth).connect(this.chorusDelay.delayTime);
    lfo.start();
    this.chorusMix = ctx.createGain();
    this.chorusDry = ctx.createGain();

    this.master = ctx.createGain();
    this.compressor = ctx.createDynamicsCompressor();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.meterData = new Uint8Array(this.analyser.fftSize);

    this.delay = ctx.createDelay(2);
    this.delayFeedback = ctx.createGain();
    this.delayMix = ctx.createGain();
    this.convolver = ctx.createConvolver();
    this.reverbMix = ctx.createGain();

    this.bus.connect(this.distortion);
    this.distortion.connect(this.eqLow).connect(this.eqMid).connect(this.eqHigh);
    this.eqHigh.connect(this.chorusDry).connect(this.master);
    this.eqHigh.connect(this.chorusDelay).connect(this.chorusMix).connect(this.master);
    this.master.connect(this.compressor);
    this.bus.connect(this.delay);
    this.delay.connect(this.delayFeedback).connect(this.delay);
    this.delay.connect(this.delayMix).connect(this.compressor);
    this.convolver.connect(this.reverbMix).connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.compressor.connect(ctx.destination);

    this.noiseBuffer = this.makeNoise(ctx);
    await this.loadImpulses();
    this.applyEffects();
    this.syncTracks();

    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = () => this.schedule();
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private async loadImpulses() {
    const ctx = this.ctx!;
    const files: Record<ImpulseType, string> = {
      reverb: 'plate-reverb',
      guitar: 'guitar-cab',
      drum: 'drum-room'
    };
    try {
      for (const [type, file] of Object.entries(files) as [ImpulseType, string][]) {
        const response = await fetch(`${base}/impulse-${file}.wav`);
        if (!response.ok) throw new Error(`Impulse response ${file} not found`);
        this.impulses.set(type, await ctx.decodeAudioData(await response.arrayBuffer()));
      }
    } catch (error) {
      console.warn('Using synthetic impulse response:', error);
      const length = 2 * ctx.sampleRate;
      const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp((-4 * i) / ctx.sampleRate);
      }
      for (const type of Object.keys(files) as ImpulseType[]) this.impulses.set(type, buffer);
    }
  }

  // ---------------------------------------------------------------- mixing

  /** Push mixer + effect settings from the song into the audio graph */
  syncTracks() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const tracks = this.song.tracks;
    const anySolo = tracks.some((t) => t.solo);
    const ids = new Set(tracks.map((t) => t.id));

    for (const [id, channel] of this.channels) {
      if (!ids.has(id)) {
        channel.input.disconnect();
        channel.panner.disconnect();
        channel.send.disconnect();
        this.channels.delete(id);
      }
    }
    for (const track of tracks) {
      let channel = this.channels.get(track.id);
      if (!channel) {
        channel = {
          input: ctx.createGain(),
          panner: ctx.createStereoPanner(),
          send: ctx.createGain()
        };
        channel.input.connect(channel.panner);
        channel.panner.connect(this.bus);
        channel.panner.connect(channel.send).connect(this.convolver);
        this.channels.set(track.id, channel);
      }
      const audible = !track.mute && (!anySolo || track.solo);
      const t = ctx.currentTime;
      channel.input.gain.setTargetAtTime(audible ? track.volume : 0, t, 0.02);
      channel.panner.pan.setTargetAtTime(track.pan, t, 0.02);
      channel.send.gain.setTargetAtTime(track.reverbSend, t, 0.02);
    }
  }

  applyEffects() {
    if (!this.ctx) return;
    const e: Effects = this.song.effects;
    const t = this.ctx.currentTime;
    this.delay.delayTime.setTargetAtTime(Math.max(e.delayTime, 0.01), t, 0.05);
    this.delayFeedback.gain.setTargetAtTime(Math.min(e.delayFeedback, 0.9), t, 0.05);
    this.delayMix.gain.setTargetAtTime(e.delayMix, t, 0.05);
    this.reverbMix.gain.setTargetAtTime(e.reverbMix, t, 0.05);
    this.chorusMix.gain.setTargetAtTime(e.chorus * 0.7, t, 0.05);
    this.chorusDry.gain.setTargetAtTime(1 - e.chorus * 0.3, t, 0.05);
    this.eqLow.gain.setTargetAtTime(e.eqLow, t, 0.05);
    this.eqMid.gain.setTargetAtTime(e.eqMid, t, 0.05);
    this.eqHigh.gain.setTargetAtTime(e.eqHigh, t, 0.05);
    this.distortion.curve = this.distortionCurve(e.distortion);
    const impulse = this.impulses.get(e.impulse);
    if (impulse && this.convolver.buffer !== impulse) this.convolver.buffer = impulse;
  }

  private distortionCurve(amount: number): Float32Array<ArrayBuffer> | null {
    if (amount <= 0) return null;
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  /** Master output level, 0 - 1 */
  getLevel(): number {
    if (!this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.meterData as Uint8Array<ArrayBuffer>);
    let peak = 0;
    for (const v of this.meterData) peak = Math.max(peak, Math.abs(v - 128));
    return Math.min(1, peak / 128);
  }

  // ------------------------------------------------------------- sequencer

  onStep(listener: (step: number, time: number) => void): () => void {
    this.stepListeners.add(listener);
    return () => this.stepListeners.delete(listener);
  }

  async start() {
    await this.initialize();
    const ctx = this.ctx!;
    await ctx.resume();
    this.stop();
    this.playing = true;
    this.nextStep = this.song.pattern === 'backward' ? this.song.gridSize - 1 : 0;
    this.reverse = false;
    this.nextTime = ctx.currentTime + 0.06;
    this.startTime = this.nextTime;
    this.queue = [];
    this.worker?.postMessage({ type: 'start', interval: 25 });
    this.schedule();
    this.raf = requestAnimationFrame(this.pump);
  }

  stop() {
    this.playing = false;
    this.worker?.postMessage({ type: 'stop' });
    cancelAnimationFrame(this.raf);
    this.queue = [];
  }

  /** Look-ahead scheduler: queue every step that starts in the next 120ms */
  private schedule() {
    if (!this.playing || !this.ctx) return;
    const stepDuration = 60 / this.song.tempo / 4; // sixteenth notes
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.playColumn(this.nextStep, this.nextTime, stepDuration);
      this.queue.push({ step: this.nextStep, time: this.nextTime });
      this.nextStep = this.advance(this.nextStep);
      this.nextTime += stepDuration;
    }
  }

  /** Tell the UI about a step when its audio time arrives */
  private pump = () => {
    if (!this.playing || !this.ctx) return;
    while (this.queue.length && this.queue[0].time <= this.ctx.currentTime) {
      const { step, time } = this.queue.shift()!;
      this.stepListeners.forEach((listener) => listener(step, time));
    }
    this.raf = requestAnimationFrame(this.pump);
  };

  private advance(step: number): number {
    const size = this.song.gridSize;
    switch (this.song.pattern) {
      case 'backward':
        return (step - 1 + size) % size;
      case 'random':
        return Math.floor(Math.random() * size);
      case 'bounce':
        if (size < 2) return 0;
        if (this.reverse) {
          if (step <= 0) {
            this.reverse = false;
            return 1;
          }
          return step - 1;
        }
        if (step >= size - 1) {
          this.reverse = true;
          return step - 1;
        }
        return step + 1;
      default:
        return (step + 1) % size;
    }
  }

  private playColumn(col: number, time: number, stepDuration: number) {
    const anySolo = this.song.tracks.some((t) => t.solo);
    for (const track of this.song.tracks) {
      if (track.mute || (anySolo && !track.solo)) continue;
      const channel = this.channels.get(track.id);
      if (!channel) continue;
      for (let row = 0; row < this.song.gridSize; row++) {
        if (track.matrix[row]?.[col]) {
          this.playNote(track, row, time, stepDuration * track.params.gate, channel);
        }
      }
    }
  }

  // ----------------------------------------------------------------- voices

  /** Audition a single cell (used while drawing) */
  preview(track: Track, row: number) {
    const channel = this.channels.get(track.id);
    if (!this.ctx || !channel) return;
    this.playNote(track, row, this.ctx.currentTime, 0.2, channel);
  }

  private pulseWave(width: number): PeriodicWave {
    const key = Math.round(width * 100);
    let wave = this.pulseWaves.get(key);
    if (!wave) {
      const harmonics = 64;
      const real = new Float32Array(harmonics);
      const imag = new Float32Array(harmonics);
      for (let n = 1; n < harmonics; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * (key / 100));
      wave = this.ctx!.createPeriodicWave(real, imag);
      this.pulseWaves.set(key, wave);
    }
    return wave;
  }

  private setWave(osc: OscillatorNode, p: SoundParams) {
    if (p.waveform === 'pulse') osc.setPeriodicWave(this.pulseWave(p.pulseWidth));
    else osc.type = p.waveform;
  }

  private playNote(track: Track, row: number, time: number, hold: number, channel: Channel) {
    const ctx = this.ctx!;
    const p = track.params;
    const freq = getRowPitch(this.song.scale, this.song.gridSize, row).frequency;
    const peak = 0.35 / Math.sqrt(p.unison);
    const sustainLevel = Math.max(p.sustain, 0.0001) * peak;
    const noteOff = time + Math.max(hold, p.attack + 0.02);
    const end = noteOff + p.release;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(p.cutoff, ctx.sampleRate / 2 - 100);
    filter.Q.value = p.resonance;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(peak, time + p.attack);
    env.gain.linearRampToValueAtTime(sustainLevel, time + p.attack + p.decay);
    env.gain.setValueAtTime(sustainLevel, Math.max(noteOff, time + p.attack + p.decay));
    env.gain.linearRampToValueAtTime(0, end);
    filter.connect(env).connect(channel.input);

    const sources: AudioScheduledSourceNode[] = [];
    const oscillator = (f: number, detune = 0) => {
      const osc = ctx.createOscillator();
      this.setWave(osc, p);
      osc.frequency.value = f;
      osc.detune.value = detune;
      osc.connect(filter);
      sources.push(osc);
      return osc;
    };

    for (let i = 0; i < p.unison; i++) {
      const spread = p.unison === 1 ? 0 : (i / (p.unison - 1) - 0.5) * 2 * p.detune;
      const osc = oscillator(freq, spread);
      if (p.fmAmount > 0) {
        const mod = ctx.createOscillator();
        const depth = ctx.createGain();
        mod.frequency.value = freq * 2;
        depth.gain.value = p.fmAmount * freq * 1.5;
        depth.gain.setValueAtTime(p.fmAmount * freq * 1.5, time);
        depth.gain.exponentialRampToValueAtTime(Math.max(p.fmAmount * freq * 0.1, 0.01), time + p.attack + p.decay + 0.3);
        mod.connect(depth).connect(osc.frequency);
        sources.push(mod);
      }
    }
    if (p.subLevel > 0) {
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = freq / 2;
      const subGain = ctx.createGain();
      subGain.gain.value = p.subLevel;
      sub.connect(subGain).connect(filter);
      sources.push(sub);
    }
    if (p.noiseLevel > 0 && this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      noise.loop = true;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = p.noiseLevel;
      noise.connect(noiseGain).connect(filter);
      sources.push(noise);
    }

    sources.forEach((s) => {
      s.start(time);
      s.stop(end + 0.05);
    });
    sources[0].onended = () => {
      sources.forEach((s) => s.disconnect());
      filter.disconnect();
      env.disconnect();
    };
  }

  dispose() {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
    this.ctx?.close();
    this.ctx = null;
    this.initPromise = null;
    this.channels.clear();
  }
}
