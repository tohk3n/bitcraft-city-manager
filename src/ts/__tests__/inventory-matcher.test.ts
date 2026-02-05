import { describe, expect, it } from 'vitest';
import {
  normalizeName,
  createKey,
  buildInventoryLookup,
  buildMetaLookups,
} from '../../ts/planner/lib/inventory-matcher.js';
import type { ApiItem, ApiCargo, Building } from '../types/index.js';
import type { PackagesFile } from '../data/types.js';

// =============================================================================
// TEST FIXTURES
// =============================================================================

const mockItemMeta: Record<number, ApiItem> = {
  1001: { id: 1001, name: 'Simple Plank', tier: 2, tag: 'Plank' },
  1002: { id: 1002, name: 'Rough Stone Chunk', tier: 1, tag: 'Chunk' },
  1003: { id: 1003, name: 'Plant Fiber', tier: 1, tag: 'Fiber' },
};

const mockCargoMeta: Record<number, ApiCargo> = {
  550000: { id: 550000, name: 'Simple Plank Package', tier: 2, tag: 'Package' },
  550001: { id: 550001, name: 'Plant Fiber Package', tier: 1, tag: 'Package' },
  550099: { id: 550099, name: 'Supply Crate', tier: 1, tag: 'Supply' },
};

const mockPackages: PackagesFile = {
  version: 1,
  generated: '2026-02-04',
  byItemId: {
    '1001': { cargoId: '550000', quantity: 100, name: 'Simple Plank Package' },
    '1003': { cargoId: '550001', quantity: 1000, name: 'Plant Fiber Package' },
  },
  byCargoId: {
    '550000': { itemId: '1001', quantity: 100, name: 'Simple Plank' },
    '550001': { itemId: '1003', quantity: 1000, name: 'Plant Fiber' },
  },
};

const emptyPackages: PackagesFile = {
  version: 1,
  generated: '2026-02-04',
  byItemId: {},
  byCargoId: {},
};

function makeBuilding(name: string, slots: Building['inventory']): Building {
  return { buildingName: name, inventory: slots };
}

function makeSlot(itemId: number, itemType: 'item' | 'cargo', quantity: number) {
  return { contents: { item_id: itemId, item_type: itemType, quantity, rarity: 1 } };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

describe('normalizeName', () => {
  it('lowercases and trims', () => {
    expect(normalizeName('  Simple Plank  ')).toBe('simple plank');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeName('Rough   Stone  Chunk')).toBe('rough stone chunk');
  });
});

describe('createKey', () => {
  it('creates normalized name:tier key', () => {
    expect(createKey('Simple Plank', 2)).toBe('simple plank:2');
  });

  it('normalizes the name', () => {
    expect(createKey('  SIMPLE  PLANK  ', 2)).toBe('simple plank:2');
  });
});

// =============================================================================
// buildInventoryLookup
// =============================================================================

describe('buildInventoryLookup', () => {
  it('counts regular items by name:tier key', () => {
    const buildings = [
      makeBuilding('Warehouse', [makeSlot(1001, 'item', 50), makeSlot(1002, 'item', 200)]),
    ];

    const lookup = buildInventoryLookup(buildings, mockItemMeta, mockCargoMeta, mockPackages);

    expect(lookup.get('simple plank:2')).toBe(50);
    expect(lookup.get('rough stone chunk:1')).toBe(200);
  });

  it('expands packages using packages.json multipliers', () => {
    const buildings = [
      makeBuilding('Warehouse', [
        makeSlot(550000, 'cargo', 3), // 3 Simple Plank Packages × 100
      ]),
    ];

    const lookup = buildInventoryLookup(buildings, mockItemMeta, mockCargoMeta, mockPackages);

    // Package expands to base item name at the cargo's tier
    expect(lookup.get('simple plank:2')).toBe(300);
  });

  it('expands 1000x fiber packages', () => {
    const buildings = [
      makeBuilding('Warehouse', [
        makeSlot(550001, 'cargo', 2), // 2 Plant Fiber Packages × 1000
      ]),
    ];

    const lookup = buildInventoryLookup(buildings, mockItemMeta, mockCargoMeta, mockPackages);

    expect(lookup.get('plant fiber:1')).toBe(2000);
  });

  it('handles cargo that is not a package', () => {
    const buildings = [
      makeBuilding('Warehouse', [
        makeSlot(550099, 'cargo', 5), // Supply Crate, not in packages.json
      ]),
    ];

    const lookup = buildInventoryLookup(buildings, mockItemMeta, mockCargoMeta, mockPackages);

    // Non-package cargo uses its own name/tier
    expect(lookup.get('supply crate:1')).toBe(5);
  });

  it('aggregates items and packages of the same base item', () => {
    const buildings = [
      makeBuilding('Warehouse', [
        makeSlot(1001, 'item', 25), // 25 loose Simple Planks
        makeSlot(550000, 'cargo', 2), // 2 packages × 100 = 200
      ]),
    ];

    const lookup = buildInventoryLookup(buildings, mockItemMeta, mockCargoMeta, mockPackages);

    expect(lookup.get('simple plank:2')).toBe(225);
  });

  it('aggregates across multiple buildings', () => {
    const buildings = [
      makeBuilding('Warehouse A', [makeSlot(1001, 'item', 10)]),
      makeBuilding('Warehouse B', [makeSlot(1001, 'item', 15)]),
    ];

    const lookup = buildInventoryLookup(buildings, mockItemMeta, mockCargoMeta, mockPackages);

    expect(lookup.get('simple plank:2')).toBe(25);
  });

  it('skips empty slots', () => {
    const buildings = [makeBuilding('Warehouse', [{ contents: null }, makeSlot(1001, 'item', 10)])];

    const lookup = buildInventoryLookup(buildings, mockItemMeta, mockCargoMeta, mockPackages);

    expect(lookup.get('simple plank:2')).toBe(10);
    expect(lookup.size).toBe(1);
  });

  it('skips items with no meta', () => {
    const buildings = [
      makeBuilding('Warehouse', [
        makeSlot(9999, 'item', 100), // no meta entry
      ]),
    ];

    const lookup = buildInventoryLookup(buildings, mockItemMeta, mockCargoMeta, mockPackages);

    expect(lookup.size).toBe(0);
  });

  it('handles empty buildings array', () => {
    const lookup = buildInventoryLookup([], mockItemMeta, mockCargoMeta, mockPackages);
    expect(lookup.size).toBe(0);
  });

  it('handles buildings with no inventory', () => {
    const buildings = [{ buildingName: 'Empty' } as Building];
    const lookup = buildInventoryLookup(buildings, mockItemMeta, mockCargoMeta, mockPackages);
    expect(lookup.size).toBe(0);
  });

  it('works with empty packages data (no expansion)', () => {
    const buildings = [
      makeBuilding('Warehouse', [
        makeSlot(550000, 'cargo', 3), // cargo, but no packages.json entry
      ]),
    ];

    const lookup = buildInventoryLookup(buildings, mockItemMeta, mockCargoMeta, emptyPackages);

    // Falls through to cargo name since packages is empty
    expect(lookup.get('simple plank package:2')).toBe(3);
  });
});

// =============================================================================
// buildMetaLookups
// =============================================================================

describe('buildMetaLookups', () => {
  it('builds item and cargo lookup maps', () => {
    const items: ApiItem[] = [
      { id: 1, name: 'Item A', tier: 1 },
      { id: 2, name: 'Item B', tier: 2 },
    ];
    const cargos: ApiCargo[] = [{ id: 100, name: 'Cargo A', tier: 1 }];

    const { itemMeta, cargoMeta } = buildMetaLookups(items, cargos);

    expect(itemMeta[1].name).toBe('Item A');
    expect(itemMeta[2].name).toBe('Item B');
    expect(cargoMeta[100].name).toBe('Cargo A');
  });

  it('handles empty arrays', () => {
    const { itemMeta, cargoMeta } = buildMetaLookups([], []);
    expect(Object.keys(itemMeta)).toHaveLength(0);
    expect(Object.keys(cargoMeta)).toHaveLength(0);
  });
});
