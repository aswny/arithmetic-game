import type { Item } from '../game/types';

export function generateItem(
  rng: () => number,
  options: { targetCost: number; facet: string; exclude?: Set<string> | null; pool?: number },
): Item;
