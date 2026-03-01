// @vitest-environment jsdom
/**
 * Copy Button Behavior Tests
 *
 * Spec:
 *   Dashboard tab:
 *     copy-view  → respects dashboard filters
 *     copy-all   → full plan, no filters
 *   Tree tab:
 *     copy-view  → only the active research branch
 *     copy-all   → full plan across all branches
 *   CSV:
 *     always full plan
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as PlannerView from '../planner-view.js';
import type { PlannerViewConfig } from '../planner-view.js';
import type { ProcessedNode, PlanItem } from '../../types/index.js';

// =============================================================================
// FIXTURES
// =============================================================================

function makeNode(overrides: Partial<ProcessedNode> = {}): ProcessedNode {
  return {
    name: overrides.name ?? 'Test Item',
    tier: overrides.tier ?? 2,
    recipeQty: 1,
    idealQty: 50,
    required: overrides.required ?? 50,
    have: overrides.have ?? 10,
    deficit: overrides.deficit ?? 40,
    contribution: 10,
    pctComplete: 20,
    status: overrides.status ?? 'partial',
    satisfied: false,
    satisfiedByParent: false,
    trackable: overrides.trackable ?? true,
    mappingType: overrides.mappingType ?? 'gathered',
    station: null,
    skill: null,
    children: overrides.children ?? [],
  };
}

function makeResearch(name: string, children: ProcessedNode[]): ProcessedNode {
  return makeNode({
    name,
    tier: 5,
    trackable: false,
    mappingType: 'research',
    children,
  });
}

function makePlanItem(overrides: Partial<PlanItem>): PlanItem {
  return {
    name: overrides.name ?? 'Test Item',
    tier: overrides.tier ?? 2,
    required: overrides.required ?? 100,
    have: overrides.have ?? 0,
    deficit: overrides.deficit ?? 100,
    pctComplete: overrides.pctComplete ?? 0,
    activity: overrides.activity ?? 'Crafting',
    actionable: overrides.actionable ?? true,
    mappingType: overrides.mappingType ?? 'gathered',
    stationType: overrides.stationType ?? null,
    skillName: overrides.skillName ?? null,
    skillLevel: overrides.skillLevel ?? null,
  };
}

/**
 * Config with two research branches that have DISTINCT items.
 * Stone branch has brick/sand, Wood branch has plank/trunk.
 * This lets us verify copy-view only exports one branch.
 */
function makeTwoResearchConfig(onTierChange: PlannerViewConfig['onTierChange']): PlannerViewConfig {
  return {
    claimId: 'test-claim-123',
    cityTier: 5,
    researches: [
      makeResearch('Advanced Stone Research', [
        makeNode({ name: 'Refined Brick', tier: 5, required: 100, have: 20, deficit: 80 }),
        makeNode({ name: 'Simple Sand', tier: 2, required: 200, have: 50, deficit: 150 }),
      ]),
      makeResearch('Advanced Wood Research', [
        makeNode({ name: 'Refined Plank', tier: 5, required: 100, have: 10, deficit: 90 }),
        makeNode({ name: 'Oak Trunk', tier: 2, required: 300, have: 0, deficit: 300 }),
      ]),
    ],
    planItems: [
      makePlanItem({ name: 'Refined Brick', tier: 5, deficit: 80 }),
      makePlanItem({ name: 'Simple Sand', tier: 2, deficit: 150, activity: 'Mining' }),
      makePlanItem({ name: 'Refined Plank', tier: 5, deficit: 90 }),
      makePlanItem({ name: 'Oak Trunk', tier: 2, deficit: 300, activity: 'Logging' }),
    ],
    targetTier: 6,
    studyJournals: makeNode({
      name: 'Advanced Study Journal',
      tier: 5,
      mappingType: 'study_material',
    }),
    tierOptions: [3, 4, 5, 6, 7, 8, 9, 10],
    currentTier: 6,
    codexCount: 25,
    codexInfo: '25\u00d7 T5 Codex',
    playerFilter: null,
    onTierChange,
    citizens: null,
    activePlayerId: null,
    onPlayerChange: () => {
      return null;
    },
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function clickTab(container: HTMLElement, viewName: 'dashboard' | 'flowchart'): void {
  const tab = container.querySelector(`.pv-tab[data-view="${viewName}"]`) as HTMLElement;
  tab?.click();
}

function clickResearchTab(container: HTMLElement, index: number): void {
  const tabs = container.querySelectorAll('.pv-rtab');
  (tabs[index] as HTMLElement)?.click();
}

function getCopyText(container: HTMLElement, buttonId: string): string {
  const btn = container.querySelector(`#${buttonId}`) as HTMLElement;
  btn?.click();
  const calls = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls;
  return calls.length > 0 ? calls[calls.length - 1][0] : '';
}

// =============================================================================
// TESTS
// =============================================================================

describe('Copy button behavior on Tree tab', () => {
  let container: HTMLElement;
  const onTierChange = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    onTierChange.mockClear();

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn((_text: string) => Promise.resolve()),
      },
    });
  });

  it('copy-view on Tree tab exports only the active research branch', () => {
    PlannerView.render(container, makeTwoResearchConfig(onTierChange));
    clickTab(container, 'flowchart');

    // Default: first research tab (Stone) is active
    const text = getCopyText(container, 'pv-copy-view');

    // Should contain stone branch items
    expect(text).toContain('Refined Brick');
    expect(text).toContain('Simple Sand');

    // Should NOT contain wood branch items
    expect(text).not.toContain('Refined Plank');
    expect(text).not.toContain('Oak Trunk');
  });

  it('copy-view changes when switching research tabs', () => {
    PlannerView.render(container, makeTwoResearchConfig(onTierChange));
    clickTab(container, 'flowchart');

    // Switch to second research tab (Wood)
    clickResearchTab(container, 1);

    const text = getCopyText(container, 'pv-copy-view');

    // Should contain wood branch items
    expect(text).toContain('Refined Plank');
    expect(text).toContain('Oak Trunk');

    // Should NOT contain stone branch items
    expect(text).not.toContain('Refined Brick');
    expect(text).not.toContain('Simple Sand');
  });

  it('copy-all on Tree tab exports ALL branches', () => {
    PlannerView.render(container, makeTwoResearchConfig(onTierChange));
    clickTab(container, 'flowchart');

    const text = getCopyText(container, 'pv-copy-all');

    // Should contain items from both branches
    expect(text).toContain('Refined Brick');
    expect(text).toContain('Simple Sand');
    expect(text).toContain('Refined Plank');
    expect(text).toContain('Oak Trunk');
  });

  it('copy-view includes research name as header', () => {
    PlannerView.render(container, makeTwoResearchConfig(onTierChange));
    clickTab(container, 'flowchart');

    const text = getCopyText(container, 'pv-copy-view');

    // Should identify which research branch
    expect(text).toContain('Stone Research');
  });
});

describe('Copy button behavior on Dashboard tab', () => {
  let container: HTMLElement;
  const onTierChange = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn((_text: string) => Promise.resolve()),
      },
    });
  });

  it('copy-view on Dashboard includes all items (no filters active)', () => {
    PlannerView.render(container, makeTwoResearchConfig(onTierChange));
    // Default view is dashboard

    const text = getCopyText(container, 'pv-copy-view');

    expect(text).toContain('Refined Brick');
    expect(text).toContain('Refined Plank');
  });

  it('copy-all on Dashboard includes all items regardless of filters', () => {
    PlannerView.render(container, makeTwoResearchConfig(onTierChange));

    const text = getCopyText(container, 'pv-copy-all');

    expect(text).toContain('Refined Brick');
    expect(text).toContain('Refined Plank');
    expect(text).toContain('Oak Trunk');
    expect(text).toContain('Simple Sand');
  });
});
