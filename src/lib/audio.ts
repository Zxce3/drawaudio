import { base } from '$app/paths';
import { getRowPitch } from './scales';

export class AudioService {
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayGainNode: GainNode | null = null;
  private delayWetNode: GainNode | null = null;
  private distortionNode: WaveShaperNode | null = null;
  private busNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private currentImpulse = 'reverb';
  private convolverNode: ConvolverNode | null = null;
  private reverbGainNode: GainNode | null = null;
  private isInitialized = false;
  private bpm = 120;
  private stepInterval: number | null = null;
  private currentStep = 0;
  private isPlaying = false;
  private matrix: boolean[][] = [];
  private playbackPatterns = {
    forward: (step: number) => (step + 1) % this.matrixSize,
    backward: (step: number) => (step - 1 + this.matrixSize) % this.matrixSize,
    bounce: (step: number) => {
      if (this.isReverse) {
        if (step <= 0) {
          this.isReverse = false;
          return 1;
        }
        return step - 1;
      } else {
        if (step >= this.matrixSize - 1) {
          this.isReverse = true;
          return step - 1;
        }
        return step + 1;
      }
    },
    random: () => Math.floor(Math.random() * this.matrixSize)
  };

  private currentPattern: keyof typeof this.playbackPatterns = 'forward';
  private isReverse = false;

  // Audio parameters with defaults
  private params = {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.6,
    release: 0.25,
    delayTime: 0.3,
    delayFeedback: 0.3,
    reverbMix: 0.3,
    filterCutoff: 6000,
    filterResonance: 0.7,
    distortion: 0,
    waveform: 'sine' as OscillatorType
  };

  private activeNotes: Set<number> = new Set();
  private notesInColumn: Map<number, number[]> = new Map();
  private currentScale = 'Major';
    private worker: Worker | null = null;
  private activePlayingNotes: Set<string> = new Set(); // Format: "row,col"
  private previousStep: number = -1;
  private playStepCallbacks: Set<(step: number) => void> = new Set();
  private impulseResponses: Map<string, AudioBuffer> = new Map();

  constructor(private matrixSize: number = 64) {
    this.createWorker();
  }

  private createWorker(): void {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url));
    this.worker.postMessage({ type: 'setTempo', payload: this.bpm });
    this.worker.onmessage = ({ data }) => {
      if (data.type === 'playStep') {
        this.playCurrentStep();
      }
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.audioContext = new AudioContext();
      await this.setupNodes();
      await this.loadImpulseResponse();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      throw error;
    }
  }

  private async setupNodes(): Promise<void> {
    if (!this.audioContext) return;

    // Create main nodes
    this.oscillator = this.audioContext.createOscillator();
    this.gainNode = this.audioContext.createGain();
    this.filterNode = this.audioContext.createBiquadFilter();
    this.delayNode = this.audioContext.createDelay(2.0);
    this.delayGainNode = this.audioContext.createGain();
    this.convolverNode = this.audioContext.createConvolver();
    this.reverbGainNode = this.audioContext.createGain();
    this.delayWetNode = this.audioContext.createGain();
    this.distortionNode = this.audioContext.createWaveShaper();
    this.distortionNode.oversample = '4x';
    this.busNode = this.audioContext.createGain();
    this.compressorNode = this.audioContext.createDynamicsCompressor();
    this.delayWetNode.gain.value = 0.6;
    this.distortionNode.curve = this.makeDistortionCurve(this.params.distortion);

    // Configure nodes
    this.oscillator.type = this.params.waveform;
    this.gainNode.gain.value = 0;
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = this.params.filterCutoff;
    this.filterNode.Q.value = this.params.filterResonance;
    this.delayNode.delayTime.value = this.params.delayTime;
    this.delayGainNode.gain.value = this.params.delayFeedback;
    this.reverbGainNode.gain.value = this.params.reverbMix;

    // Signal flow: voices -> filter -> distortion -> bus -> (dry | delay | reverb) -> compressor -> out
    this.oscillator.connect(this.gainNode);
    this.gainNode.connect(this.filterNode);
    this.filterNode.connect(this.distortionNode);
    this.distortionNode.connect(this.busNode);
    this.busNode.connect(this.compressorNode);
    this.busNode.connect(this.delayNode);
    this.delayNode.connect(this.delayGainNode);
    this.delayGainNode.connect(this.delayNode);
    this.delayNode.connect(this.delayWetNode);
    this.delayWetNode.connect(this.compressorNode);
    this.busNode.connect(this.convolverNode);
    this.convolverNode.connect(this.reverbGainNode);
    this.reverbGainNode.connect(this.compressorNode);
    this.compressorNode.connect(this.audioContext.destination);

    // Start oscillator
    this.oscillator.start();
  }

  private async loadImpulseResponse(): Promise<void> {
    if (!this.audioContext || !this.convolverNode) return;

    const files: Record<string, string> = {
      reverb: 'plate-reverb',
      guitar: 'guitar-cab',
      drum: 'drum-room'
    };

    try {
      for (const [type, file] of Object.entries(files)) {
        const response = await fetch(`${base}/impulse-${file}.wav`);
        if (!response.ok) {
          throw new Error(`Impulse response ${file} not found`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        this.impulseResponses.set(type, audioBuffer);
      }

      this.convolverNode.buffer = this.impulseResponses.get(this.currentImpulse) || null;
    } catch (error) {
      console.warn('Using fallback impulse response:', error);
      const sampleRate = this.audioContext.sampleRate;
      const length = 2 * sampleRate; // 2 seconds
      const impulse = this.audioContext.createBuffer(2, length, sampleRate);
      
      // Generate simple exponential decay noise
      for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          channelData[i] = (Math.random() * 2 - 1) * Math.exp(-4 * t);
        }
      }
      
      this.convolverNode.buffer = impulse;
    }
  }

  private makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> | null {
    if (amount <= 0) return null;
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  private sendWorkerMessage(type: string, payload?: any): void {
    if (this.worker) {
      this.worker.postMessage({ type, payload });
    }
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
    this.sendWorkerMessage('setTempo', bpm);
  }

  setMatrix(matrix: boolean[][]): void {
    this.matrix = matrix;
    this.scanGrid();
  }

  setPlaybackPattern(pattern: keyof typeof this.playbackPatterns) {
    this.currentPattern = pattern;
    if (this.isPlaying) {
      this.stopSequence();
      this.startSequence();
    }
  }

  async startSequence(): Promise<void> {
    if (!this.audioContext) return;
    this.isPlaying = true;
    this.currentStep = 0;
    this.isReverse = false;

    // Set initial state before starting worker
    await this.audioContext.resume();
    
    // Start the worker
    this.sendWorkerMessage('startPlayback', { 
      bpm: this.bpm,
      currentPattern: this.currentPattern
    });
  }

  stopSequence(): void {
    this.sendWorkerMessage('stopPlayback');
    this.isPlaying = false;
    this.stopSound();
  }

  private playStep(step: number, time: number): void {
    const activeRows = this.notesInColumn.get(step);
    if (!activeRows) return;

    for (const row of activeRows) {
      const frequency = this.getFrequency(step, row);
      const volume = this.getVolume(row);
      this.triggerNote(frequency, volume, time);
    }
  }

  private playCurrentStep(): void {
    if (!this.audioContext || !this.isPlaying) return;

    // Clear previous playing notes
    this.activePlayingNotes.clear();

    // Play all active cells in current column
    const activeRows = this.notesInColumn.get(this.currentStep);
    if (activeRows) {
      const now = this.audioContext.currentTime;
      activeRows.forEach(row => {
        const frequency = this.getFrequency(this.currentStep, row);
        const volume = this.getVolume(row);
        this.triggerNote(frequency, volume, now);
        this.activePlayingNotes.add(`${row},${this.currentStep}`);
      });
    }

    // Notify UI of step change
    this.notifyStepChange();
    
    // Update step based on pattern
    this.currentStep = this.playbackPatterns[this.currentPattern](this.currentStep);
  }

  private triggerNote(frequency: number, volume: number, time: number): void {
    if (!this.audioContext || !this.gainNode || !this.oscillator) return;

    const now = time;
    const attackTime = now + this.params.attack;
    const decayTime = attackTime + this.params.decay;
    const releaseTime = decayTime + this.params.release;

    // Create nodes for this note
    const noteOscillator = this.audioContext.createOscillator();
    const noteGain = this.audioContext.createGain();
    const noteLowPass = this.audioContext.createBiquadFilter();
    
    // Configure filter
    noteLowPass.type = 'lowpass';
    noteLowPass.frequency.value = this.params.filterCutoff;
    noteLowPass.Q.value = this.params.filterResonance;

    // Configure oscillator
    noteOscillator.type = this.params.waveform;
    noteOscillator.frequency.setValueAtTime(frequency, now);
    
    // Smooth frequency changes
    noteOscillator.frequency.setTargetAtTime(frequency, now, 0.03);

    // Connect nodes
    noteOscillator.connect(noteGain);
    noteGain.connect(noteLowPass);
    noteLowPass.connect(this.filterNode!);

    // Smoother envelope
    noteGain.gain.setValueAtTime(0, now);
    noteGain.gain.linearRampToValueAtTime(volume * 0.8, attackTime); // Reduced peak volume
    noteGain.gain.linearRampToValueAtTime(volume * this.params.sustain, decayTime);
    noteGain.gain.linearRampToValueAtTime(0, releaseTime);

    // Start and stop
    noteOscillator.start(now);
    noteOscillator.stop(releaseTime + 0.1);

    // Cleanup
    setTimeout(() => {
      noteOscillator.disconnect();
      noteGain.disconnect();
      noteLowPass.disconnect();
    }, (releaseTime - now + 0.2) * 1000);
  }

  // Add method to get current step for UI highlighting
  getCurrentStep(): number {
    return this.currentStep;
  }

  // Add method to check if sequence is playing
  isSequencePlaying(): boolean {
    return this.isPlaying;
  }

  /** Preview a note while drawing */
  updateSound(x: number, y: number): void {
    if (!this.isInitialized || !this.audioContext) return;
    this.triggerNote(this.getFrequency(x, y), this.getVolume(y), this.audioContext.currentTime);
  }

  private getFrequency(_x: number, y: number): number {
    return getRowPitch(this.currentScale, this.matrixSize, y).frequency;
  }

  private getVolume(_y: number): number {
    // The master compressor keeps dense columns from clipping
    return 0.4;
  }

  setWaveform(type: OscillatorType): void {
    this.params.waveform = type;
    if (this.oscillator) this.oscillator.type = type;
  }

  stopSound(): void {
    if (!this.gainNode) return;
    this.gainNode.gain.value = 0;
  }

  setParameter(param: keyof typeof this.params, value: number | OscillatorType): void {
    if (param in this.params) {
      (this.params[param] as any) = value;
      this.updateParameter(param, value as number);
    }
  }

  private updateParameter(param: string, value: number): void {
    if (!this.audioContext) return;

    const time = this.audioContext.currentTime;
    
    switch (param) {
      case 'filterCutoff':
        this.filterNode?.frequency.setTargetAtTime(value, time, 0.1);
        break;
      case 'filterResonance':
        this.filterNode?.Q.setTargetAtTime(value, time, 0.1);
        break;
      case 'delayTime':
        this.delayNode?.delayTime.setTargetAtTime(value, time, 0.1);
        break;
      case 'delayFeedback':
        this.delayGainNode?.gain.setTargetAtTime(value, time, 0.1);
        break;
      case 'reverbMix':
        this.reverbGainNode?.gain.setTargetAtTime(value, time, 0.1);
        break;
      case 'distortion':
        if (this.distortionNode) this.distortionNode.curve = this.makeDistortionCurve(value);
        break;
    }
  }

  private terminateWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  cleanup(): void {
    this.terminateWorker();
    if (this.oscillator) {
      this.oscillator.stop();
      this.oscillator.disconnect();
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
    }
    if (this.filterNode) {
      this.filterNode.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.isInitialized = false;
  }

  private scanGrid(): void {
    this.activeNotes.clear();
    this.notesInColumn.clear();

    for (let col = 0; col < this.matrixSize; col++) {
      const activeInColumn: number[] = [];
      
      for (let row = 0; row < this.matrixSize; row++) {
        if (this.matrix[row][col]) {
          const noteIndex = row * this.matrixSize + col;
          this.activeNotes.add(noteIndex);
          activeInColumn.push(row);
        }
      }
      
      if (activeInColumn.length > 0) {
        this.notesInColumn.set(col, activeInColumn);
      }
    }
  }

  getActiveNotesCount(): number {
    return this.activeNotes.size;
  }

  getActiveNotesInColumn(column: number): number[] {
    return this.notesInColumn.get(column) || [];
  }

  setScale(scale: string): void {
    this.currentScale = scale;
  }

  getRowLabelInfo(row: number) {
    return getRowPitch(this.currentScale, this.matrixSize, row);
  }

  isNotePlaying(row: number, col: number): boolean {
    return this.activePlayingNotes.has(`${row},${col}`);
  }

  isColumnActive(col: number): boolean {
    return this.currentStep === col;
  }

  // Add method to register step callback
  onStepChange(callback: (step: number) => void) {
    this.playStepCallbacks.add(callback);
    return () => this.playStepCallbacks.delete(callback);
  }

  private notifyStepChange() {
    this.playStepCallbacks.forEach(callback => callback(this.currentStep));
  }

  resizeMatrix(newSize: number): void {
    this.matrixSize = newSize;
    this.matrix = Array(newSize).fill(0).map(() => Array(newSize).fill(false));
    this.scanGrid();
    this.currentStep = 0;
    this.activePlayingNotes.clear();

    // Recreate worker to ensure clean state
    this.terminateWorker();
    this.createWorker();
  }

  setImpulseType(type: 'reverb' | 'guitar' | 'drum'): void {
    this.currentImpulse = type;
    if (this.convolverNode && this.impulseResponses.has(type)) {
      this.convolverNode.buffer = this.impulseResponses.get(type) || null;
    }
  }
}
