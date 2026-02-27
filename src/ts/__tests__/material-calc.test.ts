import { describe, expect, it } from 'vitest';
import { breakdownMaterials } from '../material-calc.js';
import type { RecipesFile } from '../data/types.js';

// =============================================================================
// FIXTURES
// =============================================================================

/**
 * Minimal recipe graph:
 *
 *   Refined Brick (yields 1)
 *     └─ Unfired Brick (yields 1)
 *          ├─ Clay Lump (raw, yields 1)
 *          └─ Sand (raw, yields 1)
 */
const simpleRecipes: RecipesFile = {
  version: 2,
  generated: '2026-02-25',
  source: 'test',
  byId: {
    '100': {
      id: '100',
      entityType: 'item',
      name: 'Refined Brick',
      tier: 2,
      tag: 'Refined Brick',
      yields: 1,
      inputs: [{ id: '101', qty: 1 }],
      station: null,
      skill: null,
      tool: null,
    },
    '101': {
      id: '101',
      entityType: 'item',
      name: 'Unfired Brick',
      tier: 2,
      tag: 'Brick',
      yields: 1,
      inputs: [
        { id: '200', qty: 2 },
        { id: '201', qty: 1 },
      ],
      station: null,
      skill: null,
      tool: null,
    },
    '200': {
      id: '200',
      entityType: 'item',
      name: 'Clay Lump',
      tier: 2,
      tag: 'Chunk',
      yields: 1,
      inputs: [],
      station: null,
      skill: null,
      tool: null,
    },
    '201': {
      id: '201',
      entityType: 'item',
      name: 'Sand',
      tier: 2,
      tag: 'Sand',
      yields: 1,
      inputs: [],
      station: null,
      skill: null,
      tool: null,
    },
  },
  byKey: {
    'Refined Brick:2': '100',
    'Unfired Brick:2': '101',
    'Clay Lump:2': '200',
    'Sand:2': '201',
  },
};

/** Multi-yield: recipe produces 2 per craft */
const multiYieldRecipes: RecipesFile = {
  version: 2,
  generated: '2026-02-25',
  source: 'test',
  byId: {
    '400': {
      id: '400',
      entityType: 'item',
      name: 'Refined Ingot',
      tier: 3,
      tag: 'Refined Ingot',
      yields: 2,
      inputs: [{ id: '401', qty: 3 }],
      station: null,
      skill: null,
      tool: null,
    },
    '401': {
      id: '401',
      entityType: 'item',
      name: 'Ore Chunk',
      tier: 3,
      tag: 'Chunk',
      yields: 1,
      inputs: [],
      station: null,
      skill: null,
      tool: null,
    },
  },
  byKey: { 'Refined Ingot:3': '400', 'Ore Chunk:3': '401' },
};

// =============================================================================
// TESTS
// =============================================================================

describe('breakdownMaterials', () => {
  it('returns null for unknown recipe', () => {
    expect(breakdownMaterials(simpleRecipes, '999', 1)).toBeNull();
  });

  it('returns empty tree for raw resource (no inputs)', () => {
    const result = breakdownMaterials(simpleRecipes, '200', 10);
    expect(result).not.toBeNull();
    if (!result) return; // narrowing for TS, assertion above catches it
    expect(result.tree).toHaveLength(0);
    expect(result.totals).toHaveLength(0);
  });

  it('breaks down a simple 2-level recipe', () => {
    const result = breakdownMaterials(simpleRecipes, '100', 1);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.recipe.name).toBe('Refined Brick');
    expect(result.craftCount).toBe(1);

    // Tree: Unfired Brick(depth 0), Clay(depth 1), Sand(depth 1)
    expect(result.tree).toHaveLength(3);
    expect(result.tree[0].name).toBe('Unfired Brick');
    expect(result.tree[0].depth).toBe(0);
    expect(result.tree[0].isRaw).toBe(false);

    expect(result.tree[1].name).toBe('Clay Lump');
    expect(result.tree[1].depth).toBe(1);
    expect(result.tree[1].isRaw).toBe(true);
    expect(result.tree[1].qty).toBe(2);

    expect(result.tree[2].name).toBe('Sand');
    expect(result.tree[2].depth).toBe(1);
    expect(result.tree[2].isRaw).toBe(true);
    expect(result.tree[2].qty).toBe(1);

    // Totals: just the 2 raw materials
    expect(result.totals).toHaveLength(2);
  });

  it('multiplier scales quantities correctly', () => {
    const result = breakdownMaterials(simpleRecipes, '100', 10);
    expect(result).not.toBeNull();
    if (!result) return;

    // 10 Refined Brick → 10 Unfired Brick → 20 Clay, 10 Sand
    const clay = result.totals.find((m) => m.name === 'Clay Lump');
    const sand = result.totals.find((m) => m.name === 'Sand');
    expect(clay).toBeDefined();
    expect(sand).toBeDefined();
    expect(clay?.qty).toBe(20);
    expect(sand?.qty).toBe(10);
  });

  it('respects multi-yield recipes', () => {
    // Want 5 Refined Ingots, yields 2 per craft → ceil(5/2) = 3 crafts → 9 ore
    const result = breakdownMaterials(multiYieldRecipes, '400', 5);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.totals).toHaveLength(1);
    expect(result.totals[0].name).toBe('Ore Chunk');
    expect(result.totals[0].qty).toBe(9);
  });

  it('multi-yield with even division', () => {
    // Want 4 Refined Ingots, yields 2 → exactly 2 crafts → 6 ore
    const result = breakdownMaterials(multiYieldRecipes, '400', 4);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.totals[0].qty).toBe(6);
  });
});
