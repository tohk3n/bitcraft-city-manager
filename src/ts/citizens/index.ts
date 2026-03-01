// Barrel, re-exports the public API so consumers don't change imports.
// main.ts imports { CitizensUI } from './citizens.js', still works.
// player-context.ts imports type { CitizenRecord } from '../citizens.js', still works.

export { CitizensUI } from './citizens.js';
export type { CitizenRecord, CitizensData } from '../types/citizens.js';
