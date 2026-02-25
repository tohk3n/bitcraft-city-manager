import { describe, it, expect } from 'vitest';
import { generateTreeCSV } from '../lib/tree-csv.js';
import type { ProcessedNode } from '../../types/index.js';

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

describe('generateTreeCSV', () => {
  it('includes header row', () => {
    const csv = generateTreeCSV([], null);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'research,depth,parent,name,tier,required,have,deficit,pctComplete,status,trackable,mappingType'
    );
  });

  it('walks full tree depth', () => {
    const researches = [
      node({
        name: 'Advanced Stone Research',
        tier: 5,
        trackable: false,
        mappingType: 'research',
        children: [
          node({
            name: 'Refined Brick',
            tier: 5,
            mappingType: 'likely_api',
            children: [
              node({ name: 'Clay Lump', tier: 1, mappingType: 'gathered' }),
              node({ name: 'Sand', tier: 1, mappingType: 'gathered' }),
            ],
          }),
        ],
      }),
    ];

    const csv = generateTreeCSV(researches, null);
    const lines = csv.split('\n');

    // header + research + brick + clay + sand = 5 lines
    expect(lines).toHaveLength(5);

    // Research root: depth 0, no parent
    expect(lines[1]).toContain('Advanced Stone Research,0,,Advanced Stone Research');

    // Refined Brick: depth 1, parent is research
    expect(lines[2]).toContain(',1,Advanced Stone Research,Refined Brick');

    // Clay Lump: depth 2, parent is brick
    expect(lines[3]).toContain(',2,Refined Brick,Clay Lump');
  });

  it('includes non-trackable nodes', () => {
    const researches = [
      node({
        name: 'Research A',
        tier: 5,
        trackable: false,
        mappingType: 'research',
        children: [
          node({
            name: 'Intermediate',
            tier: 3,
            trackable: false,
            mappingType: 'intermediate',
            children: [node({ name: 'Leaf Item', tier: 1 })],
          }),
        ],
      }),
    ];

    const csv = generateTreeCSV(researches, null);
    // All 3 nodes present, including non-trackable intermediate
    expect(csv).toContain('Intermediate');
    expect(csv).toContain(',false,intermediate');
  });

  it('includes study journals as separate section', () => {
    const researches = [
      node({ name: 'Research A', tier: 5, trackable: false, mappingType: 'research' }),
    ];
    const journals = node({
      name: 'Study Journals',
      tier: 5,
      mappingType: 'study_material',
      children: [node({ name: 'Parchment', tier: 2 })],
    });

    const csv = generateTreeCSV(researches, journals);
    const lines = csv.split('\n');

    // header + research + journals root + parchment = 4
    expect(lines).toHaveLength(4);
    expect(lines[2]).toContain('Study Journals,0,,Study Journals');
    expect(lines[3]).toContain('Study Journals,1,Study Journals,Parchment');
  });

  it('does not deduplicate — same item under different parents appears twice', () => {
    const researches = [
      node({
        name: 'Research A',
        tier: 5,
        trackable: false,
        mappingType: 'research',
        children: [
          node({
            name: 'Brick',
            tier: 3,
            children: [node({ name: 'Clay', tier: 1 })],
          }),
          node({
            name: 'Plank',
            tier: 3,
            children: [node({ name: 'Clay', tier: 1 })],
          }),
        ],
      }),
    ];

    const csv = generateTreeCSV(researches, null);
    const clayLines = csv.split('\n').filter((l) => l.includes(',Clay,'));
    expect(clayLines).toHaveLength(2);
  });

  it('escapes commas in names', () => {
    const researches = [
      node({
        name: 'Research, Advanced',
        tier: 5,
        trackable: false,
        mappingType: 'research',
      }),
    ];

    const csv = generateTreeCSV(researches, null);
    expect(csv).toContain('"Research, Advanced"');
  });
});
