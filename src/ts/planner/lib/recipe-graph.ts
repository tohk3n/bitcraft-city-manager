/**
 * Recipe Graph - Bridge between planner and data layer
 *
 * Provides codex access and type mapping for the planner pipeline.
 * Recipe lookups delegate to src/ts/data/recipe-data.ts.
 */

import {
  getRecipe as dataGetRecipe,
  getRecipeById as dataGetRecipeById,
  categorize,
  isTrackable as dataIsTrackable,
} from '../../data/recipe-data.js';
import type { RecipesFile, RecipeEntry, ItemCategory } from '../../data/types.js';
import type { CodexFile, CodexTier, MappingType } from '../../types/index.js';

// =============================================================================
// CODEX ACCESS (unchanged — codex.json is planner-specific)
// =============================================================================

export function getCodexTier(codex: CodexFile, tier: number): CodexTier | undefined {
  return codex.tiers[String(tier)];
}

// =============================================================================
// RECIPE ACCESS (delegates to data layer)
// =============================================================================

export function getRecipe(recipes: RecipesFile, key: string): RecipeEntry | null {
  return dataGetRecipe(recipes, key);
}

export function getRecipeById(recipes: RecipesFile, id: string): RecipeEntry | null {
  return dataGetRecipeById(recipes, id);
}

// =============================================================================
// TYPE MAPPING
// =============================================================================

/**
 * Map ItemCategory to planner MappingType.
 * Preserves the existing MappingType contract for cascade-calc and UI.
 */
const CATEGORY_TO_MAPPING: Record<ItemCategory, MappingType> = {
  gathered: 'gathered',
  intermediate: 'intermediate',
  refined: 'likely_api',
  research: 'research',
  study: 'study_material',
  equipment: 'intermediate',
  tool: 'intermediate',
  food: 'intermediate',
  building: 'intermediate',
  other: 'unknown',
};

export function toMappingType(category: ItemCategory): MappingType {
  return CATEGORY_TO_MAPPING[category] ?? 'unknown';
}

/**
 * Trackable check using the data layer's definition.
 * gathered, refined, study → trackable. Everything else → not.
 */
export function isTrackable(category: ItemCategory): boolean {
  return dataIsTrackable(category);
}

/**
 * Categorize a recipe for the planner.
 * Combines tag matching + gathered set membership.
 */
export function categorizeForPlanner(
  recipe: RecipeEntry | null,
  tag: string | null,
  isGathered: boolean
): ItemCategory {
  return categorize(recipe, tag, isGathered);
}
