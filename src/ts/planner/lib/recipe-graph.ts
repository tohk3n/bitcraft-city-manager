/**
 * Recipe Graph - Data access layer for normalized recipe data
 * 
 * Provides typed access to recipes.json and codex.json.
 * Designed for reuse across planner, inventory dashboard, and future features.
 */

import type {
    Recipe,
    RecipesFile,
    RecipeType,
    CodexFile,
    CodexTier,
    MappingType
} from '../../types.js';

// =============================================================================
// KEY UTILITIES
// =============================================================================

export function createKey(name: string, tier: number): string {
    return `${name}:${tier}`;
}

export function parseKey(key: string): { name: string; tier: number } | null {
    const match = key.match(/^(.+):(\d+)$/);
    if (!match) return null;
    return { name: match[1], tier: parseInt(match[2], 10) };
}

// =============================================================================
// TYPE MAPPING
// =============================================================================

const RECIPE_TO_MAPPING: Record<RecipeType, MappingType> = {
    gathered: 'gathered',
    intermediate: 'intermediate',
    refined: 'likely_api',
    research: 'research',
    study: 'study_material'
};

export function toMappingType(type: RecipeType): MappingType {
    return RECIPE_TO_MAPPING[type] ?? 'unknown';
}

export function isTrackable(type: RecipeType): boolean {
    return type === 'gathered' || type === 'refined' || type === 'study';
}

// =============================================================================
// DATA ACCESS
// =============================================================================

export function getRecipe(recipes: RecipesFile, key: string): Recipe | undefined {
    return recipes.recipes[key];
}

export function getCodexTier(codex: CodexFile, tier: number): CodexTier | undefined {
    return codex.tiers[String(tier)];
}

export function getAllRecipeKeys(recipes: RecipesFile): string[] {
    return Object.keys(recipes.recipes);
}

export function getRecipesByType(recipes: RecipesFile, type: RecipeType): Recipe[] {
    return Object.values(recipes.recipes).filter(r => r.type === type);
}