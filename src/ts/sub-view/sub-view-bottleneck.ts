// Sub-view bottleneck calculator.
//
// For each output a profession produces, compute what we can craft and what
// limits production. Same math as food/supply panels, different scope.
//
// This is production-potential, not deficit-against-target. We show "you can
// make 12 T3 timber, bottleneck is plank" or "blocked: zero ore concentrate."
// Deficit-against-target requires planner integration (future).

import type { RecipesFile, RecipeEntry } from '../data/types.js';
import type { InventoryLookup } from '../types/index.js';
import type {
  BottleneckSummary,
  CellBottleneck,
  SubViewConfig,
} from '../components/sub-view/sub-view.types.js';
import type { ProfessionDef } from '../configuration/sub-view.js';
import { calcCraftable, normalizeInventory } from '../craftability-calc.js';

// result for a single output recipe at one tier
interface OutputCraft {
  tag: string;
  tier: number;
  canMake: number;
  bottleneck: string | null;
  have: number; // current stock of the output
}

// compute craftability for every output recipe in this profession
export function calcProfessionBottlenecks(
  profession: ProfessionDef,
  recipes: RecipesFile,
  rawInventory: InventoryLookup
): OutputCraft[] {
  const normalized = normalizeInventory(rawInventory);
  const outputTags = collectOutputTags(profession);
  const results: OutputCraft[] = [];

  for (const tag of outputTags) {
    // exact tag match -- "Plank" must not match "Refined Plank"
    const matching = findRecipesWithExactTag(recipes, tag);

    for (const recipe of matching) {
      if (recipe.inputs.length === 0) continue; // gathered, nothing to bottleneck

      const craft = calcCraftable(recipes, recipe.name, recipe.tier, normalized);
      const have = lookupStock(normalized, recipe.name, recipe.tier);

      results.push({
        tag: recipe.tag ?? tag,
        tier: recipe.tier,
        canMake: craft.canMake,
        bottleneck: craft.bottleneck,
        have,
      });
    }
  }

  return results;
}

// apply results onto a SubViewConfig (mutates in place)
// call before passing to createSubView or handle.update()
export function applyBottlenecks(config: SubViewConfig, results: OutputCraft[]): void {
  // status bar chips: outputs where production is blocked
  const chips: BottleneckSummary[] = [];
  const seen = new Set<string>();

  for (const r of results) {
    if (r.canMake > 0 || !r.bottleneck) continue;
    const key = `${r.bottleneck}:${r.tier}`;
    if (seen.has(key)) continue;
    seen.add(key);

    chips.push({
      name: r.bottleneck,
      tier: r.tier,
      need: 1, // at least 1 needed to unblock
      have: r.have,
      deficit: 1,
    });
  }
  config.bottlenecks = chips;

  // per-cell indicators on output rows
  for (const section of config.sections) {
    for (const row of section.rows) {
      if (row.cls !== 'output') continue;

      const matching = results.filter((r) => r.tag.toLowerCase() === row.key.toLowerCase());
      if (matching.length === 0) continue;

      const cellBottlenecks: Record<number, CellBottleneck> = {};
      for (const r of matching) {
        if (r.canMake === 0 && r.bottleneck) {
          cellBottlenecks[r.tier - 1] = { need: 1, deficit: 1 };
        }
      }

      if (Object.keys(cellBottlenecks).length > 0) {
        row.bottlenecks = cellBottlenecks;
      }
    }
  }
}

// -- helpers --

function collectOutputTags(profession: ProfessionDef): string[] {
  const tags: string[] = [];
  for (const section of profession.sections) {
    for (const row of section.rows) {
      if (row.cls === 'output') tags.push(row.key);
    }
  }
  return tags;
}

// exact tag match -- "Plank" matches tag "Plank", not "Refined Plank"
function findRecipesWithExactTag(recipes: RecipesFile, tag: string): RecipeEntry[] {
  const lower = tag.toLowerCase();
  const results: RecipeEntry[] = [];
  for (const recipe of Object.values(recipes.byId)) {
    if (recipe.tag?.toLowerCase() === lower) {
      results.push(recipe);
    }
  }
  return results.sort((a, b) => a.tier - b.tier);
}

// look up current stock, handles specifier normalization
function lookupStock(normalized: InventoryLookup, name: string, tier: number): number {
  const fullKey = `${name.toLowerCase()}:${tier}`;
  const have = normalized.get(fullKey);
  if (have !== undefined) return have;

  // try without specifier
  const stripped = name
    .replace(
      /\b(rough|basic|simple|sturdy|fine|exquisite|peerless|ornate|pristine|flawless|magnificent)\b/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return normalized.get(`${stripped}:${tier}`) ?? 0;
}
