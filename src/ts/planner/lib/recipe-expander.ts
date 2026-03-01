/**
 * Recipe Expander
 *
 * Expands a codex tier into a full crafting tree with calculated quantities.
 * Pure function, no side effects. Phase 1 of the cascade algorithm.
 */

import type { ExpandedCodex, ExpandedNode, CodexFile, CodexResearch } from '../../types/index.js';
import type { RecipesFile, RecipeEntry } from '../../data/types.js';
import {
  getCodexTier,
  getRecipe,
  getRecipeById,
  toMappingType,
  isTrackable,
  categorizeForPlanner,
} from './recipe-graph.js';

// Tracks which cycles have already been logged this expansion run.
// Prevents the same "Rough Leather ↔ Refined Rough Leather" message
// from spamming the console once per research branch.
let reportedCycles = new Set<string>();

export function expandRecipes(
  codexFile: CodexFile,
  recipesFile: RecipesFile,
  tier: number,
  targetCount: number,
  gatheredSet: Set<string>
): ExpandedCodex {
  const codexTier = getCodexTier(codexFile, tier);
  if (!codexTier) {
    throw new Error(`Codex tier ${tier} not found`);
  }

  reportedCycles = new Set();

  return {
    name: codexTier.name,
    tier: codexTier.tier,
    targetCount,
    researches: codexTier.researches.map((research) =>
      expandResearch(research, recipesFile, targetCount, gatheredSet)
    ),
  };
}

function expandResearch(
  research: CodexResearch,
  recipes: RecipesFile,
  targetCount: number,
  gatheredSet: Set<string>
): ExpandedNode {
  return {
    name: research.id,
    tier: research.tier,
    recipeQty: 1,
    idealQty: targetCount,
    trackable: false,
    mappingType: 'research',
    station: null,
    skill: null,
    children: research.inputs.map((input) =>
      expandByKey(
        input.ref,
        recipes,
        input.qty * targetCount,
        input.qty,
        new Set<string>(),
        gatheredSet
      )
    ),
  };
}

function expandByKey(
  recipeKey: string,
  recipes: RecipesFile,
  totalNeeded: number,
  recipeQty: number,
  visited: Set<string>,
  gatheredSet: Set<string>
): ExpandedNode {
  const recipe = getRecipe(recipes, recipeKey);
  if (!recipe) {
    throw new Error(`Recipe not found: ${recipeKey}`);
  }

  return expandEntry(recipe, recipes, totalNeeded, recipeQty, visited, gatheredSet);
}

function expandById(
  id: string,
  recipes: RecipesFile,
  totalNeeded: number,
  recipeQty: number,
  visited: Set<string>,
  gatheredSet: Set<string>
): ExpandedNode {
  const recipe = getRecipeById(recipes, id);
  if (!recipe) {
    return {
      name: `Unknown (${id})`,
      tier: 0,
      recipeQty,
      idealQty: totalNeeded,
      trackable: true,
      mappingType: 'gathered',
      station: null,
      skill: null,
      children: [],
    };
  }

  return expandEntry(recipe, recipes, totalNeeded, recipeQty, visited, gatheredSet);
}

function expandEntry(
  recipe: RecipeEntry,
  recipes: RecipesFile,
  totalNeeded: number,
  recipeQty: number,
  visited: Set<string>,
  gatheredSet: Set<string>
): ExpandedNode {
  if (visited.has(recipe.id)) {
    if (!reportedCycles.has(recipe.id)) {
      reportedCycles.add(recipe.id);
      console.debug(`[Planner] Cycle in recipe data: ${recipe.name}:${recipe.tier} (${recipe.id})`);
    }
    return {
      name: recipe.name,
      tier: recipe.tier,
      recipeQty,
      idealQty: totalNeeded,
      trackable: false,
      mappingType: toMappingType(
        categorizeForPlanner(recipe, recipe.tag, gatheredSet.has(recipe.id))
      ),
      station: recipe.station ?? null,
      skill: recipe.skill ?? null,
      children: [],
    };
  }

  visited.add(recipe.id);

  const category = categorizeForPlanner(recipe, recipe.tag, gatheredSet.has(recipe.id));
  const craftsNeeded = Math.ceil(totalNeeded / recipe.yields);
  const idealQty = craftsNeeded * recipe.yields;

  return {
    name: recipe.name,
    tier: recipe.tier,
    recipeQty,
    idealQty,
    trackable: isTrackable(category),
    mappingType: toMappingType(category),
    station: recipe.station ?? null,
    skill: recipe.skill ?? null,
    children: recipe.inputs.map((input) => {
      const branchVisited = new Set(visited);
      return expandById(
        input.id,
        recipes,
        input.qty * craftsNeeded,
        input.qty,
        branchVisited,
        gatheredSet
      );
    }),
  };
}
