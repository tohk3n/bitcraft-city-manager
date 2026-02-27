// @vitest-environment jsdom
/**
 * Planner View — Idempotence Tests
 *
 * These tests define the CORRECT behavior. Failures = bugs.
 * Each test is a user story: "I do X, I expect Y."
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as PlannerView from '../planner-view.js';
import type { PlannerViewConfig } from '../planner-view.js';
import type { ProcessedNode, PlanItem } from '../../types/index.js';

// =============================================================================
// FIXTURES — minimal but structurally complete
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
  };
}

/** Two distinct tier configs to simulate tier switching */
function makeTier5Config(onTierChange: PlannerViewConfig['onTierChange']): PlannerViewConfig {
  return {
    researches: [
      makeResearch('Advanced Stone Research', [makeNode({ name: 'Refined Brick', tier: 5 })]),
      makeResearch('Advanced Wood Research', [makeNode({ name: 'Refined Plank', tier: 5 })]),
    ],
    planItems: [
      makePlanItem({
        name: 'Refined Brick',
        tier: 5,
        required: 100,
        have: 20,
        deficit: 80,
        pctComplete: 20,
      }),
      makePlanItem({
        name: 'Refined Plank',
        tier: 5,
        required: 100,
        have: 50,
        deficit: 50,
        pctComplete: 50,
      }),
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
    onTierChange,
  };
}

function makeTier3Config(onTierChange: PlannerViewConfig['onTierChange']): PlannerViewConfig {
  return {
    researches: [
      makeResearch('Essential Stone Research', [makeNode({ name: 'Sturdy Brick', tier: 3 })]),
      makeResearch('Essential Wood Research', [makeNode({ name: 'Sturdy Plank', tier: 3 })]),
      makeResearch('Essential Metal Research', [makeNode({ name: 'Emarium Ingot', tier: 3 })]),
    ],
    planItems: [
      makePlanItem({
        name: 'Sturdy Brick',
        tier: 3,
        required: 60,
        have: 0,
        deficit: 60,
        pctComplete: 0,
      }),
    ],
    targetTier: 4,
    studyJournals: makeNode({
      name: 'Essential Study Journal',
      tier: 3,
      mappingType: 'study_material',
    }),
    tierOptions: [3, 4, 5, 6, 7, 8, 9, 10],
    currentTier: 4,
    codexCount: 15,
    codexInfo: '15\u00d7 T3 Codex',
    onTierChange,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function getContainer(): HTMLElement {
  return document.createElement('div');
}

/** Simulate user clicking a tab button inside the rendered planner */
function clickTab(container: HTMLElement, viewName: 'dashboard' | 'flowchart'): void {
  const tab = container.querySelector(`.pv-tab[data-view="${viewName}"]`) as HTMLElement;
  expect(tab).not.toBeNull();
  tab?.click();
}

// =============================================================================
// BUG 1: FLOWCHART RERENDER ON TIER CHANGE
// =============================================================================

describe('Bug 1: Flowchart rerenders on tier change', () => {
  let container: HTMLElement;
  const onTierChange = vi.fn();

  beforeEach(() => {
    container = getContainer();
    onTierChange.mockClear();
  });

  it('renders flowchart content when currentView is flowchart', () => {
    PlannerView.render(container, makeTier5Config(onTierChange));
    clickTab(container, 'flowchart');

    const viewport = container.querySelector('#fc-viewport');
    expect(viewport).not.toBeNull();

    const tree = container.querySelector('#fc-tree');
    expect(tree).not.toBeNull();
    expect(tree?.children.length).toBeGreaterThan(0);
  });

  it('flowchart shows new data after full re-render with different config', () => {
    // Render T5, switch to flowchart
    PlannerView.render(container, makeTier5Config(onTierChange));
    clickTab(container, 'flowchart');

    const tree1 = container.querySelector('#fc-tree');
    expect(tree1?.innerHTML).toContain('Refined Brick');

    // Re-render with T3 config (what loadPlanner does after tier change)
    PlannerView.render(container, makeTier3Config(onTierChange));
    clickTab(container, 'flowchart');

    // Should show NEW data
    const tree2 = container.querySelector('#fc-tree');
    expect(tree2).not.toBeNull();
    expect(tree2?.innerHTML).toContain('Sturdy Brick');
    expect(tree2?.innerHTML).not.toContain('Refined Brick');
  });

  it('research tabs update for new tier', () => {
    // T5: 2 researches + journals = 3 tabs
    PlannerView.render(container, makeTier5Config(onTierChange));
    clickTab(container, 'flowchart');

    const tabs1 = container.querySelectorAll('.pv-rtab');
    expect(tabs1.length).toBe(3);

    // T3: 3 researches + journals = 4 tabs
    PlannerView.render(container, makeTier3Config(onTierChange));
    clickTab(container, 'flowchart');

    const tabs2 = container.querySelectorAll('.pv-rtab');
    expect(tabs2.length).toBe(4);
  });

  it('activeResearchIndex resets on re-render', () => {
    // Render T5, go to flowchart, select second research tab
    PlannerView.render(container, makeTier5Config(onTierChange));
    clickTab(container, 'flowchart');

    const secondTab = container.querySelectorAll('.pv-rtab')[1] as HTMLElement;
    secondTab?.click();
    expect(secondTab?.classList.contains('active')).toBe(true);

    // Re-render with T3 config
    PlannerView.render(container, makeTier3Config(onTierChange));
    clickTab(container, 'flowchart');

    // First research tab should be active (index reset to 0)
    const firstTab = container.querySelector('.pv-rtab') as HTMLElement;
    expect(firstTab?.classList.contains('active')).toBe(true);

    // Tree should show first research's content
    const tree = container.querySelector('#fc-tree');
    expect(tree?.innerHTML).toContain('Sturdy Brick');
  });
});

// =============================================================================
// BUG 2: SECOND CLAIM LOADS STALE DATA
// =============================================================================

describe('Bug 2: render() always reflects provided config', () => {
  let container: HTMLElement;
  const onTierChange = vi.fn();

  beforeEach(() => {
    container = getContainer();
  });

  it('consecutive renders show different data', () => {
    PlannerView.render(container, makeTier5Config(onTierChange));
    expect(container.innerHTML).toContain('T5 Codex');

    PlannerView.render(container, makeTier3Config(onTierChange));
    expect(container.innerHTML).toContain('T3 Codex');
    expect(container.innerHTML).not.toContain('T5 Codex');
  });

  it('progress bar updates on re-render', () => {
    PlannerView.render(container, makeTier5Config(onTierChange));
    const pct1 = container.querySelector('.pv-pct')?.textContent;

    PlannerView.render(container, makeTier3Config(onTierChange));
    const pct2 = container.querySelector('.pv-pct')?.textContent;

    expect(pct1).not.toBe(pct2);
    expect(pct2).toBe('0%');
  });
});

// =============================================================================
// BUG 3: COPY BUTTONS
// =============================================================================

describe('Bug 3: Copy buttons produce correct output', () => {
  let container: HTMLElement;
  const onTierChange = vi.fn();

  beforeEach(() => {
    container = getContainer();

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn((_text: string) => Promise.resolve()),
      },
    });
  });

  it('copy-view on dashboard produces non-empty text with correct tier', () => {
    PlannerView.render(container, makeTier5Config(onTierChange));

    const copyBtn = container.querySelector('#pv-copy-view') as HTMLElement;
    expect(copyBtn).not.toBeNull();
    copyBtn?.click();

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('T6 Upgrade');
  });

  it('copy-all on dashboard produces non-empty text', () => {
    PlannerView.render(container, makeTier5Config(onTierChange));

    const copyAllBtn = container.querySelector('#pv-copy-all') as HTMLElement;
    copyAllBtn?.click();

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('T6 Upgrade');
  });

  it('copy buttons produce non-empty output on flowchart tab', () => {
    PlannerView.render(container, makeTier5Config(onTierChange));
    clickTab(container, 'flowchart');

    const copyBtn = container.querySelector('#pv-copy-view') as HTMLElement;
    copyBtn?.click();

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('Refined Brick');
  });

  it('copy buttons reflect current data after re-render', () => {
    PlannerView.render(container, makeTier5Config(onTierChange));
    PlannerView.render(container, makeTier3Config(onTierChange));

    const copyBtn = container.querySelector('#pv-copy-view') as HTMLElement;
    copyBtn?.click();

    const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(text).toContain('T4 Upgrade');
    expect(text).toContain('Sturdy Brick');
    expect(text).not.toContain('Refined Brick');
  });

  it('CSV export uses current tier in filename', () => {
    PlannerView.render(container, makeTier5Config(onTierChange));

    const downloads: string[] = [];
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'a') {
        el.click = () => {
          downloads.push((el as HTMLAnchorElement).download);
        };
      }
      return el;
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
      /* noop */
    });

    const csvBtn = container.querySelector('#pv-export-csv') as HTMLElement;
    csvBtn?.click();

    expect(downloads.length).toBe(1);
    expect(downloads[0]).toContain('planner-t6');
  });
});

// =============================================================================
// IDEMPOTENCE — same input, same output, regardless of prior state
// =============================================================================

describe('Idempotence: render() is a pure function of its config', () => {
  const onTierChange = vi.fn();

  it('same config produces same DOM regardless of prior renders', () => {
    const config = makeTier5Config(onTierChange);

    // Render fresh
    const c1 = getContainer();
    PlannerView.render(c1, config);
    const html1 = c1.innerHTML;

    // Render after prior T3 render (potential state pollution)
    const c2 = getContainer();
    PlannerView.render(c2, makeTier3Config(onTierChange));
    PlannerView.render(c2, config);
    const html2 = c2.innerHTML;

    expect(html2).toBe(html1);
  });
});
