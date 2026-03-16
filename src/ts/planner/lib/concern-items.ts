// Concern classification and tree-walking for the planner.
//
// Shared between the monitor drill-down and the tasks dashboard.
// Both need to walk ProcessedNode trees, classify items by concern,
// and render them in the same column vocabulary.

import type { ProcessedNode, MappingType } from '../../types/index.js';

// ── Types ─────────────────────────────────────────────────────────

export type Concern = 'gathered' | 'intermediate' | 'crafted' | 'refined' | 'scholar' | 'research';

export interface ConcernItem {
  name: string;
  shortName: string;
  tier: number;
  required: number;
  have: number;
  deficit: number;
  pctComplete: number;
  mappingType: MappingType;
  concern: Concern;
}

// ── Constants ─────────────────────────────────────────────────────

export const CONCERN_ORDER: Concern[] = [
  'gathered',
  'intermediate',
  'crafted',
  'refined',
  'scholar',
  'research',
];

// Accent colors for concern column headers (CSS variable references).
// Used by both monitor drill-down and dashboard concern columns.
export const CONCERN_COLORS: Record<Concern, string> = {
  gathered: 'var(--success)',
  intermediate: 'var(--accent)',
  crafted: 'var(--warning)',
  refined: 'var(--accent4)',
  scholar: 'var(--accent2)',
  research: 'var(--status-missing)',
};

const TIER_PREFIXES = [
  'Basic',
  'Simple',
  'Sturdy',
  'Fine',
  'Exquisite',
  'Rough',
  'Novice',
  'Essential',
  'Proficient',
  'Advanced',
  'Infused',
  'Refined',
  'Peerless',
  'Ornate',
  'Pristine',
  'Flawless',
  'Magnificent',
  "Beginner's",
  'Comprehensive',
];

// ── Public API ────────────────────────────────────────────────────

// Strip tier prefix from item name: "Sturdy Brick" -> "Brick"
export function toShortName(name: string): string {
  for (const prefix of TIER_PREFIXES) {
    if (name.startsWith(prefix + ' ')) return name.slice(prefix.length + 1);
  }
  return name;
}

// Classify a node into a concern column.
//
// The tricky one is 'likely_api'. The recipe pipeline assigns this to all
// items in the "refined" category, but parsing bitjita has TWO layers of crafts
// that both get this tag:
//   Rough Plank (mid-pipeline craft, feeds into the next step)
//   Refined Rough Plank (terminal output, goes directly into research)
export function toConcern(node: ProcessedNode): Concern {
  switch (node.mappingType) {
    case 'gathered':
    case 'mob_drop':
    case 'fish':
      return 'gathered';
    case 'intermediate':
      return 'intermediate';
    case 'likely_api':
      return node.name.startsWith('Refined ') ? 'refined' : 'crafted';
    case 'study_material':
    case 'reagent':
      return 'scholar';
    case 'research':
    case 'codex':
      return 'research';
    default:
      return 'crafted';
  }
}

// Walk a research tree and collect all material nodes as ConcernItems.
// Includes non-trackable intermediates, the scholar needs to see the
// full pipeline, not just the leaf gatherable items.
// Skips the research root node itself (that's the codex goal, not a material).
export function collectItemsFromTree(node: ProcessedNode): ConcernItem[] {
  const items: ConcernItem[] = [];

  function walk(n: ProcessedNode, isRoot: boolean): void {
    if (!isRoot && n.required > 0) {
      items.push({
        name: n.name,
        shortName: toShortName(n.name),
        tier: n.tier,
        required: n.required,
        have: n.have,
        deficit: Math.max(0, n.required - n.have),
        pctComplete:
          n.required > 0 ? Math.round((Math.min(n.have, n.required) / n.required) * 100) : 100,
        mappingType: n.mappingType,
        concern: toConcern(n),
      });
    }
    for (const child of n.children) walk(child, false);
  }

  walk(node, true);
  return items;
}
