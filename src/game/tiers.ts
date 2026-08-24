// Named bands over the continuous rating.
//
// The bands exist for the player -- people want an identity to hold on to --
// but nothing in the engine branches on them. Difficulty is always the
// continuous number underneath, which is what kept the original three-level
// design from ever working.

export interface Tier {
  name: string;
  min: number;
  max: number;
}

// Simulated solvers spanned roughly 1.6 to 9.8, so the bands cover that range
// with the widest ones where most players actually land.
const BANDS: Array<{ name: string; min: number }> = [
  { name: 'Apprentice', min: -Infinity },
  { name: 'Steady', min: 2.2 },
  { name: 'Quick', min: 3.2 },
  { name: 'Sharp', min: 4.2 },
  { name: 'Fluent', min: 5.2 },
  { name: 'Swift', min: 6.2 },
  { name: 'Blazing', min: 7.4 },
  { name: 'Prodigy', min: 8.6 },
];

export function tierFor(rating: number): Tier {
  let i = 0;
  while (i + 1 < BANDS.length && rating >= BANDS[i + 1].min) i++;
  return {
    name: BANDS[i].name,
    min: BANDS[i].min,
    max: i + 1 < BANDS.length ? BANDS[i + 1].min : Infinity,
  };
}

// How far through the current band, 0..1. Used for the reveal-screen meter.
export function tierProgress(rating: number): number {
  const { min, max } = tierFor(rating);
  if (!Number.isFinite(min)) return Math.max(0, Math.min(1, rating / (max || 1)));
  if (!Number.isFinite(max)) return 1;
  return Math.max(0, Math.min(1, (rating - min) / (max - min)));
}

// The rating is shown x100 so that a good run moves a visible number of points
// rather than a second decimal place.
export const displayRating = (rating: number): number => Math.round(rating * 100);
