import type { WavetableName } from './types';

export const WAVETABLES: { value: WavetableName; label: string }[] = [
  { value: 'organ', label: 'Organ' },
  { value: 'vocal', label: 'Vocal' },
  { value: 'glass', label: 'Glass' },
  { value: 'sweep', label: 'Sweep' }
];

const HARMONICS = 48;
const FRAMES = 4;

const gauss = (x: number, center: number, width: number) => Math.exp(-(((x - center) / width) ** 2));

/** Amplitude of harmonic n (1-based) in one frame of a table */
function amplitude(table: WavetableName, frame: number, n: number): number {
  switch (table) {
    case 'organ': {
      // Drawbar-style: each frame lights a different set of harmonics
      const bars = [[1, 2, 3], [1, 2, 4, 8], [1, 3, 5, 7], [1, 2, 3, 4, 5, 6, 8]][frame];
      return bars.includes(n) ? 1 / Math.sqrt(n) : 0;
    }
    case 'vocal': {
      // Vowel formants (a, e, i, o) as peaks over a falling spectrum
      const f = [[8, 14], [5, 20], [3, 24], [5, 9]][frame];
      return (gauss(n, f[0], 2.2) + 0.7 * gauss(n, f[1], 3)) / Math.sqrt(n) + (n === 1 ? 0.6 : 0);
    }
    case 'glass':
      // Sparse, bell-like partials that spread out across the frames
      return n % (frame + 2) === 1 || n === 1 ? 1 / n ** (0.7 + frame * 0.15) : 0;
    default:
      // Sweep: from a pure sine toward a bright sawtooth
      return 1 / n ** (2.2 - frame * 0.75);
  }
}

/** Harmonic amplitudes (index 0 unused) for a morph position 0 - 1 */
export function wavetableHarmonics(table: WavetableName, position: number): Float32Array {
  const pos = Math.min(Math.max(position, 0), 1) * (FRAMES - 1);
  const a = Math.floor(pos);
  const b = Math.min(a + 1, FRAMES - 1);
  const mix = pos - a;
  const out = new Float32Array(HARMONICS);
  let peak = 0;
  for (let n = 1; n < HARMONICS; n++) {
    out[n] = amplitude(table, a, n) * (1 - mix) + amplitude(table, b, n) * mix;
    peak = Math.max(peak, out[n]);
  }
  if (peak > 0) for (let n = 1; n < HARMONICS; n++) out[n] /= peak;
  return out;
}

/** One cycle of the waveform, for drawing a preview */
export function wavetableShape(table: WavetableName, position: number, points = 96): number[] {
  const harmonics = wavetableHarmonics(table, position);
  const shape = Array.from({ length: points }, (_, i) => {
    let sum = 0;
    for (let n = 1; n < harmonics.length; n++) sum += harmonics[n] * Math.sin((2 * Math.PI * n * i) / points);
    return sum;
  });
  const peak = Math.max(...shape.map(Math.abs), 1e-6);
  return shape.map((v) => v / peak);
}
