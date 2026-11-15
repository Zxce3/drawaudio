import { base } from '$app/paths';
import { getRowPitch } from './scales';
import { GRAIN_WORKLET_NAME, GRAIN_WORKLET_SOURCE } from './grain-worklet';
import { wavetableHarmonics } from './wavetables';
import type { ChordType, DelayDivision, Effects, ImpulseType, Song, SoundParams, Track } from './types';

const DIVISION_BEATS: Record<DelayDivision, number> = { '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/8d': 0.75 };

/** Scale-degree offsets above the played note, like stacked thirds */
const CHORD_DEGREES: Record<ChordType, number[]> = {
  triad: [0, 2, 4],
  '7th': [0, 2, 4, 6],
  '9th': [0, 2, 4, 6, 8],
  add9: [0, 2, 4, 8],
  sus2: [0, 1, 4],
  sus4: [0, 3, 4],
  power: [0, 4],
  octave: [0, 7]
};

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
  private delayIn!: GainNode;
  private delayNodes!: { l: DelayNode; r: DelayNode };
  private delayGains!: Record<'inL' | 'inR' | 'llFb' | 'rrFb' | 'lrFb' | 'rlFb', GainNode>;
  private delayPans!: { l: StereoPannerNode; r: StereoPannerNode };
  private delayMix!: GainNode;
  private spreadDelay!: DelayNode;
  private spreadGain!: GainNode;
  private spreadPan!: StereoPannerNode;
  private ringGain!: GainNode;
  private ringOsc!: OscillatorNode;
  private ringMix!: GainNode;
  private ringDry!: GainNode;
  private grain: AudioWorkletNode | null = null;
  private grainIn!: GainNode;
  private grainWet!: GainNode;
  private grainFeedback!: GainNode;
  private duck!: GainNode;
  private tapeDry!: GainNode;
  private tapeWet!: GainNode;
  private tapeDelay!: DelayNode;
  private tapeSat!: WaveShaperNode;
  private tapeTone!: BiquadFilterNode;
  private tapeLfo!: OscillatorNode;
  private wowDepth!: GainNode;
  private flutterDepth!: GainNode;
  private hissGain!: GainNode;
  private crackleGain!: GainNode;
  private schedSteps = 0;
  private waveCache = new Map<string, PeriodicWave>();
  private reverbKey = '';
  private lastFreq = new Map<string, number>();
  private arpIndex = new Map<string, number>();
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

    this.convolver = ctx.createConvolver();
    this.reverbMix = ctx.createGain();

    // Delay: two taps with a feedback matrix, so one graph covers every mode
    this.delayIn = ctx.createGain();
    this.delayNodes = { l: ctx.createDelay(2), r: ctx.createDelay(2) };
    this.delayGains = {
      inL: ctx.createGain(), inR: ctx.createGain(),
      llFb: ctx.createGain(), rrFb: ctx.createGain(), lrFb: ctx.createGain(), rlFb: ctx.createGain()
    };
    this.delayPans = { l: ctx.createStereoPanner(), r: ctx.createStereoPanner() };
    this.delayMix = ctx.createGain();
    const { l, r } = this.delayNodes;
    const g = this.delayGains;
    this.delayIn.connect(g.inL).connect(l);
    this.delayIn.connect(g.inR).connect(r);
    l.connect(g.llFb).connect(l);
    r.connect(g.rrFb).connect(r);
    l.connect(g.lrFb).connect(r);
    r.connect(g.rlFb).connect(l);
    l.connect(this.delayPans.l).connect(this.delayMix);
    r.connect(this.delayPans.r).connect(this.delayMix);
    this.delayMix.connect(this.compressor);

    // Reverse / pitch-shift delay runs in an AudioWorklet (optional: falls back to mono)
    this.grainIn = ctx.createGain();
    this.grainIn.gain.value = 0;
    this.grainWet = ctx.createGain();
    this.grainFeedback = ctx.createGain();
    this.delayIn.connect(this.grainIn);

    // Stereo spread: a short delayed copy panned right
    this.spreadDelay = ctx.createDelay(0.1);
    this.spreadDelay.delayTime.value = 0.018;
    this.spreadGain = ctx.createGain();
    this.spreadPan = ctx.createStereoPanner();
    this.spreadPan.pan.value = 1;

    // Ring modulator
    this.ringGain = ctx.createGain();
    this.ringGain.gain.value = 0;
    this.ringOsc = ctx.createOscillator();
    this.ringOsc.connect(this.ringGain.gain);
    this.ringOsc.start();
    this.ringMix = ctx.createGain();
    this.ringDry = ctx.createGain();

    this.bus.connect(this.distortion);
    this.distortion.connect(this.eqLow).connect(this.eqMid).connect(this.eqHigh);
    this.eqHigh.connect(this.ringDry).connect(this.chorusDry).connect(this.master);
    this.eqHigh.connect(this.ringGain).connect(this.ringMix).connect(this.master);
    this.eqHigh.connect(this.chorusDelay).connect(this.chorusMix).connect(this.master);
    // Tape stage (wow/flutter, saturation, warmth), then sidechain ducking
    this.tapeDry = ctx.createGain();
    this.tapeWet = ctx.createGain();
    this.tapeWet.gain.value = 0;
    this.tapeDelay = ctx.createDelay(0.1);
    this.tapeDelay.delayTime.value = 0.012;
    this.tapeSat = ctx.createWaveShaper();
    this.tapeTone = ctx.createBiquadFilter();
    this.tapeTone.type = 'lowpass';
    this.tapeTone.frequency.value = 20000;
    this.wowDepth = ctx.createGain();
    this.flutterDepth = ctx.createGain();
    this.tapeLfo = ctx.createOscillator();
    this.tapeLfo.frequency.value = 0.8;
    const flutterLfo = ctx.createOscillator();
    flutterLfo.frequency.value = 7.3;
    this.tapeLfo.connect(this.wowDepth).connect(this.tapeDelay.delayTime);
    flutterLfo.connect(this.flutterDepth).connect(this.tapeDelay.delayTime);
    this.tapeLfo.start();
    flutterLfo.start();
    this.duck = ctx.createGain();
    const tapeOut = ctx.createGain();
    this.master.connect(this.tapeDry).connect(tapeOut);
    this.master.connect(this.tapeDelay).connect(this.tapeSat).connect(this.tapeTone).connect(this.tapeWet).connect(tapeOut);
    tapeOut.connect(this.duck);
    this.duck.connect(this.compressor);
    this.duck.connect(this.spreadDelay).connect(this.spreadGain).connect(this.spreadPan).connect(this.compressor);

    // Tape hiss and vinyl crackle are constant noise sources mixed in after the tape stage
    this.hissGain = ctx.createGain();
    this.hissGain.gain.value = 0;
    this.crackleGain = ctx.createGain();
    this.crackleGain.gain.value = 0;
    const hissSource = ctx.createBufferSource();
    hissSource.buffer = this.makeNoise(ctx);
    hissSource.loop = true;
    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'highpass';
    hissFilter.frequency.value = 3500;
    hissSource.connect(hissFilter).connect(this.hissGain).connect(this.compressor);
    hissSource.start();
    const crackleSource = ctx.createBufferSource();
    crackleSource.buffer = this.makeCrackle(ctx);
    crackleSource.loop = true;
    crackleSource.connect(this.crackleGain).connect(this.compressor);
    crackleSource.start();
    this.bus.connect(this.delayIn);
    this.convolver.connect(this.reverbMix).connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.compressor.connect(ctx.destination);

    this.noiseBuffer = this.makeNoise(ctx);
    await this.setupGrainDelay(ctx);
    await this.loadImpulses();
    this.applyEffects();
    this.syncTracks();

    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = () => this.schedule();
  }

  private async setupGrainDelay(ctx: AudioContext) {
    try {
      const url = URL.createObjectURL(new Blob([GRAIN_WORKLET_SOURCE], { type: 'text/javascript' }));
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      this.grain = new AudioWorkletNode(ctx, GRAIN_WORKLET_NAME, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
      const loop = ctx.createDelay(0.1); // feedback cycles need a DelayNode
      loop.delayTime.value = 0.01;
      this.grainIn.connect(this.grain);
      this.grain.connect(this.grainWet).connect(this.delayMix);
      this.grain.connect(this.grainFeedback).connect(loop).connect(this.grain);
    } catch (error) {
      console.warn('Reverse and pitch-shift delay are unavailable:', error);
      this.grain = null;
    }
  }

  private makeCrackle(ctx: AudioContext): AudioBuffer {
    const seconds = 6;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      if (Math.random() < 6 / ctx.sampleRate) {
        const amp = (Math.random() * 2 - 1) * (0.4 + Math.random() * 0.6);
        for (let k = 0; k < 24 && i + k < data.length; k++) data[i + k] += amp * Math.exp(-k / 5);
      }
    }
    return buffer;
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
    const set = (param: AudioParam, value: number) => param.setTargetAtTime(value, t, 0.05);

    // Delay
    const beat = 60 / this.song.tempo;
    let time = e.delaySync ? beat * DIVISION_BEATS[e.delayDivision] : e.delayTime;
    let feedback = Math.min(e.delayFeedback, 0.9);
    if (e.delayMode === 'slapback') {
      time = Math.min(time, 0.12);
      feedback = 0;
    }
    const mode = e.delayMode;
    const g = this.delayGains;
    set(g.inL.gain, 1);
    set(g.inR.gain, mode === 'stereo' ? 1 : 0);
    set(g.llFb.gain, mode === 'pingpong' ? 0 : feedback);
    set(g.rrFb.gain, mode === 'stereo' ? feedback : 0);
    set(g.lrFb.gain, mode === 'pingpong' ? feedback : 0);
    set(g.rlFb.gain, mode === 'pingpong' ? feedback : 0);
    set(this.delayNodes.l.delayTime, Math.min(Math.max(time, 0.01), 2));
    set(this.delayNodes.r.delayTime, Math.min(Math.max(mode === 'stereo' ? time * 1.33 : time, 0.01), 2));
    const width = mode === 'pingpong' ? 0.85 : mode === 'stereo' ? 0.7 : 0;
    set(this.delayPans.l.pan, -width);
    set(this.delayPans.r.pan, width);
    set(this.delayMix.gain, e.delayEnabled ? e.delayMix : 0);

    // Reverse / pitch shift use the worklet; the plain taps are muted for those modes
    const grainMode = (mode === 'reverse' || mode === 'pitch') && this.grain !== null;
    if (grainMode) {
      for (const key of ['inL', 'inR', 'llFb', 'rrFb', 'lrFb', 'rlFb'] as const) set(g[key].gain, 0);
    } else if (mode === 'reverse' || mode === 'pitch') {
      set(g.inL.gain, 1); // worklet unavailable: behave like mono
      set(g.llFb.gain, feedback);
    }
    set(this.grainIn.gain, grainMode ? 1 : 0);
    set(this.grainWet.gain, 1);
    set(this.grainFeedback.gain, grainMode ? feedback : 0);
    if (this.grain) {
      const params = this.grain.parameters;
      params.get('time')?.setValueAtTime(Math.min(Math.max(time, 0.05), 1.5), t);
      params.get('mode')?.setValueAtTime(mode === 'reverse' ? 0 : 1, t);
      params.get('rate')?.setValueAtTime(2 ** (e.delayPitch / 12), t);
    }

    // Tape, vinyl and sidechain
    const tape = e.tapeEnabled;
    const vinyl = e.vinylEnabled;
    const wet = tape || vinyl ? 1 : 0;
    set(this.tapeWet.gain, wet);
    set(this.tapeDry.gain, 1 - wet);
    set(this.wowDepth.gain, tape ? e.tapeWow * 0.0035 : 0);
    set(this.flutterDepth.gain, tape ? e.tapeWow * 0.0004 : 0);
    this.tapeSat.curve = this.saturationCurve(tape ? e.tapeSaturation : 0);
    set(this.tapeTone.frequency, vinyl ? 20000 - e.vinylWarmth * 16000 : 20000);
    set(this.hissGain.gain, tape ? e.tapeHiss * 0.025 : 0);
    set(this.crackleGain.gain, vinyl ? e.vinylCrackle * 0.35 : 0);
    if (!e.sidechainEnabled) this.duck.gain.setTargetAtTime(1, t, 0.02);

    // Reverb
    set(this.reverbMix.gain, e.reverbEnabled ? e.reverbMix : 0);
    this.updateReverbBuffer(e.impulse, e.reverbDecay);

    // Colour
    set(this.chorusMix.gain, e.chorusEnabled ? e.chorus * 0.7 : 0);
    set(this.chorusDry.gain, e.chorusEnabled ? 1 - e.chorus * 0.3 : 1);
    set(this.spreadGain.gain, e.spreadEnabled ? e.spread * 0.6 : 0);
    set(this.ringMix.gain, e.ringEnabled ? e.ringMix : 0);
    set(this.ringDry.gain, e.ringEnabled ? 1 - e.ringMix * 0.5 : 1);
    set(this.ringOsc.frequency, e.ringFreq);
    set(this.eqLow.gain, e.eqLow);
    set(this.eqMid.gain, e.eqMid);
    set(this.eqHigh.gain, e.eqHigh);
    this.distortion.curve = this.distortionCurve(e.distortionEnabled ? e.distortion : 0);
  }

  /** Decay shortens the impulse response with a fade-out so the tail ends smoothly */
  private updateReverbBuffer(type: ImpulseType, decay: number) {
    const key = `${type}:${decay.toFixed(2)}`;
    if (key === this.reverbKey) return;
    const source = this.impulses.get(type);
    if (!source || !this.ctx) return;
    this.reverbKey = key;
    if (decay >= 0.99) {
      this.convolver.buffer = source;
      return;
    }
    const length = Math.max(256, Math.floor(source.length * decay));
    const buffer = this.ctx.createBuffer(source.numberOfChannels, length, source.sampleRate);
    const fadeStart = Math.floor(length * 0.6);
    for (let c = 0; c < source.numberOfChannels; c++) {
      const from = source.getChannelData(c);
      const to = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) {
        to[i] = i < fadeStart ? from[i] : from[i] * (1 - (i - fadeStart) / (length - fadeStart));
      }
    }
    this.convolver.buffer = buffer;
  }

  private saturationCurve(amount: number): Float32Array<ArrayBuffer> | null {
    if (amount <= 0) return null;
    const n = 1024;
    const curve = new Float32Array(n);
    const drive = 1 + amount * 4;
    for (let i = 0; i < n; i++) curve[i] = Math.tanh(((i * 2) / n - 1) * drive) / Math.tanh(drive);
    return curve;
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
    this.schedSteps = 0;
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
      this.pumpSidechain(this.nextTime);
      this.playColumn(this.nextStep, this.nextTime, stepDuration);
      this.queue.push({ step: this.nextStep, time: this.nextTime });
      this.nextStep = this.advance(this.nextStep);
      this.nextTime += stepDuration;
    }
  }

  /** Duck the mix on each sidechain beat, like a kick-driven compressor */
  private pumpSidechain(time: number) {
    const e = this.song.effects;
    const index = this.schedSteps++;
    if (!e.sidechainEnabled) return;
    const every = { '1/4': 4, '1/8': 2, '1/16': 1, '1/8d': 3 }[e.sidechainDivision];
    if (index % every !== 0) return;
    const gain = this.duck.gain;
    gain.cancelScheduledValues(time);
    gain.setValueAtTime(1 - e.sidechainAmount, time);
    gain.linearRampToValueAtTime(1, time + Math.max(e.sidechainRelease, 0.03));
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
      case 'columns': {
        // Jump to the next column that has a note on any track
        for (let i = 1; i <= size; i++) {
          const col = (step + i) % size;
          if (this.song.tracks.some((t) => t.matrix.some((row) => row[col]))) return col;
        }
        return (step + 1) % size;
      }
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
    const song = this.song;
    const anySolo = song.tracks.some((t) => t.solo);
    // Swing delays every second step
    const swingOffset = col % 2 === 1 ? Math.min(0.75, (song.swing - 0.5) * 2) * stepDuration : 0;

    for (const track of song.tracks) {
      if (track.mute || (anySolo && !track.solo)) continue;
      const channel = this.channels.get(track.id);
      if (!channel) continue;
      const rows: number[] = [];
      for (let row = song.gridSize - 1; row >= 0; row--) if (track.matrix[row]?.[col]) rows.push(row);
      if (!rows.length) continue;

      const p = track.params;
      const freqs = this.expandChords(rows, p);
      const steps = [1, 2, 4, 8, 16][p.noteLength - 1] ?? 1;
      const start = time + swingOffset;

      if (p.arpMode !== 'off') {
        const sequence = this.arpSequence(freqs, p);
        const slots = Math.max(1, p.arpNotes);
        const slotDuration = stepDuration / slots;
        let index = p.arpRetrigger ? 0 : (this.arpIndex.get(track.id) ?? 0);
        for (let i = 0; i < slots; i++) {
          const hold = (p.arpFit ? slotDuration : stepDuration * steps) * p.gate;
          this.voice(track, channel, sequence[index % sequence.length], start + i * slotDuration, hold, stepDuration);
          index++;
        }
        this.arpIndex.set(track.id, index);
      } else {
        for (const freq of freqs) {
          const repeats = Math.max(1, p.ratchet);
          const sub = stepDuration / repeats;
          for (let i = 0; i < repeats; i++) {
            const hold = (repeats > 1 ? sub : stepDuration * steps) * p.gate;
            this.voice(track, channel, freq, start + i * sub, hold, stepDuration);
          }
        }
      }
    }
  }

  /** Apply timing/velocity humanize, then play */
  private voice(track: Track, channel: Channel, freq: number, time: number, hold: number, stepDuration: number) {
    const timing = this.song.humanizeTiming;
    const velocity = this.song.humanizeVelocity;
    const jitter = timing > 0 ? (Math.random() - 0.3) * timing * 0.4 * stepDuration : 0;
    const level = velocity > 0 ? 1 - Math.random() * velocity * 0.6 : 1;
    this.playNote(track, freq, Math.max(this.ctx!.currentTime, time + jitter), hold, channel, level);
  }

  private rowFrequency(row: number): number {
    const size = this.song.gridSize;
    if (row >= 0) return getRowPitch(this.song.scale, size, row).frequency;
    // Above the top of the grid: continue one octave higher
    return getRowPitch(this.song.scale, size, row + 7).frequency * 2;
  }

  /** Stack scale degrees on every drawn note (rows are scale degrees, row - 1 is one degree up) */
  private expandChords(rows: number[], p: SoundParams): number[] {
    if (!p.chordEnabled) return rows.map((row) => this.rowFrequency(row));
    const out = new Set<number>();
    for (const row of rows) {
      const freqs = CHORD_DEGREES[p.chordType].map((deg) =>
        p.chordType === 'power' && deg === 4 ? this.rowFrequency(row) * 1.498 : this.rowFrequency(row - deg)
      );
      freqs.sort((a, b) => a - b);
      for (let i = 0; i < Math.min(p.chordInversion, freqs.length - 1); i++) freqs[i] *= 2;
      freqs.forEach((f) => out.add(Math.round(f * 100) / 100));
    }
    return [...out].sort((a, b) => a - b);
  }

  private arpSequence(freqs: number[], p: SoundParams): number[] {
    const pool: number[] = [];
    for (let o = 0; o < p.arpOctaves; o++) for (const f of freqs) pool.push(f * 2 ** o);
    pool.sort((a, b) => a - b);
    switch (p.arpMode) {
      case 'down':
        return [...pool].reverse();
      case 'updown':
        return pool.length > 2 ? [...pool, ...pool.slice(1, -1).reverse()] : pool;
      case 'random':
        return Array.from({ length: Math.max(pool.length, 8) }, () => pool[Math.floor(Math.random() * pool.length)]);
      case 'pedal':
        return pool.flatMap((f) => [pool[0], f]);
      case 'converge': {
        const out: number[] = [];
        for (let i = 0, j = pool.length - 1; i <= j; i++, j--) out.push(pool[i], ...(i === j ? [] : [pool[j]]));
        return out;
      }
      case 'diverge': {
        const out: number[] = [];
        for (let i = 0, j = pool.length - 1; i <= j; i++, j--) out.push(pool[i], ...(i === j ? [] : [pool[j]]));
        return out.reverse();
      }
      default:
        return pool;
    }
  }

  // ----------------------------------------------------------------- voices

  /** Audition a single cell (used while drawing) */
  preview(track: Track, row: number) {
    const channel = this.channels.get(track.id);
    if (!this.ctx || !channel) return;
    this.playNote(track, this.rowFrequency(row), this.ctx.currentTime, 0.2, channel, 1);
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

  private tableWave(p: SoundParams): PeriodicWave {
    const key = `${p.wavetable}:${Math.round(p.wavetablePos * 20)}`;
    let wave = this.waveCache.get(key);
    if (!wave) {
      const imag = wavetableHarmonics(p.wavetable, Math.round(p.wavetablePos * 20) / 20);
      wave = this.ctx!.createPeriodicWave(new Float32Array(imag.length), imag);
      this.waveCache.set(key, wave);
    }
    return wave;
  }

  private setWave(osc: OscillatorNode, p: SoundParams) {
    if (p.waveform === 'pulse') osc.setPeriodicWave(this.pulseWave(p.pulseWidth));
    else if (p.waveform === 'wavetable') osc.setPeriodicWave(this.tableWave(p));
    else osc.type = p.waveform;
  }

  private playNote(track: Track, freq: number, time: number, hold: number, channel: Channel, level: number) {
    const ctx = this.ctx!;
    const p = track.params;
    const peak = (0.35 / Math.sqrt(p.unison)) * level;
    const sustainLevel = Math.max(p.sustain, 0.0001) * peak;
    const noteOff = time + Math.max(hold, p.attack + 0.02);
    const end = noteOff + p.release;

    // Filters: lowpass (optionally swept by an envelope) -> highpass
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const cutoff = p.lpEnabled ? Math.min(p.cutoff, ctx.sampleRate / 2 - 100) : ctx.sampleRate / 2 - 100;
    filter.Q.value = p.lpEnabled ? p.resonance : 0.7;
    if (p.lpEnabled && p.filterEnvEnabled) {
      const top = Math.min(cutoff * 2 ** (p.filterEnvAmount * 4), ctx.sampleRate / 2 - 100);
      filter.frequency.setValueAtTime(top, time);
      filter.frequency.exponentialRampToValueAtTime(cutoff, time + p.attack + Math.max(p.decay, 0.05) * 2);
    } else {
      filter.frequency.value = cutoff;
    }
    let tail: AudioNode = filter;
    let highpass: BiquadFilterNode | null = null;
    if (p.hpEnabled) {
      highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = p.hpCutoff;
      highpass.Q.value = p.hpResonance;
      filter.connect(highpass);
      tail = highpass;
    }

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(peak, time + p.attack);
    env.gain.linearRampToValueAtTime(sustainLevel, time + p.attack + p.decay);
    env.gain.setValueAtTime(sustainLevel, Math.max(noteOff, time + p.attack + p.decay));
    env.gain.linearRampToValueAtTime(0, end);
    tail.connect(env).connect(channel.input);

    // Glide slides in from the previous pitch of this track
    const previous = this.lastFreq.get(track.id);
    this.lastFreq.set(track.id, freq);
    const glideTime = p.glide * 0.25;
    const glideFrom = previous && glideTime > 0 ? previous : null;
    const pitch = (param: AudioParam, target: number) => {
      if (glideFrom) {
        param.setValueAtTime(glideFrom, time);
        param.linearRampToValueAtTime(target, time + glideTime);
      } else {
        param.value = target;
      }
    };

    const sources: AudioScheduledSourceNode[] = [];
    const oscillator = (f: number, detune = 0) => {
      const osc = ctx.createOscillator();
      this.setWave(osc, p);
      pitch(osc.frequency, f);
      if (p.pitchEnvEnabled) {
        osc.detune.setValueAtTime(detune + p.pitchEnvSemitones * 100, time);
        osc.detune.linearRampToValueAtTime(detune, time + Math.max(p.pitchEnvTime, 0.005));
      } else {
        osc.detune.value = detune;
      }
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
        mod.frequency.value = freq * p.fmRatio;
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
      pitch(sub.frequency, freq / 2);
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
      highpass?.disconnect();
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
