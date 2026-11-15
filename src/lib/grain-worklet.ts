/**
 * AudioWorklet source for the "Reverse" and "Pitch shift" delay modes.
 * It is loaded from a Blob URL so no extra build step is needed.
 *
 * Two overlapping grains read from a circular buffer with a sin² window
 * (the windows sum to 1), either backwards (reverse) or at a different
 * playback rate (pitch shift).
 */
export const GRAIN_WORKLET_NAME = 'grain-delay';

export const GRAIN_WORKLET_SOURCE = `
class GrainDelay extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'time', defaultValue: 0.4, minValue: 0.05, maxValue: 1.5, automationRate: 'k-rate' },
      { name: 'rate', defaultValue: 1, minValue: 0.25, maxValue: 4, automationRate: 'k-rate' },
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
    ];
  }
  constructor() {
    super();
    this.size = Math.ceil(sampleRate * 4);
    this.buffers = [new Float32Array(this.size), new Float32Array(this.size)];
    this.write = 0;
    this.phase = [0, 0.5];
    this.starts = [0, 0];
    this.delays = [0, 0];
    this.initialised = false;
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const n = Math.max(64, Math.floor(parameters.time[0] * sampleRate));
    const reverse = parameters.mode[0] < 0.5;
    const rate = parameters.rate[0];
    if (!this.initialised) {
      this.delays = [0, n / 2];
      this.initialised = true;
    }
    const frames = output[0].length;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < this.buffers.length; c++) {
        const src = input[c] || input[0];
        this.buffers[c][this.write] = src ? src[i] : 0;
      }
      let outL = 0;
      let outR = 0;
      for (let g = 0; g < 2; g++) {
        let pos;
        let window;
        if (reverse) {
          let p = this.phase[g];
          if (p === 0) this.starts[g] = this.write;
          pos = this.starts[g] - p * n;
          window = Math.sin(Math.PI * p) ** 2;
          p += 1 / n;
          this.phase[g] = p >= 1 ? 0 : p;
        } else {
          let d = this.delays[g];
          pos = this.write - d;
          window = Math.sin(Math.PI * Math.min(Math.max(d / n, 0), 1)) ** 2;
          d += 1 - rate;
          if (d > n) d -= n;
          if (d < 0) d += n;
          this.delays[g] = d;
        }
        pos = ((pos % this.size) + this.size) % this.size;
        const i0 = Math.floor(pos);
        const i1 = (i0 + 1) % this.size;
        const frac = pos - i0;
        const l = this.buffers[0];
        const r = this.buffers[1];
        outL += (l[i0] * (1 - frac) + l[i1] * frac) * window;
        outR += (r[i0] * (1 - frac) + r[i1] * frac) * window;
      }
      output[0][i] = outL;
      if (output[1]) output[1][i] = outR;
      this.write = (this.write + 1) % this.size;
    }
    return true;
  }
}
registerProcessor('${GRAIN_WORKLET_NAME}', GrainDelay);
`;
