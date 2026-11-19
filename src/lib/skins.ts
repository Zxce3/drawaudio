/** Colour skins. The tokens live in src/app.css under html[data-skin='...']; this list drives the pickers. */
export interface Skin {
  id: string;
  label: string;
  /** Preview colours: background, accent, playhead */
  swatch: [string, string, string];
}

export const SKINS: Skin[] = [
  { id: 'midnight', label: 'Midnight', swatch: ['#09090b', '#38a8f5', '#f2d94e'] },
  { id: 'amber', label: 'Amber', swatch: ['#120d06', '#f59e0b', '#fde68a'] },
  { id: 'phosphor', label: 'Phosphor', swatch: ['#050a06', '#3ddc84', '#d9f99d'] },
  { id: 'rose', label: 'Rose', swatch: ['#12080f', '#f472b6', '#fbbf24'] },
  { id: 'daylight', label: 'Daylight', swatch: ['#fafafa', '#2563eb', '#d97706'] }
];

export const SKIN_KEY = 'drawaudio:skin';
export const isSkin = (id: unknown): id is string => SKINS.some((s) => s.id === id);
