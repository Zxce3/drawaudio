/** Magnitude (linear) of an RBJ biquad lowpass/highpass at frequency f */
export function biquadMagnitude(type: 'lowpass' | 'highpass', f: number, cutoff: number, q: number, sampleRate = 48000): number {
  const w0 = (2 * Math.PI * cutoff) / sampleRate;
  const alpha = Math.sin(w0) / (2 * Math.max(q, 0.0001));
  const cos = Math.cos(w0);
  const b = type === 'lowpass' ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  const a = [1 + alpha, -2 * cos, 1 - alpha];
  const w = (2 * Math.PI * f) / sampleRate;
  const re = (c: number[]) => c[0] + c[1] * Math.cos(w) + c[2] * Math.cos(2 * w);
  const im = (c: number[]) => -(c[1] * Math.sin(w) + c[2] * Math.sin(2 * w));
  const num = Math.hypot(re(b), im(b));
  const den = Math.hypot(re(a), im(a));
  return num / den;
}

export interface FilterSettings {
  lpEnabled: boolean;
  cutoff: number;
  resonance: number;
  hpEnabled: boolean;
  hpCutoff: number;
  hpResonance: number;
}

/** Combined response in dB across a log frequency axis (20 Hz - 20 kHz) */
export function filterResponse(s: FilterSettings, points = 120): { freq: number; db: number }[] {
  return Array.from({ length: points }, (_, i) => {
    const freq = 20 * 1000 ** (i / (points - 1));
    let mag = 1;
    if (s.lpEnabled) mag *= biquadMagnitude('lowpass', freq, Math.min(s.cutoff, 20000), 10 ** (s.resonance / 20));
    if (s.hpEnabled) mag *= biquadMagnitude('highpass', freq, s.hpCutoff, 10 ** (s.hpResonance / 20));
    return { freq, db: 20 * Math.log10(Math.max(mag, 1e-4)) };
  });
}
