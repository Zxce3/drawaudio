/**
 * Small AudioWorklet processors, loaded from Blob URLs (no extra build step).
 *
 * The bit crusher follows the BitCrusher example from the Web Audio API
 * specification, which is also the basis of the AudioWorklet sample in
 * GoogleChromeLabs/web-audio-samples (Apache-2.0). The recorder follows the
 * same "collect frames in the worklet, post them to the main thread" pattern
 * those samples use.
 */
export const CRUSHER_NAME = 'bit-crusher';
export const RECORDER_NAME = 'pcm-recorder';

export const CRUSHER_SOURCE = `
class BitCrusher extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bitDepth', defaultValue: 8, minValue: 1, maxValue: 16, automationRate: 'k-rate' },
      { name: 'frequencyReduction', defaultValue: 0.4, minValue: 0.01, maxValue: 1, automationRate: 'k-rate' }
    ];
  }
  constructor() {
    super();
    this.phase = [0, 0];
    this.held = [0, 0];
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const step = Math.pow(0.5, parameters.bitDepth[0]);
    const reduction = parameters.frequencyReduction[0];
    for (let c = 0; c < output.length; c++) {
      const source = input[c] || input[0];
      if (!source) continue;
      for (let i = 0; i < source.length; i++) {
        this.phase[c] += reduction;
        if (this.phase[c] >= 1) {
          this.phase[c] -= 1;
          this.held[c] = step * Math.floor(source[i] / step + 0.5);
        }
        output[c][i] = this.held[c];
      }
    }
    return true;
  }
}
registerProcessor('${CRUSHER_NAME}', BitCrusher);
`;

export const RECORDER_SOURCE = `
class PcmRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.recording = false;
    this.block = 4096;
    this.fill = 0;
    this.buffers = [new Float32Array(this.block), new Float32Array(this.block)];
    this.port.onmessage = (event) => {
      if (event.data === 'start') {
        this.recording = true;
        this.fill = 0;
      } else if (event.data === 'stop') {
        this.flush(true);
        this.recording = false;
      }
    };
  }
  flush(done) {
    const chunk = this.buffers.map((b) => b.slice(0, this.fill));
    this.port.postMessage({ chunk, done }, chunk.map((c) => c.buffer));
    this.fill = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!this.recording || !input.length) return true;
    const frames = input[0].length;
    for (let i = 0; i < frames; i++) {
      this.buffers[0][this.fill] = input[0][i];
      this.buffers[1][this.fill] = (input[1] || input[0])[i];
      if (++this.fill === this.block) this.flush(false);
    }
    return true;
  }
}
registerProcessor('${RECORDER_NAME}', PcmRecorder);
`;
