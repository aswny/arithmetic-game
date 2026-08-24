import type { Item } from '../game/types';

export const FACETS: string[];
export function digits(n: number): number;
export function carryCount(a: number, b: number): number;
export function borrowCount(a: number, b: number): number;
export function facetOf(item: Pick<Item, 'op' | 'a' | 'b'>): string;
export function costOf(item: Pick<Item, 'op' | 'a' | 'b'>): number;
