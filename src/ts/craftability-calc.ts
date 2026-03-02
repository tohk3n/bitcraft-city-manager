// Craftability Calculator - "what can I make with what I have?"
//
// Two jobs:
// 1. For food/generic items: given a name+tier, find the recipe, compute canMake
// 2. For supply cargo: find ALL recipes with a given tag, compute canMake for each
//
// Name normalization handles the specifier mismatch between inventory names
// (full API names like "Sturdy Plank") and recipe lookup keys. The inventory
// stores "Sturdy Plank:3" but recipe inputs reference items by ID which
// resolve to names that may or may not match casing.

import type { RecipesFile, RecipeEntry } from './data/types.js';
import { getRecipeById } from './data/recipe-data.js';
import type { InventoryLookup } from './types/index.js';
import { DASHBOARD_CONFIG } from './configuration/index.js';

// ---- Results ----

export interface CraftableResult {
  canMake: number;
  bottleneck: string | null;
  /** Detailed bottleneck: "plank (8 of 10 per)" */
  bottleneckDetail: string | null;
}

export interface SupplyRow {
  name: string; // recipe name like "Rough Timber"
  tier: number;
  label: string; // supply type label like "Timber"
  canMake: number;
  bottleneck: string | null;
  bottleneckDetail: string | null;
}

// ---- Name normalization ----
// Inventory keys use full API names. Normalize to lowercase for
// matching against recipe input names which may differ in casing.

const SPECIFIER_REGEX = new RegExp(`\\b(${DASHBOARD_CONFIG.SPECIFIER.join('|')})\\b`, 'gi');

function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeKey(name: string, tier: number): string {
  return `${normalizeName(name)}:${tier}`;
}

/**
 * Build a normalized inventory lookup from a raw one.
 * Also indexes without specifiers so "sturdy plank:3" and "plank:3"
 * both resolve. Needed because recipe inputs use base names but
 * inventory has specifier-prefixed names.
 */
export function normalizeInventory(raw: InventoryLookup): InventoryLookup {
  const normalized: InventoryLookup = new Map();
  for (const [key, qty] of raw) {
    const colonIdx = key.lastIndexOf(':');
    if (colonIdx === -1) continue;
    const name = key.slice(0, colonIdx);
    const tier = key.slice(colonIdx + 1);

    // Index under normalized full name
    const fullKey = `${normalizeName(name)}:${tier}`;
    normalized.set(fullKey, (normalized.get(fullKey) ?? 0) + qty);

    // Also index under specifier-stripped name
    const stripped = name.replace(SPECIFIER_REGEX, '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (stripped !== normalizeName(name)) {
      const strippedKey = `${stripped}:${tier}`;
      normalized.set(strippedKey, (normalized.get(strippedKey) ?? 0) + qty);
    }
  }
  return normalized;
}

// ---- Recipe lookup ----

/**
 * Find recipe by exact key match in byKey.
 * Tries the key as-is first, then lowercased variants.
 */
function findRecipeByKey(recipes: RecipesFile, name: string, tier: number): RecipeEntry | null {
  // Try exact key
  const exactKey = `${name}:${tier}`;
  const id = recipes.byKey[exactKey];
  if (id) return getRecipeById(recipes, id);

  // Try with specifier stripped (for inventory names -> recipe names)
  const baseName = name.replace(SPECIFIER_REGEX, '').replace(/\s+/g, ' ').trim();
  if (baseName !== name) {
    const baseKey = `${baseName}:${tier}`;
    const baseId = recipes.byKey[baseKey];
    if (baseId) return getRecipeById(recipes, baseId);
  }

  return null;
}

/**
 * Find ALL recipes with a given tag. Used for supply types where
 * names aren't predictable (e.g. "Ferralith Frames" for T1 Frame).
 */
function findRecipesByTag(recipes: RecipesFile, tag: string): RecipeEntry[] {
  const results: RecipeEntry[] = [];
  const lowerTag = tag.toLowerCase();
  for (const recipe of Object.values(recipes.byId)) {
    if (recipe.tag?.toLowerCase() === lowerTag && recipe.inputs.length > 0) {
      results.push(recipe);
    }
  }
  return results.sort((a, b) => a.tier - b.tier);
}

// ---- Core craftability math ----

function calcFromRecipe(
  recipe: RecipeEntry,
  recipes: RecipesFile,
  normalizedInv: InventoryLookup
): CraftableResult {
  let minBatches = Infinity;
  let bottleneck: string | null = null;
  let bottleneckDetail: string | null = null;

  for (const input of recipe.inputs) {
    const inputRecipe = recipes.byId[input.id];
    if (!inputRecipe) continue;

    // Try both full name and stripped name for lookup
    const fullKey = normalizeKey(inputRecipe.name, inputRecipe.tier);
    const strippedName = inputRecipe.name
      .replace(SPECIFIER_REGEX, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    const strippedKey = `${strippedName}:${inputRecipe.tier}`;

    const have = normalizedInv.get(fullKey) ?? normalizedInv.get(strippedKey) ?? 0;
    const batches = input.qty > 0 ? Math.floor(have / input.qty) : Infinity;

    if (batches < minBatches) {
      minBatches = batches;
      // Use the stripped display name for bottleneck
      const displayName = strippedName || normalizeName(inputRecipe.name);
      bottleneck = displayName;
      bottleneckDetail = `${displayName} (${have} of ${input.qty} per)`;
    }
  }

  if (minBatches === Infinity || minBatches === 0) {
    return { canMake: 0, bottleneck, bottleneckDetail };
  }

  return {
    canMake: minBatches * recipe.yields,
    bottleneck,
    bottleneckDetail,
  };
}

// ---- Public API ----

/**
 * How many of `name:tier` can we craft? For food panel items.
 */
export function calcCraftable(
  recipes: RecipesFile,
  name: string,
  tier: number,
  normalizedInv: InventoryLookup
): CraftableResult {
  const recipe = findRecipeByKey(recipes, name, tier);
  if (!recipe || recipe.inputs.length === 0) {
    return { canMake: 0, bottleneck: null, bottleneckDetail: null };
  }
  return calcFromRecipe(recipe, recipes, normalizedInv);
}

/**
 * Batch craftability for food panel items.
 * Returns Map keyed by original "name:tier" string.
 */
export function calcCraftableBatch(
  recipes: RecipesFile,
  items: { name: string; tier: number }[],
  rawInventory: InventoryLookup
): Map<string, CraftableResult> {
  const normalizedInv = normalizeInventory(rawInventory);
  const results = new Map<string, CraftableResult>();

  for (const item of items) {
    const key = `${item.name}:${item.tier}`;
    results.set(key, calcCraftable(recipes, item.name, item.tier, normalizedInv));
  }

  return results;
}

/**
 * Compute supply production potential for all supply types.
 *
 * Finds recipes by tag (Timber, Frame, Tarp, Brick Slab, Sheeting),
 * computes craftability for each tier found.
 */
export function calcSupplyPotential(
  recipes: RecipesFile,
  rawInventory: InventoryLookup
): SupplyRow[] {
  const normalizedInv = normalizeInventory(rawInventory);
  const rows: SupplyRow[] = [];

  for (const supplyType of DASHBOARD_CONFIG.SUPPLY_TYPES) {
    const tagRecipes = findRecipesByTag(recipes, supplyType.tag);

    for (const recipe of tagRecipes) {
      const craft = calcFromRecipe(recipe, recipes, normalizedInv);
      rows.push({
        name: recipe.name,
        tier: recipe.tier,
        label: supplyType.label,
        canMake: craft.canMake,
        bottleneck: craft.bottleneck,
        bottleneckDetail: craft.bottleneckDetail,
      });
    }
  }

  // Sort by label then tier
  rows.sort((a, b) => {
    if (a.label !== b.label) return a.label.localeCompare(b.label);
    return a.tier - b.tier;
  });

  return rows;
}
