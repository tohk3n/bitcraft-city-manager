/**
 * Material Breakdown Calculator — Pure Math
 *
 * Given a recipe and a multiplier, recursively walks the recipe tree
 * and returns a flat list of every material needed at every depth.
 *
 * Same philosophy as craft-time-calc.ts: all the numbers, none of the pixels.
 * The view feeds it a recipe + count, gets back a breakdown. Done.
 *
 * Why not reuse recipe-expander? That module is tightly coupled to the codex
 * structure (researches, tiers, gatheredSet semantics). This is simpler:
 * one recipe in, flat material list out. The tree walk logic is similar
 * but the output shape is different enough to warrant its own module.
 */

import type { RecipesFile, RecipeEntry } from './data/types.js';
import { getRecipeById } from './data/recipe-data.js';

// =============================================================================
// TYPES
// =============================================================================

/** One line in the material breakdown */
export interface MaterialLine {
  id: string;
  name: string;
  tier: number;
  qty: number;
  /** true = leaf node (no sub-recipe, you gather/buy this) */
  isRaw: boolean;
  /** how many levels deep in the tree (0 = the root recipe's direct inputs) */
  depth: number;
}

/** Full breakdown result */
export interface MaterialBreakdown {
  recipe: { id: string; name: string; tier: number; yields: number };
  craftCount: number;
  /** Every material at every depth, preserving tree structure order */
  tree: MaterialLine[];
  /** Leaf materials only, deduplicated and summed. The shopping list. */
  totals: MaterialLine[];
}

// =============================================================================
// CORE
// =============================================================================

/**
 * Break down a recipe into all required materials.
 *
 * craftCount is the multiplier — "I want 10 of these".
 * Respects yields: if a recipe makes 2 per craft, you only need
 * ceil(10/2) = 5 crafts worth of inputs.
 */
export function breakdownMaterials(
  recipes: RecipesFile,
  recipeId: string,
  craftCount: number
): MaterialBreakdown | null {
  const root = getRecipeById(recipes, recipeId);
  if (!root) return null;

  const tree: MaterialLine[] = [];
  const rawTotals = new Map<string, MaterialLine>();

  walkTree(recipes, root, craftCount, 0, tree, rawTotals, new Set());

  // Sort totals by tier desc then name, puts high-tier stuff first
  const totals = Array.from(rawTotals.values()).sort(
    (a, b) => b.tier - a.tier || a.name.localeCompare(b.name)
  );

  return {
    recipe: { id: root.id, name: root.name, tier: root.tier, yields: root.yields },
    craftCount,
    tree,
    totals,
  };
}

// =============================================================================
// TREE WALK
// =============================================================================

/**
 * Recursive DFS through the recipe graph.
 *
 * visited tracks IDs to detect cycles in the data — shouldn't happen
 * but game data is game data. If we hit a cycle, treat the node as
 * a leaf so we don't infinite loop. Log it but don't crash.
 */
function walkTree(
  recipes: RecipesFile,
  entry: RecipeEntry,
  needed: number,
  depth: number,
  tree: MaterialLine[],
  rawTotals: Map<string, MaterialLine>,
  visited: Set<string>
): void {
  // yields > 1 means one craft produces multiple items
  const craftsNeeded = Math.ceil(needed / entry.yields);

  for (const input of entry.inputs) {
    const inputEntry = getRecipeById(recipes, input.id);
    const inputQty = input.qty * craftsNeeded;

    // Leaf node: no recipe found, or no inputs (raw resource), or cycle
    const isCycle = visited.has(input.id);
    const isRaw = !inputEntry || inputEntry.inputs.length === 0 || isCycle;

    if (isCycle) {
      console.warn(`[MaterialCalc] Cycle detected: ${input.id}, treating as leaf`);
    }

    const line: MaterialLine = {
      id: input.id,
      name: inputEntry?.name ?? `Unknown (${input.id})`,
      tier: inputEntry?.tier ?? 0,
      qty: inputQty,
      isRaw,
      depth,
    };

    tree.push(line);

    if (isRaw || !inputEntry) {
      // Aggregate into totals — same item might appear in multiple branches
      const existing = rawTotals.get(input.id);
      if (existing) {
        existing.qty += inputQty;
      } else {
        rawTotals.set(input.id, { ...line, depth: 0 });
      }
    } else {
      // Recurse into sub-recipe
      visited.add(input.id);
      walkTree(recipes, inputEntry, inputQty, depth + 1, tree, rawTotals, new Set(visited));
    }
  }
}
