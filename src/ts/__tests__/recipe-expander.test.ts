import { describe, expect, it } from 'vitest';
import { expandRecipes } from '../planner/lib/recipe-expander.js';
import type { CodexFile } from '../types/index.js';
import type { RecipesFile } from '../data/types.js';

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Minimal recipe graph:
 *
 *   Refined Brick (refined, yields 1)
 *     └─ Unfired Brick (intermediate, yields 1)
 *          ├─ Clay Lump (gathered, yields 1)
 *          └─ Sand (gathered, yields 1)
 *
 *   Study Journal (study, yields 1)
 *     └─ Parchment (intermediate, yields 1)
 *          └─ Wood Log (gathered, yields 1)
 */
const mockRecipes: RecipesFile = {
  version: 2,
  generated: '2026-02-04',
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
    '300': {
      id: '300',
      entityType: 'item',
      name: 'Study Journal',
      tier: 2,
      tag: 'Journal',
      yields: 1,
      inputs: [{ id: '301', qty: 2 }],
      station: null,
      skill: null,
      tool: null,
    },
    '301': {
      id: '301',
      entityType: 'item',
      name: 'Parchment',
      tier: 2,
      tag: 'Parchment',
      yields: 1,
      inputs: [{ id: '302', qty: 1 }],
      station: null,
      skill: null,
      tool: null,
    },
    '302': {
      id: '302',
      entityType: 'item',
      name: 'Wood Log',
      tier: 2,
      tag: 'Log',
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
    'Study Journal:2': '300',
    'Parchment:2': '301',
    'Wood Log:2': '302',
  },
};

// Gathered items: leaf nodes with no inputs
const mockGathered = new Set(['200', '201', '302']);

const mockCodex: CodexFile = {
  version: 1,
  generated: '2026-02-04',
  tiers: {
    '2': {
      name: 'Simple Codex',
      tier: 2,
      researches: [
        {
          id: 'Simple Stone Research',
          tier: 2,
          inputs: [
            { ref: 'Refined Brick:2', qty: 5 },
            { ref: 'Study Journal:2', qty: 10 },
          ],
        },
      ],
    },
  },
};

// =============================================================================
// MULTI-YIELD FIXTURE
// =============================================================================

const multiYieldRecipes: RecipesFile = {
  version: 2,
  generated: '2026-02-04',
  source: 'test',
  byId: {
    '400': {
      id: '400',
      entityType: 'item',
      name: 'Refined Ingot',
      tier: 3,
      tag: 'Refined Ingot',
      yields: 2, // yields 2 per craft
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
  byKey: {
    'Refined Ingot:3': '400',
    'Ore Chunk:3': '401',
  },
};

const multiYieldGathered = new Set(['401']);

const multiYieldCodex: CodexFile = {
  version: 1,
  generated: '2026-02-04',
  tiers: {
    '3': {
      name: 'Sturdy Codex',
      tier: 3,
      researches: [
        {
          id: 'Sturdy Metal Research',
          tier: 3,
          inputs: [{ ref: 'Refined Ingot:3', qty: 5 }],
        },
      ],
    },
  },
};

// =============================================================================
// EXPANSION TESTS
// =============================================================================

describe('expandRecipes', () => {
  it('expands a basic codex tier', () => {
    const result = expandRecipes(mockCodex, mockRecipes, 2, 10, mockGathered);

    expect(result.name).toBe('Simple Codex');
    expect(result.tier).toBe(2);
    expect(result.targetCount).toBe(10);
    expect(result.researches).toHaveLength(1);
  });

  it('sets research node properties correctly', () => {
    const result = expandRecipes(mockCodex, mockRecipes, 2, 10, mockGathered);
    const research = result.researches[0];

    expect(research.name).toBe('Simple Stone Research');
    expect(research.tier).toBe(2);
    expect(research.idealQty).toBe(10);
    expect(research.trackable).toBe(false);
    expect(research.mappingType).toBe('research');
    expect(research.children).toHaveLength(2);
  });

  it('calculates quantities correctly through the tree', () => {
    const result = expandRecipes(mockCodex, mockRecipes, 2, 10, mockGathered);
    const research = result.researches[0];

    // Refined Brick: 5 per research × 10 count = 50 needed
    const brick = research.children[0];
    expect(brick.name).toBe('Refined Brick');
    expect(brick.idealQty).toBe(50);

    // Unfired Brick: 1 per Refined Brick × 50 = 50
    const unfired = brick.children[0];
    expect(unfired.name).toBe('Unfired Brick');
    expect(unfired.idealQty).toBe(50);

    // Clay Lump: 2 per Unfired × 50 = 100
    const clay = unfired.children[0];
    expect(clay.name).toBe('Clay Lump');
    expect(clay.idealQty).toBe(100);

    // Sand: 1 per Unfired × 50 = 50
    const sand = unfired.children[1];
    expect(sand.name).toBe('Sand');
    expect(sand.idealQty).toBe(50);
  });

  it('categorizes nodes correctly', () => {
    const result = expandRecipes(mockCodex, mockRecipes, 2, 10, mockGathered);
    const research = result.researches[0];

    // Refined Brick → refined → trackable
    const brick = research.children[0];
    expect(brick.mappingType).toBe('likely_api');
    expect(brick.trackable).toBe(true);

    // Unfired Brick → intermediate → not trackable
    const unfired = brick.children[0];
    expect(unfired.mappingType).toBe('intermediate');
    expect(unfired.trackable).toBe(false);

    // Clay Lump → gathered → trackable
    const clay = unfired.children[0];
    expect(clay.mappingType).toBe('gathered');
    expect(clay.trackable).toBe(true);

    // Study Journal → study → trackable
    const journal = research.children[1];
    expect(journal.mappingType).toBe('study_material');
    expect(journal.trackable).toBe(true);
  });

  it('handles multi-yield recipes (ceil division)', () => {
    // Need 5 Refined Ingot per research × 10 count = 50 needed
    // Yields 2 per craft → ceil(50 / 2) = 25 crafts → 25 × 2 = 50 ideal
    const result = expandRecipes(multiYieldCodex, multiYieldRecipes, 3, 10, multiYieldGathered);
    const research = result.researches[0];
    const ingot = research.children[0];

    expect(ingot.name).toBe('Refined Ingot');
    expect(ingot.idealQty).toBe(50);

    // Ore Chunk: 3 per craft × 25 crafts = 75
    const ore = ingot.children[0];
    expect(ore.name).toBe('Ore Chunk');
    expect(ore.idealQty).toBe(75);
  });

  it('handles odd quantities with multi-yield (rounds up)', () => {
    // 3 needed, yields 2 → ceil(3/2) = 2 crafts → 4 ideal (overshoot)
    const oddCodex: CodexFile = {
      version: 1,
      generated: '2026-02-04',
      tiers: {
        '3': {
          name: 'Sturdy Codex',
          tier: 3,
          researches: [
            {
              id: 'Test Research',
              tier: 3,
              inputs: [{ ref: 'Refined Ingot:3', qty: 3 }],
            },
          ],
        },
      },
    };

    const result = expandRecipes(oddCodex, multiYieldRecipes, 3, 1, multiYieldGathered);
    const ingot = result.researches[0].children[0];

    expect(ingot.idealQty).toBe(4); // ceil(3/2) × 2 = 4
    expect(ingot.children[0].idealQty).toBe(6); // 3 per craft × 2 crafts = 6
  });

  it('throws on missing codex tier', () => {
    expect(() => expandRecipes(mockCodex, mockRecipes, 99, 10, mockGathered)).toThrow(
      'Codex tier 99 not found'
    );
  });

  it('throws on missing recipe', () => {
    const badCodex: CodexFile = {
      version: 1,
      generated: '2026-02-04',
      tiers: {
        '1': {
          name: 'Bad',
          tier: 1,
          researches: [
            {
              id: 'Bad Research',
              tier: 1,
              inputs: [{ ref: 'Nonexistent Item:1', qty: 1 }],
            },
          ],
        },
      },
    };

    expect(() => expandRecipes(badCodex, mockRecipes, 1, 1, mockGathered)).toThrow(
      'Recipe not found'
    );
  });

  it('preserves recipeQty on nodes', () => {
    const result = expandRecipes(mockCodex, mockRecipes, 2, 10, mockGathered);
    const research = result.researches[0];

    expect(research.children[0].recipeQty).toBe(5); // codex says 5 per research
    expect(research.children[1].recipeQty).toBe(10); // codex says 10 per research
  });

  it('creates gathered leaf for missing recipe IDs', () => {
    // Recipe with an input ID that does not exist in byId
    const missingInputRecipes: RecipesFile = {
      version: 2,
      generated: '2026-02-04',
      source: 'test',
      byId: {
        '500': {
          id: '500',
          entityType: 'item',
          name: 'Mystery Potion',
          tier: 2,
          tag: 'Potion',
          yields: 1,
          inputs: [{ id: '9999999999', qty: 3 }],
          station: null,
          skill: null,
          tool: null,
        },
      },
      byKey: {
        'Mystery Potion:2': '500',
      },
    };

    const missingCodex: CodexFile = {
      version: 1,
      generated: '2026-02-04',
      tiers: {
        '2': {
          name: 'Test Codex',
          tier: 2,
          researches: [
            {
              id: 'Test Research',
              tier: 2,
              inputs: [{ ref: 'Mystery Potion:2', qty: 1 }],
            },
          ],
        },
      },
    };

    const result = expandRecipes(missingCodex, missingInputRecipes, 2, 1, new Set());
    const potion = result.researches[0].children[0];

    expect(potion.name).toBe('Mystery Potion');
    expect(potion.children).toHaveLength(1);

    // The missing input becomes a gathered leaf
    const missing = potion.children[0];
    expect(missing.name).toBe('Unknown (9999999999)');
    expect(missing.trackable).toBe(true);
    expect(missing.mappingType).toBe('gathered');
    expect(missing.idealQty).toBe(3);
    expect(missing.children).toHaveLength(0);
  });

  it('does not false-cycle on shared dependencies across research inputs', () => {
    // Both Refined Brick and Study Journal depend on the same gathered item (Clay Lump)
    const sharedRecipes: RecipesFile = {
      version: 2,
      generated: '2026-02-04',
      source: 'test',
      byId: {
        '600': {
          id: '600',
          entityType: 'item',
          name: 'Refined Brick',
          tier: 1,
          tag: 'Refined Brick',
          yields: 1,
          inputs: [{ id: '602', qty: 2 }],
          station: null,
          skill: null,
          tool: null,
        },
        '601': {
          id: '601',
          entityType: 'item',
          name: 'Study Journal',
          tier: 1,
          tag: 'Journal',
          yields: 1,
          inputs: [{ id: '602', qty: 1 }],
          station: null,
          skill: null,
          tool: null,
        },
        '602': {
          id: '602',
          entityType: 'item',
          name: 'Clay Lump',
          tier: 1,
          tag: 'Chunk',
          yields: 1,
          inputs: [],
          station: null,
          skill: null,
          tool: null,
        },
      },
      byKey: {
        'Refined Brick:1': '600',
        'Study Journal:1': '601',
        'Clay Lump:1': '602',
      },
    };

    const sharedCodex: CodexFile = {
      version: 1,
      generated: '2026-02-04',
      tiers: {
        '1': {
          name: 'Test Codex',
          tier: 1,
          researches: [
            {
              id: 'Test Research',
              tier: 1,
              inputs: [
                { ref: 'Refined Brick:1', qty: 1 },
                { ref: 'Study Journal:1', qty: 1 },
              ],
            },
          ],
        },
      },
    };

    // Should NOT throw — Clay Lump appearing in both branches is not a cycle
    const result = expandRecipes(sharedCodex, sharedRecipes, 1, 5, new Set(['602']));
    const research = result.researches[0];

    expect(research.children).toHaveLength(2);
    expect(research.children[0].name).toBe('Refined Brick');
    expect(research.children[1].name).toBe('Study Journal');

    // Both branches should have Clay Lump as a child
    expect(research.children[0].children[0].name).toBe('Clay Lump');
    expect(research.children[1].children[0].name).toBe('Clay Lump');
  });
});
