// The engine is plain JS so it can run under bare `node` in sim/ with no build
// step. These declarations give the TypeScript app a checked view of it.

export interface Profile {
  intercept: number;
  slope: number;
  accThreshold: number;
  offsets: Record<string, number>;
  n: number;
  facetN: Record<string, number>;
}

export interface Item {
  op: '+' | '-' | '*' | '/';
  a: number;
  b: number;
  answer: number;
  cost: number;
  facet: string;
}

export interface Outcome {
  penaltyS: number;
  solved: number;
  missed: number;
  over: boolean;
}

export interface Session {
  cfg: { durationS: number; missPenaltyS: number };
  nextItem(): Item;
  submit(res: { correct: boolean; rtMs: number }): Outcome;
  isOver(): boolean;
  progress(): number;
  remainingS(): number;
  readonly elapsedS: number;
  readonly solved: number;
  readonly missed: number;
  readonly items: number;
  readonly log: Array<Item & { correct: boolean; rtMs: number }>;
}

export interface RunRecord {
  at: number;
  solved: number;
  missed: number;
  items: number;
  rating: number;
  delta: number;
}
