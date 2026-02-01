import { describe, expect, it } from 'vitest';
import {
    createKey,
    parseKey,
    isId,
    resolveId,
    getRecipe,
    getRecipeById,
    hasItem,
    getAllIds,
    getAllKeys,
    categorize,
    isTrackable,
    resolveRecipe,
    getInputRecipes,
    findRecipes,
    findByTag,
    findByTier,
    findByStation
} from '../recipe-data.js';
import type { RecipesFile, RecipeEntry, ItemCategory } from '../types.js';

// =============================================================================
// TEST FIXTURES
// =============================================================================

const mockRecipes: RecipesFile = {
    version: 2,
    generated: '2026-01-31',
    source: 'test',
    byId: {
        '1001': {
            id: '1001',
            name: 'Simple Plank',
            tier: 2,
            tag: 'Plank',
            yields: 1,
            inputs: [{ id: '1002', qty: 1 }],
            station: { type: 20, tier: 2, name: 'Carpentry Station' },
            skill: { id: 3, name: 'Carpentry', level: 20 },
            tool: { type: 2, level: 2 }
        },
        '1002': {
            id: '1002',
            name: 'Simple Stripped Wood',
            tier: 2,
            tag: 'Stripped Wood',
            yields: 1,
            inputs: [{ id: '1003', qty: 3 }],
            station: { type: 20, tier: 2, name: 'Carpentry Station' },
            skill: { id: 3, name: 'Carpentry', level: 20 },
            tool: null
        },
        '1003': {
            id: '1003',
            name: 'Simple Wood Log',
            tier: 2,
            tag: 'Log',
            yields: 5,
            inputs: [{ id: '1004', qty: 1 }],
            station: { type: 20, tier: 1, name: 'Carpentry Station' },
            skill: { id: 2, name: 'Forestry', level: 10 },
            tool: null
        },
        '1004': {
            id: '1004',
            name: 'Simple Wood Trunk',
            tier: 2,
            tag: 'Trunk',
            yields: 1,
            inputs: [],
            station: null,
            skill: null,
            tool: null
        },
        '2001': {
            id: '2001',
            name: 'Refined Simple Plank',
            tier: 2,
            tag: 'Refined Plank',
            yields: 1,
            inputs: [{ id: '1001', qty: 5 }],
            station: { type: 20, tier: 2, name: 'Carpentry Station' },
            skill: { id: 3, name: 'Carpentry', level: 20 },
            tool: null
        },
        '3001': {
            id: '3001',
            name: 'Novice Study Journal',
            tier: 2,
            tag: 'Journal',
            yields: 1,
            inputs: [],
            station: { type: 21, tier: 2, name: 'Scholar Station' },
            skill: { id: 7, name: 'Scholar', level: 20 },
            tool: null
        },
        '4001': {
            id: '4001',
            name: "Novice's Wood Research",
            tier: 2,
            tag: 'Wood Research',
            yields: 1,
            inputs: [{ id: '2001', qty: 1 }, { id: '3001', qty: 1 }],
            station: { type: 21, tier: 2, name: 'Scholar Station' },
            skill: { id: 7, name: 'Scholar', level: 20 },
            tool: null
        }
    },
    byKey: {
        'Simple Plank:2': '1001',
        'Simple Stripped Wood:2': '1002',
        'Simple Wood Log:2': '1003',
        'Simple Wood Trunk:2': '1004',
        'Refined Simple Plank:2': '2001',
        'Novice Study Journal:2': '3001',
        "Novice's Wood Research:2": '4001'
    }
};

const mockGathered = new Set(['1004']);

// =============================================================================
// KEY UTILITIES
// =============================================================================

describe('createKey', () => {
    it('creates key from name and tier', () => {
        expect(createKey('Simple Plank', 2)).toBe('Simple Plank:2');
    });

    it('handles names with special characters', () => {
        expect(createKey("Novice's Wood Research", 2)).toBe("Novice's Wood Research:2");
    });

    it('handles tier 0', () => {
        expect(createKey('Basic Item', 0)).toBe('Basic Item:0');
    });
});

describe('parseKey', () => {
    it('parses valid key', () => {
        expect(parseKey('Simple Plank:2')).toEqual({ name: 'Simple Plank', tier: 2 });
    });

    it('handles names with colons', () => {
        // Edge case: name contains colon - should match last colon
        expect(parseKey('Item: Special:3')).toEqual({ name: 'Item: Special', tier: 3 });
    });

    it('returns null for invalid key', () => {
        expect(parseKey('no-tier-here')).toBeNull();
        expect(parseKey('')).toBeNull();
        expect(parseKey('Item:abc')).toBeNull();
    });
});

describe('isId', () => {
    it('returns true for numeric strings', () => {
        expect(isId('1001')).toBe(true);
        expect(isId('2020003')).toBe(true);
    });

    it('returns false for keys', () => {
        expect(isId('Simple Plank:2')).toBe(false);
        expect(isId('abc123')).toBe(false);
    });
});

// =============================================================================
// LOOKUPS
// =============================================================================

describe('resolveId', () => {
    it('returns ID when given an ID', () => {
        expect(resolveId(mockRecipes, '1001')).toBe('1001');
    });

    it('resolves key to ID', () => {
        expect(resolveId(mockRecipes, 'Simple Plank:2')).toBe('1001');
    });

    it('returns null for unknown ID', () => {
        expect(resolveId(mockRecipes, '9999')).toBeNull();
    });

    it('returns null for unknown key', () => {
        expect(resolveId(mockRecipes, 'Unknown Item:5')).toBeNull();
    });
});

describe('getRecipe', () => {
    it('gets recipe by ID', () => {
        const recipe = getRecipe(mockRecipes, '1001');
        expect(recipe?.name).toBe('Simple Plank');
    });

    it('gets recipe by key', () => {
        const recipe = getRecipe(mockRecipes, 'Simple Plank:2');
        expect(recipe?.name).toBe('Simple Plank');
    });

    it('returns null for unknown item', () => {
        expect(getRecipe(mockRecipes, 'Unknown:1')).toBeNull();
    });
});

describe('getRecipeById', () => {
    it('gets recipe by ID directly', () => {
        const recipe = getRecipeById(mockRecipes, '1001');
        expect(recipe?.name).toBe('Simple Plank');
    });

    it('returns null for unknown ID', () => {
        expect(getRecipeById(mockRecipes, '9999')).toBeNull();
    });
});

describe('hasItem', () => {
    it('returns true for existing item', () => {
        expect(hasItem(mockRecipes, '1001')).toBe(true);
        expect(hasItem(mockRecipes, 'Simple Plank:2')).toBe(true);
    });

    it('returns false for unknown item', () => {
        expect(hasItem(mockRecipes, '9999')).toBe(false);
        expect(hasItem(mockRecipes, 'Unknown:1')).toBe(false);
    });
});

describe('getAllIds', () => {
    it('returns all recipe IDs', () => {
        const ids = getAllIds(mockRecipes);
        expect(ids).toContain('1001');
        expect(ids).toContain('1004');
        expect(ids).toHaveLength(7);
    });
});

describe('getAllKeys', () => {
    it('returns all recipe keys', () => {
        const keys = getAllKeys(mockRecipes);
        expect(keys).toContain('Simple Plank:2');
        expect(keys).toContain('Simple Wood Trunk:2');
        expect(keys).toHaveLength(7);
    });
});

// =============================================================================
// CATEGORIZATION
// =============================================================================

describe('categorize', () => {
    it('returns gathered for items in gathered set', () => {
        const recipe = getRecipe(mockRecipes, '1004');
        expect(categorize(recipe, recipe?.tag ?? null, true)).toBe('gathered');
    });

    it('returns gathered for items with no inputs', () => {
        const recipe = getRecipe(mockRecipes, '1004');
        expect(categorize(recipe, recipe?.tag ?? null, false)).toBe('gathered');
    });

    it('returns research for research tags', () => {
        const recipe = getRecipe(mockRecipes, '4001');
        expect(categorize(recipe, recipe?.tag ?? null, false)).toBe('research');
    });

    it('returns study for journal tags', () => {
        const recipe = getRecipe(mockRecipes, '3001');
        expect(categorize(recipe, recipe?.tag ?? null, false)).toBe('study');
    });

    it('returns refined for refined tags', () => {
        const recipe = getRecipe(mockRecipes, '2001');
        expect(categorize(recipe, recipe?.tag ?? null, false)).toBe('refined');
    });

    it('returns intermediate for other items with inputs', () => {
        const recipe = getRecipe(mockRecipes, '1001');
        expect(categorize(recipe, recipe?.tag ?? null, false)).toBe('intermediate');
    });

    it('returns intermediate for null tag', () => {
        const recipe = getRecipe(mockRecipes, '1001');
        expect(categorize(recipe, null, false)).toBe('intermediate');
    });
});

describe('isTrackable', () => {
    const trackableCases: [ItemCategory, boolean][] = [
        ['gathered', true],
        ['refined', true],
        ['study', true],
        ['intermediate', false],
        ['research', false],
        ['equipment', false],
        ['tool', false],
        ['food', false],
        ['building', false],
        ['other', false]
    ];

    it.each(trackableCases)('isTrackable(%s) returns %s', (category, expected) => {
        expect(isTrackable(category)).toBe(expected);
    });
});

// =============================================================================
// RESOLUTION
// =============================================================================

describe('resolveRecipe', () => {
    it('resolves recipe with input details', () => {
        const resolved = resolveRecipe(mockRecipes, 'Simple Plank:2', mockGathered);
        
        expect(resolved).not.toBeNull();
        expect(resolved?.name).toBe('Simple Plank');
        expect(resolved?.category).toBe('intermediate');
        expect(resolved?.inputs).toHaveLength(1);
        expect(resolved?.inputs[0].name).toBe('Simple Stripped Wood');
        expect(resolved?.inputs[0].tier).toBe(2);
        expect(resolved?.inputs[0].qty).toBe(1);
    });

    it('returns null for unknown item', () => {
        expect(resolveRecipe(mockRecipes, 'Unknown:1', mockGathered)).toBeNull();
    });

    it('marks gathered items correctly', () => {
        const resolved = resolveRecipe(mockRecipes, '1004', mockGathered);
        expect(resolved?.category).toBe('gathered');
    });
});

describe('getInputRecipes', () => {
    it('returns input recipes', () => {
        const inputs = getInputRecipes(mockRecipes, 'Simple Plank:2');
        
        expect(inputs).toHaveLength(1);
        expect(inputs[0].name).toBe('Simple Stripped Wood');
    });

    it('returns multiple inputs', () => {
        const inputs = getInputRecipes(mockRecipes, "Novice's Wood Research:2");
        
        expect(inputs).toHaveLength(2);
        expect(inputs.map(i => i.name)).toContain('Refined Simple Plank');
        expect(inputs.map(i => i.name)).toContain('Novice Study Journal');
    });

    it('returns empty array for gathered items', () => {
        const inputs = getInputRecipes(mockRecipes, '1004');
        expect(inputs).toHaveLength(0);
    });

    it('returns empty array for unknown item', () => {
        const inputs = getInputRecipes(mockRecipes, 'Unknown:1');
        expect(inputs).toHaveLength(0);
    });
});

// =============================================================================
// FILTERING
// =============================================================================

describe('findRecipes', () => {
    it('finds recipes matching predicate', () => {
        const results = findRecipes(mockRecipes, r => r.tier === 2);
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => r.tier === 2)).toBe(true);
    });

    it('returns empty array when no matches', () => {
        const results = findRecipes(mockRecipes, r => r.tier === 99);
        expect(results).toHaveLength(0);
    });
});

describe('findByTag', () => {
    it('finds recipes by tag (case-insensitive)', () => {
        const results = findByTag(mockRecipes, 'plank');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(r => r.name === 'Simple Plank')).toBe(true);
    });

    it('finds partial tag matches', () => {
        const results = findByTag(mockRecipes, 'research');
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe("Novice's Wood Research");
    });
});

describe('findByTier', () => {
    it('finds recipes by tier', () => {
        const results = findByTier(mockRecipes, 2);
        expect(results).toHaveLength(7);
    });

    it('returns empty for non-existent tier', () => {
        const results = findByTier(mockRecipes, 99);
        expect(results).toHaveLength(0);
    });
});

describe('findByStation', () => {
    it('finds recipes by station type', () => {
        const results = findByStation(mockRecipes, 20); // Carpentry
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => r.station?.type === 20)).toBe(true);
    });

    it('returns empty for non-existent station', () => {
        const results = findByStation(mockRecipes, 999);
        expect(results).toHaveLength(0);
    });
});