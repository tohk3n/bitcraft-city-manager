/**
 * Shared Resource Deficit Consistency Tests
 *
 * Models Silent's bug report: T5 tier push shows 110 Rough Braxite
 * in the flowchart but the actual requirement is 160.
 *
 * Tests that deficit numbers are consistent across:
 *   1. cascade-calc node.deficit (per-branch)
 *   2. flowchart's recalculated deficit (required - have)
 *   3. collectTrackableItems (aggregated across all branches)
 *   4. collectFirstTrackable (aggregated across all branches)
 *   5. Sum of per-branch node.deficit == global deficit
 */

import { describe, expect, it } from 'vitest';
import { applyCascade, collectTrackableItems, collectFirstTrackable } from '../lib/cascade-calc.js';
import type {
  ExpandedCodex,
  ExpandedNode,
  ProcessedNode,
  InventoryLookup,
} from '../../types/index.js';

// =============================================================================
// FIXTURES — Shared raw material across 3 research branches
// =============================================================================

// "Rough Braxite" appears as a leaf gathered resource in multiple researches
// via different intermediate parents, totaling 160 across all branches.
//
//   Research A → Intermediate A (qty 2) → Rough Braxite (qty 3 each = 60)
//   Research B → Intermediate B (qty 1) → Rough Braxite (qty 5 each = 50)
//   Research C → Intermediate C (qty 1) → Rough Braxite (qty 5 each = 50)
//                                                          total = 160

function makeLeaf(name: string, tier: number, idealQty: number, recipeQty: number): ExpandedNode {
  return {
    name,
    tier,
    recipeQty,
    idealQty,
    trackable: true,
    mappingType: 'gathered',
    station: null,
    skill: null,
    children: [],
  };
}

function makeIntermediate(
  name: string,
  tier: number,
  idealQty: number,
  recipeQty: number,
  children: ExpandedNode[]
): ExpandedNode {
  return {
    name,
    tier,
    recipeQty,
    idealQty,
    trackable: false,
    mappingType: 'intermediate',
    station: null,
    skill: null,
    children,
  };
}

function makeResearch(name: string, children: ExpandedNode[]): ExpandedNode {
  return {
    name,
    tier: 5,
    recipeQty: 1,
    idealQty: 10,
    trackable: false,
    mappingType: 'research',
    station: null,
    skill: null,
    children,
  };
}

function buildSharedBraxiteCodex(): ExpandedCodex {
  return {
    name: 'Advanced Codex',
    tier: 5,
    targetCount: 10,
    researches: [
      // Research A: needs 2 Intermediate A, each needs 3 Rough Braxite = 60
      makeResearch('Research A', [
        makeIntermediate('Intermediate A', 5, 20, 2, [makeLeaf('Rough Braxite', 5, 60, 3)]),
      ]),
      // Research B: needs 1 Intermediate B, each needs 5 Rough Braxite = 50
      makeResearch('Research B', [
        makeIntermediate('Intermediate B', 5, 10, 1, [makeLeaf('Rough Braxite', 5, 50, 5)]),
      ]),
      // Research C: needs 1 Intermediate C, each needs 5 Rough Braxite = 50
      makeResearch('Research C', [
        makeIntermediate('Intermediate C', 5, 10, 1, [makeLeaf('Rough Braxite', 5, 50, 5)]),
      ]),
    ],
  };
}

// Simulate what flowchart.ts renderNode does
function flowchartDeficit(node: ProcessedNode): number {
  return Math.max(0, node.required - node.have);
}

// Walk a processed tree to find all nodes with a given name
function findNodes(node: ProcessedNode, name: string): ProcessedNode[] {
  const results: ProcessedNode[] = [];
  if (node.name === name) results.push(node);
  for (const child of node.children) {
    results.push(...findNodes(child, name));
  }
  return results;
}

// =============================================================================
// TESTS
// =============================================================================

describe('Shared resource deficit consistency', () => {
  describe('zero inventory — pure tier push', () => {
    const inventory: InventoryLookup = new Map();
    const codex = buildSharedBraxiteCodex();
    const processed = applyCascade(codex, inventory);

    it('cascade-calc global: total Rough Braxite required is 160', () => {
      const trackable = collectTrackableItems(processed);
      const braxite = trackable.find((i) => i.name === 'Rough Braxite');

      expect(braxite).toBeDefined();
      expect(braxite?.required).toBe(160);
      expect(braxite?.deficit).toBe(160);
    });

    it('collectFirstTrackable: total deficit is 160', () => {
      const first = collectFirstTrackable(processed);
      const braxite = first.find((i) => i.name === 'Rough Braxite');

      expect(braxite).toBeDefined();
      expect(braxite?.required).toBe(160);
      expect(braxite?.deficit).toBe(160);
    });

    it('per-branch node.deficit sums to 160', () => {
      let totalCascadeDeficit = 0;
      for (const research of processed.researches) {
        const braxiteNodes = findNodes(research, 'Rough Braxite');
        for (const node of braxiteNodes) {
          totalCascadeDeficit += node.deficit;
        }
      }

      expect(totalCascadeDeficit).toBe(160);
    });

    it('per-branch node.required sums to 160', () => {
      let totalRequired = 0;
      for (const research of processed.researches) {
        const braxiteNodes = findNodes(research, 'Rough Braxite');
        for (const node of braxiteNodes) {
          totalRequired += node.required;
        }
      }

      expect(totalRequired).toBe(160);
    });

    it('flowchart recalculated deficit matches node.deficit per branch', () => {
      // This is the suspected bug: flowchart uses (required - have)
      // instead of node.deficit
      for (const research of processed.researches) {
        const braxiteNodes = findNodes(research, 'Rough Braxite');
        for (const node of braxiteNodes) {
          const fcDeficit = flowchartDeficit(node);
          expect(fcDeficit).toBe(node.deficit);
        }
      }
    });

    it('flowchart per-branch deficits sum to global deficit', () => {
      let totalFcDeficit = 0;
      for (const research of processed.researches) {
        const braxiteNodes = findNodes(research, 'Rough Braxite');
        for (const node of braxiteNodes) {
          totalFcDeficit += flowchartDeficit(node);
        }
      }

      expect(totalFcDeficit).toBe(160);
    });
  });

  describe('partial inventory — have 40 Rough Braxite', () => {
    const inventory: InventoryLookup = new Map([['rough braxite:5', 40]]);
    const codex = buildSharedBraxiteCodex();
    const processed = applyCascade(codex, inventory);

    it('cascade-calc global: deficit is 120', () => {
      const trackable = collectTrackableItems(processed);
      const braxite = trackable.find((i) => i.name === 'Rough Braxite');

      expect(braxite).toBeDefined();
      expect(braxite?.required).toBe(160);
      expect(braxite?.have).toBe(40);
      expect(braxite?.deficit).toBe(120);
    });

    it('per-branch node.deficit sums to global deficit (120)', () => {
      let totalCascadeDeficit = 0;
      for (const research of processed.researches) {
        const braxiteNodes = findNodes(research, 'Rough Braxite');
        for (const node of braxiteNodes) {
          totalCascadeDeficit += node.deficit;
        }
      }

      expect(totalCascadeDeficit).toBe(120);
    });

    it('DIVERGENCE CHECK: flowchart deficit vs node.deficit per branch', () => {
      // With partial inventory, flowchart's (required - have) will diverge
      // because node.have is the GLOBAL 40, but node.required is branch-local.
      //
      // Branch A: required=60, have=40 → fc says 20
      // Branch B: required=50, have=40 → fc says 10
      // Branch C: required=50, have=40 → fc says 10
      // Flowchart sum: 40  (WRONG — real deficit is 120)
      //
      // cascade-calc's node.deficit uses scale factor:
      //   scale = 120/160 = 0.75
      // Branch A: ceil(60 * 0.75) = 45
      // Branch B: ceil(50 * 0.75) = 38
      // Branch C: ceil(50 * 0.75) = 38
      // Cascade sum: 121 (rounding) — close to 120

      const cascadeDeficits: { branch: string; deficit: number }[] = [];
      const flowchartDeficits: { branch: string; deficit: number }[] = [];

      for (const research of processed.researches) {
        const braxiteNodes = findNodes(research, 'Rough Braxite');
        for (const node of braxiteNodes) {
          cascadeDeficits.push({ branch: research.name, deficit: node.deficit });
          flowchartDeficits.push({ branch: research.name, deficit: flowchartDeficit(node) });
        }
      }

      const cascadeTotal = cascadeDeficits.reduce((s, d) => s + d.deficit, 0);
      const flowchartTotal = flowchartDeficits.reduce((s, d) => s + d.deficit, 0);

      // Cascade should be close to 120 (may be 121 due to ceil rounding)
      expect(cascadeTotal).toBeGreaterThanOrEqual(120);
      expect(cascadeTotal).toBeLessThanOrEqual(121);

      // Flowchart will be wildly wrong because it double-counts the 40 have
      // across all 3 branches: each branch subtracts the full 40
      // 20 + 10 + 10 = 40 (should be 120)
      expect(flowchartTotal).not.toBe(cascadeTotal);

      // Document the actual flowchart bug magnitude
      console.log('CASCADE per-branch:', cascadeDeficits);
      console.log('FLOWCHART per-branch:', flowchartDeficits);
      console.log(`CASCADE total: ${cascadeTotal}, FLOWCHART total: ${flowchartTotal}`);
      console.log(`Flowchart underreports by: ${cascadeTotal - flowchartTotal}`);
    });

    it('each branch node.have equals global inventory (not per-branch share)', () => {
      // This is the root cause: every branch sees the full 40
      for (const research of processed.researches) {
        const braxiteNodes = findNodes(research, 'Rough Braxite');
        for (const node of braxiteNodes) {
          expect(node.have).toBe(40);
        }
      }
    });
  });

  describe('partial intermediate inventory — have 10 Intermediate A', () => {
    // If you've already crafted some intermediates, the cascade reduces
    // downstream requirements. This is correct behavior, but could look
    // like "wrong" numbers to a user comparing against the zero-inventory total.
    const inventory: InventoryLookup = new Map([['intermediate a:5', 10]]);
    const codex = buildSharedBraxiteCodex();
    const processed = applyCascade(codex, inventory);

    it('Research A braxite requirement is reduced (parent partially satisfied)', () => {
      const researchA = processed.researches[0];
      const braxiteNodes = findNodes(researchA, 'Rough Braxite');

      expect(braxiteNodes).toHaveLength(1);
      // Intermediate A: required=20, have=10, scale=0.5
      // So children get parentScale * 0.5
      // Braxite in A: required = ceil(60 * 0.5) = 30 (down from 60)
      expect(braxiteNodes[0].required).toBe(30);
    });

    it('Research B and C braxite are unaffected', () => {
      const researchB = processed.researches[1];
      const researchC = processed.researches[2];
      const bNodes = findNodes(researchB, 'Rough Braxite');
      const cNodes = findNodes(researchC, 'Rough Braxite');

      expect(bNodes[0].required).toBe(50);
      expect(cNodes[0].required).toBe(50);
    });

    it('global trackable total reflects reduced requirement', () => {
      const trackable = collectTrackableItems(processed);
      const braxite = trackable.find((i) => i.name === 'Rough Braxite');

      // 30 + 50 + 50 = 130 (not 160)
      expect(braxite).toBeDefined();
      expect(braxite?.required).toBe(130);
      expect(braxite?.deficit).toBe(130);
    });
  });
});
