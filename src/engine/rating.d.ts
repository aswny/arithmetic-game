// Typed view of rating.js. The engine stays plain JS so sim/ can run it under
// bare `node` with no build step; this file is how the TypeScript app sees it.
import type { Item, Profile } from '../game/types';

export const TARGET_SECONDS: number;
export const RATING_MIN: number;
export const RATING_MAX: number;

export function createProfile(): Profile;
export function predictLogRT(profile: Profile, cost: number, facet: string): number;
export function predictRT(profile: Profile, cost: number, facet: string): number;
export function predictCorrect(profile: Profile, cost: number): number;

/** The cost this player sustains at TARGET_SECONDS; per-facet when one is named. */
export function ratingCost(profile: Profile, facet?: string | null): number;
export function costForAccuracy(profile: Profile, p: number): number;

export function observe(
  profile: Profile,
  item: Item,
  outcome: { correct: boolean; rtMs: number; weight?: number },
): { cost: number; facet: string; resid: number };
