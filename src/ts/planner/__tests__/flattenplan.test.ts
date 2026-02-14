import { describe, expect, it } from 'vitest';
import {
  flattenPlan,
  calculatePlanProgress,
  generatePlanCSV,
} from '../../../ts/planner/lib/progress-calc.js';
import type { ProcessedCodex, ProcessedNode, PlanItem } from '../../types/index.js';

// =============================================================================
// TEST FIXTURES
// =============================================================================

/** Helper to build a ProcessedNode with sensible defaults. */
function node(
  overrides: Partial<ProcessedNode> & Pick<ProcessedNode, 'name' | 'tier'>
): ProcessedNode {
  return {
    recipeQty: 1,
    idealQty: overrides.required ?? 100,
    required: 100,
    have: 0,
    deficit: 100,
    contribution: 0,
    pctComplete: 0,
    status: 'missing',
    satisfied: false,
    satisfiedByParent: false,
    trackable: true,
    mappingType: 'gathered',
    children: [],
    ...overrides,
  };
}

function makeCodex(
  researches: ProcessedNode[],
  studyJournals: ProcessedNode | null = null
): ProcessedCodex {
  return {
    name: 'Test Codex',
    tier: 5,
    targetCount: 10,
    researches,
    studyJournals,
  };
}

// =============================================================================
// flattenPlan
// =============================================================================

describe('flattenPlan', () => {
  it('collects trackable nodes from researches', () => {
    const codex = makeCodex([
      node({
        name: 'Research A',
        tier: 5,
        trackable: false,
        mappingType: 'research',
        children: [
          node({ name: 'Rough Stone Chunk', tier: 1, required: 200, have: 50 }),
          node({ name: 'Simple Plank', tier: 2, required: 100, have: 100 }),
        ],
      }),
    ]);

    const items = flattenPlan(codex);
    expect(items).toHaveLength(2);

    const stone = findItem(items, 'Rough Stone Chunk');
    expect(stone.required).toBe(200);
    expect(stone.have).toBe(50);
    expect(stone.deficit).toBe(150);
    expect(stone.activity).toBe('Mining');

    const plank = findItem(items, 'Simple Plank');
    expect(plank.deficit).toBe(0);
    expect(plank.pctComplete).toBe(100);
  });

  it('skips non-trackable and satisfiedByParent nodes', () => {
    const codex = makeCodex([
      node({
        name: 'Research A',
        tier: 5,
        trackable: false,
        mappingType: 'research',
        children: [
          node({
            name: 'Intermediate',
            tier: 2,
            trackable: false,
            mappingType: 'intermediate',
            children: [node({ name: 'Clay Lump', tier: 1, required: 100, have: 0 })],
          }),
          node({ name: 'Satisfied', tier: 1, satisfiedByParent: true, required: 50, have: 50 }),
        ],
      }),
    ]);

    const items = flattenPlan(codex);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Clay Lump');
  });

  it('deduplicates by name:tier, summing required', () => {
    const codex = makeCodex([
      node({
        name: 'Research A',
        tier: 5,
        trackable: false,
        mappingType: 'research',
        children: [node({ name: 'Clay Lump', tier: 1, required: 100, have: 30 })],
      }),
      node({
        name: 'Research B',
        tier: 5,
        trackable: false,
        mappingType: 'research',
        children: [node({ name: 'Clay Lump', tier: 1, required: 200, have: 30 })],
      }),
    ]);

    const items = flattenPlan(codex);
    expect(items).toHaveLength(1);
    expect(items[0].required).toBe(300);
    expect(items[0].have).toBe(30);
    expect(items[0].deficit).toBe(270);
  });

  it('includes study journal sub-materials', () => {
    const journalTree = node({
      name: 'Fine Study Journal',
      tier: 4,
      required: 60,
      have: 10,
      mappingType: 'intermediate',
      trackable: true,
      children: [
        node({ name: 'Ink', tier: 3, required: 120, have: 20, mappingType: 'gathered' }),
        node({ name: 'Parchment', tier: 3, required: 60, have: 5, mappingType: 'gathered' }),
      ],
    });

    const codex = makeCodex(
      [
        node({
          name: 'Research A',
          tier: 5,
          trackable: false,
          mappingType: 'research',
          children: [node({ name: 'Rough Stone Chunk', tier: 1, required: 100, have: 0 })],
        }),
      ],
      journalTree
    );

    const items = flattenPlan(codex);
    const names = items.map((i) => i.name);

    expect(names).toContain('Ink');
    expect(names).toContain('Parchment');
    expect(names).toContain('Fine Study Journal');
    expect(names).toContain('Rough Stone Chunk');
  });

  it('sets actionable=true for leaf trackables (no trackable children)', () => {
    const codex = makeCodex([
      node({
        name: 'Research A',
        tier: 5,
        trackable: false,
        mappingType: 'research',
        children: [
          // Parent with trackable children → not actionable
          node({
            name: 'Refined Brick',
            tier: 2,
            required: 50,
            have: 0,
            mappingType: 'likely_api',
            children: [
              node({ name: 'Clay Lump', tier: 1, required: 100, have: 0 }),
              node({ name: 'Sand', tier: 1, required: 50, have: 0 }),
            ],
          }),
        ],
      }),
    ]);

    const items = flattenPlan(codex);

    const brick = findItem(items, 'Refined Brick');
    expect(brick.actionable).toBe(false);

    const clay = findItem(items, 'Clay Lump');
    expect(clay.actionable).toBe(true);

    const sand = findItem(items, 'Sand');
    expect(sand.actionable).toBe(true);
  });

  it('sets activity correctly', () => {
    const codex = makeCodex([
      node({
        name: 'Research A',
        tier: 5,
        trackable: false,
        mappingType: 'research',
        children: [
          node({ name: 'Rough Stone Chunk', tier: 1 }),
          node({ name: 'Oak Trunk', tier: 1 }),
          node({ name: 'Wild Berry', tier: 1 }),
          node({ name: 'Wheat Seed', tier: 1 }),
          node({ name: 'River Darter', tier: 1 }),
          node({ name: 'Deer Pelt', tier: 1 }),
          node({ name: 'Simple Plank', tier: 2 }),
        ],
      }),
    ]);

    const items = flattenPlan(codex);

    expect(findItem(items, 'Rough Stone Chunk').activity).toBe('Mining');
    expect(findItem(items, 'Oak Trunk').activity).toBe('Logging');
    expect(findItem(items, 'Wild Berry').activity).toBe('Foraging');
    expect(findItem(items, 'Wheat Seed').activity).toBe('Farming');
    expect(findItem(items, 'River Darter').activity).toBe('Fishing');
    expect(findItem(items, 'Deer Pelt').activity).toBe('Hunting');
    expect(findItem(items, 'Simple Plank').activity).toBe('Crafting');
  });

  it('returns empty array for empty codex', () => {
    const codex = makeCodex([]);
    expect(flattenPlan(codex)).toEqual([]);
  });

  it('sorts by deficit descending', () => {
    const codex = makeCodex([
      node({
        name: 'Research A',
        tier: 5,
        trackable: false,
        mappingType: 'research',
        children: [
          node({ name: 'Small', tier: 1, required: 10, have: 5 }),
          node({ name: 'Big', tier: 1, required: 1000, have: 0 }),
          node({ name: 'Medium', tier: 1, required: 100, have: 0 }),
        ],
      }),
    ]);

    const items = flattenPlan(codex);
    expect(items[0].name).toBe('Big');
    expect(items[1].name).toBe('Medium');
    expect(items[2].name).toBe('Small');
  });
});

// =============================================================================
// calculatePlanProgress
// =============================================================================

describe('calculatePlanProgress', () => {
  it('calculates aggregate progress', () => {
    const items: PlanItem[] = [
      {
        name: 'A',
        tier: 1,
        required: 100,
        have: 50,
        deficit: 50,
        pctComplete: 50,
        activity: 'Mining',
        actionable: true,
        mappingType: 'gathered',
      },
      {
        name: 'B',
        tier: 1,
        required: 100,
        have: 100,
        deficit: 0,
        pctComplete: 100,
        activity: 'Mining',
        actionable: true,
        mappingType: 'gathered',
      },
    ];

    const progress = calculatePlanProgress(items);
    expect(progress.percent).toBe(75);
    expect(progress.totalItems).toBe(2);
    expect(progress.completeCount).toBe(1);
    expect(progress.totalRequired).toBe(200);
    expect(progress.totalContribution).toBe(150);
  });

  it('returns 100% for empty list', () => {
    expect(calculatePlanProgress([]).percent).toBe(100);
  });
});

// =============================================================================
// generatePlanCSV
// =============================================================================

describe('generatePlanCSV', () => {
  it('groups by activity and skips complete items', () => {
    const items: PlanItem[] = [
      {
        name: 'Clay Lump',
        tier: 1,
        required: 100,
        have: 0,
        deficit: 100,
        pctComplete: 0,
        activity: 'Mining',
        actionable: true,
        mappingType: 'gathered',
      },
      {
        name: 'Oak Trunk',
        tier: 1,
        required: 50,
        have: 50,
        deficit: 0,
        pctComplete: 100,
        activity: 'Logging',
        actionable: true,
        mappingType: 'gathered',
      },
      {
        name: 'Simple Plank',
        tier: 2,
        required: 200,
        have: 50,
        deficit: 150,
        pctComplete: 25,
        activity: 'Crafting',
        actionable: false,
        mappingType: 'likely_api',
      },
    ];

    const csv = generatePlanCSV(items);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('activity,name,tier,required,have,deficit');
    expect(lines).toHaveLength(3); // header + 2 items with deficit
    expect(lines[1]).toContain('Mining');
    expect(lines[2]).toContain('Crafting');
    // Oak Trunk (deficit 0) should not appear
    expect(csv).not.toContain('Oak Trunk');
  });
});

// =============================================================================
// helper
// =============================================================================

/** Find item by name or fail the test. */
function findItem(items: PlanItem[], name: string): PlanItem {
  const item = items.find((i) => i.name === name);
  expect(item, `Expected to find item "${name}"`).toBeDefined();
  return item as PlanItem;
}
