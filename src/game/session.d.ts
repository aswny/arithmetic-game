import type { Profile, Session } from './types';

export interface SprintConfig {
  durationS: number;
  missPolicy: 'time' | 'sudden' | 'lives';
  missPenaltyS: number;
  lives: number;
  rampLo: number;
  rampHi: number;
  flatFraction: number;
  downWeight: boolean;
}

export const SPRINT: SprintConfig;

export function chooseFacet(profile: Profile, target: number, rng: () => number): string;

export function createSession(
  profile: Profile,
  rng: () => number,
  opts?: Partial<SprintConfig>,
): Session;
