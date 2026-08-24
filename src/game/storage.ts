// Profile persistence.
//
// Every read and write is guarded: localStorage throws outright in some
// privacy modes, and the game has to stay playable when it does -- an
// unsaveable profile is a worse experience than a forgotten one, not a
// broken app.

import { createProfile } from '../engine/rating.js';
import type { Profile, RunRecord } from './types';

const PROFILE_KEY = 'sprint.profile.v1';
const HISTORY_KEY = 'sprint.history.v1';
const HISTORY_LIMIT = 60;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode, or quota: the run still counts, it just isn't remembered */
  }
}

export function loadProfile(): Profile {
  const fresh = createProfile() as Profile;
  const saved = read<Partial<Profile> | null>(PROFILE_KEY, null);
  if (!saved || typeof saved.intercept !== 'number') return fresh;
  // Merge rather than replace, so a profile saved by an older build that
  // lacked a field still loads with a sane default for it.
  return { ...fresh, ...saved, offsets: saved.offsets ?? {}, facetN: saved.facetN ?? {} };
}

export const saveProfile = (p: Profile): void => write(PROFILE_KEY, p);

export const loadHistory = (): RunRecord[] => read<RunRecord[]>(HISTORY_KEY, []);

export function saveRun(record: RunRecord): RunRecord[] {
  const history = [...loadHistory(), record].slice(-HISTORY_LIMIT);
  write(HISTORY_KEY, history);
  return history;
}

export const bestSolved = (history: RunRecord[]): number =>
  history.reduce((best, r) => Math.max(best, r.solved), 0);
