/**
 * Recipe Expander
 * 
 * Expands a codex tier into a full crafting tree with calculated quantities.
 * Pure function, no side effects. Phase 1 of the cascade algorithm.
 */

import type {
    ExpandedCodex,
    ExpandedNode,
    Recipe,
    RecipesFile,
    CodexFile,
    CodexResearch
} from '../../types.js';
import { getCodexTier, toMappingType, isTrackable } from './recipe-graph.js';

export function expandRecipes(
    codexFile: CodexFile,
    recipesFile: RecipesFile,
    tier: number,
    targetCount: number
): ExpandedCodex {
    const codexTier = getCodexTier(codexFile, tier);
    if (!codexTier) {
        throw new Error(`Codex tier ${tier} not found`);
    }

    return {
        name: codexTier.name,
        tier: codexTier.tier,
        targetCount,
        researches: codexTier.researches.map(research =>
            expandResearch(research, recipesFile.recipes, targetCount)
        )
    };
}

function expandResearch(
    research: CodexResearch,
    recipes: Record<string, Recipe>,
    targetCount: number
): ExpandedNode {
    const visited = new Set<string>();
    
    return {
        name: research.id,
        tier: research.tier,
        recipeQty: 1,
        idealQty: targetCount,
        trackable: false,
        mappingType: 'research',
        children: research.inputs.map(input =>
            expandRecipe(
                input.ref,
                recipes,
                input.qty * targetCount,
                input.qty,
                visited
            )
        )
    };
}

function expandRecipe(
    recipeKey: string,
    recipes: Record<string, Recipe>,
    totalNeeded: number,
    recipeQty: number,
    visited: Set<string>
): ExpandedNode {
    if (visited.has(recipeKey)) {
        throw new Error(`Cycle detected: ${recipeKey}`);
    }

    const recipe = recipes[recipeKey];
    if (!recipe) {
        throw new Error(`Recipe not found: ${recipeKey}`);
    }

    visited.add(recipeKey);

    // yields determines how many items one craft produces
    const craftsNeeded = Math.ceil(totalNeeded / recipe.yields);
    const idealQty = craftsNeeded * recipe.yields;

    return {
        name: recipe.name,
        tier: recipe.tier,
        recipeQty,
        idealQty,
        trackable: isTrackable(recipe.type),
        mappingType: toMappingType(recipe.type),
        children: recipe.inputs.map(input => {
            const branchVisited = new Set(visited);
            return expandRecipe(
                input.ref,
                recipes,
                input.qty * craftsNeeded,
                input.qty,
                branchVisited
            );
        })
    };
}