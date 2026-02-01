import { describe, expect, it } from 'vitest';
import {
    getStation,
    getStationName,
    getAllStationTypes,
    getCraftableItemIds,
    getAllCraftableItemIds,
    getCraftableRecipes,
    getAllCraftableRecipes,
    getStationTiers,
    getStationTierCounts,
    findStationForItem,
    getStationSummary
} from '../station-data.js';
import type { StationsFile, RecipesFile } from '../types.js';

// =============================================================================
// TEST FIXTURES
// =============================================================================

const mockStations: StationsFile = {
    version: 1,
    generated: '2026-01-31',
    byType: {
        '20': {
            name: 'Carpentry Station',
            tiers: {
                '1': ['1003'],
                '2': ['1001', '1002', '2001'],
                '3': ['3001', '3002']
            }
        },
        '21': {
            name: 'Scholar Station',
            tiers: {
                '2': ['4001', '4002'],
                '3': ['4003']
            }
        },
        '25': {
            name: 'Smithing Station',
            tiers: {
                '2': ['5001'],
                '3': ['5002', '5003'],
                '4': ['5004']
            }
        }
    }
};

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
            inputs: [],
            station: { type: 20, tier: 2, name: 'Carpentry Station' },
            skill: null,
            tool: null
        },
        '1002': {
            id: '1002',
            name: 'Simple Stripped Wood',
            tier: 2,
            tag: 'Stripped Wood',
            yields: 1,
            inputs: [],
            station: { type: 20, tier: 2, name: 'Carpentry Station' },
            skill: null,
            tool: null
        },
        '1003': {
            id: '1003',
            name: 'Rough Plank',
            tier: 1,
            tag: 'Plank',
            yields: 1,
            inputs: [],
            station: { type: 20, tier: 1, name: 'Carpentry Station' },
            skill: null,
            tool: null
        },
        '5001': {
            id: '5001',
            name: 'Iron Pickaxe',
            tier: 3,
            tag: 'Pickaxe',
            yields: 1,
            inputs: [],
            station: { type: 25, tier: 2, name: 'Smithing Station' },
            skill: null,
            tool: null
        },
        '9999': {
            id: '9999',
            name: 'Gathered Item',
            tier: 1,
            tag: 'Trunk',
            yields: 1,
            inputs: [],
            station: null,
            skill: null,
            tool: null
        }
    },
    byKey: {}
};

// =============================================================================
// LOOKUPS
// =============================================================================

describe('getStation', () => {
    it('gets station by type ID', () => {
        const station = getStation(mockStations, 20);
        expect(station?.name).toBe('Carpentry Station');
        expect(Object.keys(station?.tiers ?? {})).toHaveLength(3);
    });

    it('returns null for unknown station type', () => {
        expect(getStation(mockStations, 999)).toBeNull();
    });
});

describe('getStationName', () => {
    it('gets station name', () => {
        expect(getStationName(mockStations, 20)).toBe('Carpentry Station');
        expect(getStationName(mockStations, 25)).toBe('Smithing Station');
    });

    it('returns null for unknown station', () => {
        expect(getStationName(mockStations, 999)).toBeNull();
    });
});

describe('getAllStationTypes', () => {
    it('returns all station type IDs', () => {
        const types = getAllStationTypes(mockStations);
        expect(types).toContain(20);
        expect(types).toContain(21);
        expect(types).toContain(25);
        expect(types).toHaveLength(3);
    });
});

// =============================================================================
// CRAFTABLE ITEMS
// =============================================================================

describe('getCraftableItemIds', () => {
    it('gets item IDs for station and tier', () => {
        const ids = getCraftableItemIds(mockStations, 20, 2);
        expect(ids).toHaveLength(3);
        expect(ids).toContain('1001');
        expect(ids).toContain('1002');
    });

    it('returns empty for non-existent tier', () => {
        const ids = getCraftableItemIds(mockStations, 20, 99);
        expect(ids).toHaveLength(0);
    });

    it('returns empty for non-existent station', () => {
        const ids = getCraftableItemIds(mockStations, 999, 1);
        expect(ids).toHaveLength(0);
    });
});

describe('getAllCraftableItemIds', () => {
    it('gets all item IDs for station across tiers', () => {
        const ids = getAllCraftableItemIds(mockStations, 20);
        expect(ids).toHaveLength(6); // 1 + 3 + 2
        expect(ids).toContain('1001');
        expect(ids).toContain('1003');
        expect(ids).toContain('3001');
    });

    it('returns empty for non-existent station', () => {
        const ids = getAllCraftableItemIds(mockStations, 999);
        expect(ids).toHaveLength(0);
    });
});

describe('getCraftableRecipes', () => {
    it('gets recipes for station and tier', () => {
        const recipes = getCraftableRecipes(mockStations, mockRecipes, 20, 2);
        expect(recipes).toHaveLength(2); // Only 1001 and 1002 exist in mockRecipes
        expect(recipes.map(r => r.name)).toContain('Simple Plank');
    });

    it('filters out IDs not in recipes', () => {
        // Station has 3 items at tier 2, but only 2 exist in mockRecipes
        const recipes = getCraftableRecipes(mockStations, mockRecipes, 20, 2);
        expect(recipes).toHaveLength(2);
    });
});

describe('getAllCraftableRecipes', () => {
    it('gets all recipes for station', () => {
        const recipes = getAllCraftableRecipes(mockStations, mockRecipes, 20);
        expect(recipes.length).toBeGreaterThan(0);
    });
});

// =============================================================================
// STATION QUERIES
// =============================================================================

describe('getStationTiers', () => {
    it('gets available tiers sorted ascending', () => {
        const tiers = getStationTiers(mockStations, 20);
        expect(tiers).toEqual([1, 2, 3]);
    });

    it('returns empty for non-existent station', () => {
        const tiers = getStationTiers(mockStations, 999);
        expect(tiers).toHaveLength(0);
    });
});

describe('getStationTierCounts', () => {
    it('returns item count per tier', () => {
        const counts = getStationTierCounts(mockStations, 20);
        expect(counts.get(1)).toBe(1);
        expect(counts.get(2)).toBe(3);
        expect(counts.get(3)).toBe(2);
    });

    it('returns empty map for non-existent station', () => {
        const counts = getStationTierCounts(mockStations, 999);
        expect(counts.size).toBe(0);
    });
});

describe('findStationForItem', () => {
    it('finds station for craftable item', () => {
        const station = findStationForItem(mockRecipes, '1001');
        expect(station?.type).toBe(20);
        expect(station?.tier).toBe(2);
        expect(station?.name).toBe('Carpentry Station');
    });

    it('returns null for gathered item (no station)', () => {
        const station = findStationForItem(mockRecipes, '9999');
        expect(station).toBeNull();
    });

    it('returns null for unknown item', () => {
        const station = findStationForItem(mockRecipes, 'unknown');
        expect(station).toBeNull();
    });
});

describe('getStationSummary', () => {
    it('returns summary of all stations', () => {
        const summary = getStationSummary(mockStations);
        
        expect(summary).toHaveLength(3);
        
        const carpentry = summary.find(s => s.type === 20);
        expect(carpentry?.name).toBe('Carpentry Station');
        expect(carpentry?.tierCount).toBe(3);
        expect(carpentry?.itemCount).toBe(6);
        
        const smithing = summary.find(s => s.type === 25);
        expect(smithing?.tierCount).toBe(3);
        expect(smithing?.itemCount).toBe(4);
    });
});