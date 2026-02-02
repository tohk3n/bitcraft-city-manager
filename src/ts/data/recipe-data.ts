/**
 * Recipe Data Utilities
 */

import type {
  RecipesFile,
  RecipeEntry,
  ItemCategory,
  ResolvedRecipe,
  ResolvedInput,
  ParsedKey,
  ItemKey,
} from './types.js';

// =============================================================================
// KEY UTILITIES
// =============================================================================

/**
 * Create a "Name:tier" key from components
 */
export function createKey(name: string, tier: number): string {
  return `${name}:${tier}`;
}

/**
 * Parse a "Name:tier" key into components
 */
export function parseKey(key: string): ParsedKey | null {
  const match = key.match(/^(.+):(\d+)$/);
  if (!match) return null;
  return { name: match[1], tier: parseInt(match[2], 10) };
}

/**
 * Check if a string looks like an ID (numeric) vs a key (contains colon)
 */
export function isId(key: ItemKey): boolean {
  return /^\d+$/.test(key);
}

// =============================================================================
// LOOKUPS
// =============================================================================

export function resolveId(recipes: RecipesFile, key: ItemKey): string | null {
  if (isId(key)) {
    return recipes.byId[key] ? key : null;
  }
  return recipes.byKey[key] ?? null;
}

export function getRecipe(recipes: RecipesFile, key: ItemKey): RecipeEntry | null {
  const id = resolveId(recipes, key);
  if (!id) return null;
  return recipes.byId[id] ?? null;
}

export function getRecipeById(recipes: RecipesFile, id: string): RecipeEntry | null {
  return recipes.byId[id] ?? null;
}

export function hasItem(recipes: RecipesFile, key: ItemKey): boolean {
  return resolveId(recipes, key) !== null;
}

export function getAllIds(recipes: RecipesFile): string[] {
  return Object.keys(recipes.byId);
}

export function getAllKeys(recipes: RecipesFile): string[] {
  return Object.keys(recipes.byKey);
}

// =============================================================================
// CATEGORY RULES (order matters - first match wins)
// =============================================================================

interface CategoryRule {
  category: ItemCategory;
  tags: string[]; // match if item tag contains any of these
}

const CATEGORY_RULES: CategoryRule[] = [
  { category: 'research', tags: ['research'] },
  { category: 'study', tags: ['journal', 'carvings', 'hieroglyph'] },
  { category: 'refined', tags: ['refined'] },
  {
    category: 'equipment',
    tags: ['armor', 'helm', 'boot', 'glove', 'ring', 'amulet', 'cape', 'belt'],
  },
  { category: 'tool', tags: ['axe', 'pickaxe', 'hammer', 'saw', 'knife', 'rod', 'hoe', 'chisel'] },
  { category: 'food', tags: ['meal', 'food', 'tea', 'soup', 'stew', 'pie'] },
];

// =============================================================================
// CATEGORIZATION
// =============================================================================

function matchCategory(tag: string): ItemCategory | null {
  const t = tag.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.tags.some((match) => t.includes(match))) {
      return rule.category;
    }
  }
  return null;
}

export function categorize(
  recipe: RecipeEntry | null,
  tag: string | null,
  isGathered: boolean
): ItemCategory {
  if (isGathered) return 'gathered';
  if (tag) {
    const matched = matchCategory(tag);
    if (matched) return matched;
  }
  if (recipe && recipe.inputs.length === 0) return 'gathered';
  return 'intermediate';
}

/**
 * Checks if an item is "trackable" for planner purposes.
 * Trackable items are leaf nodes for the count in inventory.
 */
export function isTrackable(category: ItemCategory): boolean {
  return category === 'gathered' || category === 'refined' || category === 'study';
}

// =============================================================================
// RESOLUTION
// =============================================================================

export function resolveRecipe(
  recipes: RecipesFile,
  key: ItemKey,
  gatheredSet: Set<string>
): ResolvedRecipe | null {
  const recipe = getRecipe(recipes, key);
  if (!recipe) return null;

  const isGathered = gatheredSet.has(recipe.id);
  const category = categorize(recipe, recipe.tag, isGathered);

  const resolvedInputs: ResolvedInput[] = recipe.inputs.map((input) => {
    const inputRecipe = getRecipeById(recipes, input.id);
    return {
      id: input.id,
      name: inputRecipe?.name ?? `Unknown (${input.id})`,
      tier: inputRecipe?.tier ?? 0,
      qty: input.qty,
    };
  });

  return {
    ...recipe,
    category,
    inputs: resolvedInputs,
  };
}

// Get input recipes for an item (one level deep)
export function getInputRecipes(recipes: RecipesFile, key: ItemKey): RecipeEntry[] {
  const recipe = getRecipe(recipes, key);
  if (!recipe) return [];

  return recipe.inputs
    .map((input) => getRecipeById(recipes, input.id))
    .filter((r): r is RecipeEntry => r !== null);
}

// =============================================================================
// FILTERING
// =============================================================================

export function findRecipes(
  recipes: RecipesFile,
  predicate: (recipe: RecipeEntry) => boolean
): RecipeEntry[] {
  return Object.values(recipes.byId).filter(predicate);
}

export function findByTag(recipes: RecipesFile, tagMatch: string): RecipeEntry[] {
  const lower = tagMatch.toLowerCase();
  return findRecipes(recipes, (r) => r.tag?.toLowerCase().includes(lower) ?? false);
}

export function findByTier(recipes: RecipesFile, tier: number): RecipeEntry[] {
  return findRecipes(recipes, (r) => r.tier === tier);
}

export function findByStation(recipes: RecipesFile, stationType: number): RecipeEntry[] {
  return findRecipes(recipes, (r) => r.station?.type === stationType);
}
