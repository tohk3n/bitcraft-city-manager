import { describe, expect, it } from 'vitest';
import {
    getItemMeta,
    getItemMetaByKey,
    getMarketStats,
    calculateInventoryValue,
    getMarketItems,
    getEquipmentStats,
    findEquipment,
    findEquipmentBySlot,
    getToolStats,
    findTools,
    findToolsByType,
    getFoodStats,
    findFood,
    findFoodBySatiation,
    findItemsByTag,
    findItemsByTier,
    findItemsByRarity
} from '../item-data.js';
import type { ItemsMetaFile, RecipesFile } from '../types.js';

// =============================================================================
// TEST FIXTURES
// =============================================================================

const mockItemsMeta: ItemsMetaFile = {
    version: 1,
    generated: '2026-01-31',
    items: {
        '1001': {
            id: '1001',
            name: 'Simple Plank',
            tier: 2,
            tag: 'Plank',
            rarity: 1,
            volume: 600,
            market: {
                sellLow: 1,
                sellMed: 30,
                buyHigh: 21,
                buyMed: 7
            }
        },
        '1002': {
            id: '1002',
            name: 'Simple Stripped Wood',
            tier: 2,
            tag: 'Stripped Wood',
            rarity: 1,
            volume: 600
            // No market data
        },
        '5001': {
            id: '5001',
            name: 'Iron Pickaxe',
            tier: 3,
            tag: 'Pickaxe',
            rarity: 2,
            volume: 1200,
            tool: {
                type: 1,
                power: 15,
                durability: 500
            },
            market: {
                sellLow: 100,
                sellMed: 150,
                buyHigh: 120,
                buyMed: 80
            }
        },
        '5002': {
            id: '5002',
            name: 'Steel Pickaxe',
            tier: 4,
            tag: 'Pickaxe',
            rarity: 3,
            volume: 1200,
            tool: {
                type: 1,
                power: 25,
                durability: 800
            }
        },
        '6001': {
            id: '6001',
            name: 'Leather Helmet',
            tier: 2,
            tag: 'Helm',
            rarity: 1,
            volume: 300,
            equipment: [
                { slot: 1, power: 0, armor: 5, effects: [] }
            ]
        },
        '6002': {
            id: '6002',
            name: 'Iron Chestplate',
            tier: 3,
            tag: 'Armor',
            rarity: 2,
            volume: 800,
            equipment: [
                { slot: 2, power: 0, armor: 15, effects: [] }
            ]
        },
        '7001': {
            id: '7001',
            name: 'Roasted Meat',
            tier: 1,
            tag: 'Basic Food',
            rarity: 1,
            volume: 300,
            food: {
                satiation: 50,
                effects: []
            }
        },
        '7002': {
            id: '7002',
            name: 'Meat Stew',
            tier: 2,
            tag: 'Meal',
            rarity: 2,
            volume: 600,
            food: {
                satiation: 150,
                effects: []
            }
        }
    }
};

const mockRecipes: RecipesFile = {
    version: 2,
    generated: '2026-01-31',
    source: 'test',
    byId: {},
    byKey: {
        'Simple Plank:2': '1001',
        'Iron Pickaxe:3': '5001'
    }
};

// =============================================================================
// LOOKUPS
// =============================================================================

describe('getItemMeta', () => {
    it('gets item metadata by ID', () => {
        const meta = getItemMeta(mockItemsMeta, '1001');
        expect(meta?.name).toBe('Simple Plank');
        expect(meta?.tier).toBe(2);
    });

    it('returns null for unknown ID', () => {
        expect(getItemMeta(mockItemsMeta, '9999')).toBeNull();
    });
});

describe('getItemMetaByKey', () => {
    it('gets item metadata by key', () => {
        const meta = getItemMetaByKey(mockItemsMeta, mockRecipes, 'Simple Plank:2');
        expect(meta?.name).toBe('Simple Plank');
    });

    it('returns null for unknown key', () => {
        expect(getItemMetaByKey(mockItemsMeta, mockRecipes, 'Unknown:1')).toBeNull();
    });
});

// =============================================================================
// MARKET DATA
// =============================================================================

describe('getMarketStats', () => {
    it('gets market stats for item with market data', () => {
        const stats = getMarketStats(mockItemsMeta, '1001');
        expect(stats?.sellLow).toBe(1);
        expect(stats?.sellMed).toBe(30);
    });

    it('returns null for item without market data', () => {
        expect(getMarketStats(mockItemsMeta, '1002')).toBeNull();
    });

    it('returns null for unknown item', () => {
        expect(getMarketStats(mockItemsMeta, '9999')).toBeNull();
    });
});

describe('calculateInventoryValue', () => {
    it('calculates total value using default price type', () => {
        const inventory = new Map([
            ['1001', 10],  // Simple Plank: sellMed=30, 10*30=300
            ['5001', 2]    // Iron Pickaxe: sellMed=150, 2*150=300
        ]);
        
        const value = calculateInventoryValue(mockItemsMeta, inventory);
        expect(value).toBe(600);
    });

    it('calculates value using specified price type', () => {
        const inventory = new Map([
            ['1001', 10]  // Simple Plank: sellLow=1, 10*1=10
        ]);
        
        const value = calculateInventoryValue(mockItemsMeta, inventory, 'sellLow');
        expect(value).toBe(10);
    });

    it('ignores items without market data', () => {
        const inventory = new Map([
            ['1001', 10],  // Has market data
            ['1002', 100]  // No market data
        ]);
        
        const value = calculateInventoryValue(mockItemsMeta, inventory);
        expect(value).toBe(300); // Only 1001 counted
    });

    it('returns 0 for empty inventory', () => {
        const value = calculateInventoryValue(mockItemsMeta, new Map());
        expect(value).toBe(0);
    });
});

describe('getMarketItems', () => {
    it('returns items with market data, sorted by default', () => {
        const items = getMarketItems(mockItemsMeta);
        
        expect(items.length).toBeGreaterThan(0);
        expect(items.every(i => i.market !== undefined)).toBe(true);
        
        // Should be descending by sellMed by default
        for (let i = 1; i < items.length; i++) {
            expect(items[i - 1].market!.sellMed).toBeGreaterThanOrEqual(items[i].market!.sellMed);
        }
    });

    it('sorts ascending when specified', () => {
        const items = getMarketItems(mockItemsMeta, 'sellMed', false);
        
        for (let i = 1; i < items.length; i++) {
            expect(items[i - 1].market!.sellMed).toBeLessThanOrEqual(items[i].market!.sellMed);
        }
    });
});

// =============================================================================
// EQUIPMENT DATA
// =============================================================================

describe('getEquipmentStats', () => {
    it('gets equipment stats', () => {
        const stats = getEquipmentStats(mockItemsMeta, '6001');
        expect(stats).toHaveLength(1);
        expect(stats?.[0].slot).toBe(1);
        expect(stats?.[0].armor).toBe(5);
    });

    it('returns null for non-equipment item', () => {
        expect(getEquipmentStats(mockItemsMeta, '1001')).toBeNull();
    });
});

describe('findEquipment', () => {
    it('finds all equipment items', () => {
        const equipment = findEquipment(mockItemsMeta);
        expect(equipment).toHaveLength(2);
        expect(equipment.map(e => e.name)).toContain('Leather Helmet');
        expect(equipment.map(e => e.name)).toContain('Iron Chestplate');
    });
});

describe('findEquipmentBySlot', () => {
    it('finds equipment by slot', () => {
        const helmets = findEquipmentBySlot(mockItemsMeta, 1);
        expect(helmets).toHaveLength(1);
        expect(helmets[0].name).toBe('Leather Helmet');
    });

    it('returns empty for unused slot', () => {
        const items = findEquipmentBySlot(mockItemsMeta, 99);
        expect(items).toHaveLength(0);
    });
});

// =============================================================================
// TOOL DATA
// =============================================================================

describe('getToolStats', () => {
    it('gets tool stats', () => {
        const stats = getToolStats(mockItemsMeta, '5001');
        expect(stats?.type).toBe(1);
        expect(stats?.power).toBe(15);
        expect(stats?.durability).toBe(500);
    });

    it('returns null for non-tool item', () => {
        expect(getToolStats(mockItemsMeta, '1001')).toBeNull();
    });
});

describe('findTools', () => {
    it('finds all tool items', () => {
        const tools = findTools(mockItemsMeta);
        expect(tools).toHaveLength(2);
        expect(tools.map(t => t.name)).toContain('Iron Pickaxe');
        expect(tools.map(t => t.name)).toContain('Steel Pickaxe');
    });
});

describe('findToolsByType', () => {
    it('finds tools by type', () => {
        const pickaxes = findToolsByType(mockItemsMeta, 1);
        expect(pickaxes).toHaveLength(2);
    });

    it('returns empty for unused tool type', () => {
        const items = findToolsByType(mockItemsMeta, 99);
        expect(items).toHaveLength(0);
    });
});

// =============================================================================
// FOOD DATA
// =============================================================================

describe('getFoodStats', () => {
    it('gets food stats', () => {
        const stats = getFoodStats(mockItemsMeta, '7001');
        expect(stats?.satiation).toBe(50);
    });

    it('returns null for non-food item', () => {
        expect(getFoodStats(mockItemsMeta, '1001')).toBeNull();
    });
});

describe('findFood', () => {
    it('finds all food items', () => {
        const food = findFood(mockItemsMeta);
        expect(food).toHaveLength(2);
        expect(food.map(f => f.name)).toContain('Roasted Meat');
        expect(food.map(f => f.name)).toContain('Meat Stew');
    });
});

describe('findFoodBySatiation', () => {
    it('returns food sorted by satiation descending', () => {
        const food = findFoodBySatiation(mockItemsMeta);
        expect(food[0].name).toBe('Meat Stew'); // 150
        expect(food[1].name).toBe('Roasted Meat'); // 50
    });

    it('sorts ascending when specified', () => {
        const food = findFoodBySatiation(mockItemsMeta, false);
        expect(food[0].name).toBe('Roasted Meat'); // 50
        expect(food[1].name).toBe('Meat Stew'); // 150
    });
});

// =============================================================================
// GENERAL FILTERING
// =============================================================================

describe('findItemsByTag', () => {
    it('finds items by tag (case-insensitive)', () => {
        const items = findItemsByTag(mockItemsMeta, 'pickaxe');
        expect(items).toHaveLength(2);
    });

    it('finds partial matches', () => {
        const items = findItemsByTag(mockItemsMeta, 'food');
        expect(items).toHaveLength(1);
        expect(items[0].name).toBe('Roasted Meat');
    });
});

describe('findItemsByTier', () => {
    it('finds items by tier', () => {
        const items = findItemsByTier(mockItemsMeta, 2);
        expect(items.length).toBeGreaterThan(0);
        expect(items.every(i => i.tier === 2)).toBe(true);
    });
});

describe('findItemsByRarity', () => {
    it('finds items by rarity', () => {
        const items = findItemsByRarity(mockItemsMeta, 2);
        expect(items.length).toBeGreaterThan(0);
        expect(items.every(i => i.rarity === 2)).toBe(true);
    });
});