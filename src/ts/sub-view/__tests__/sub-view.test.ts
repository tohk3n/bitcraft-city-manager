import { describe, it, expect } from 'vitest';
import { buildSubViewConfig } from '../sub-view-transformer.js';
import { WOODWORKING, FARMING, SMITHING } from '../../configuration/sub-view.js';
import type { ProcessedInventory, Package, InventoryItem } from '../../types/index.js';

// build a TagGroup with items at specific tiers
// e.g. tagGroup('Plank', [[1, 759], [2, 86], [3, 268], [4, 20]])
function tagGroup(
  baseName: string,
  tierQtys: [number, number][],
  nameOverride?: string
): { items: Record<number, InventoryItem>; total: number } {
  const items: Record<number, InventoryItem> = {};
  let total = 0;
  for (const [tier, qty] of tierQtys) {
    const id = Math.floor(Math.random() * 100000);
    items[id] = {
      id,
      name: nameOverride ?? baseName,
      tier,
      qty,
      buildings: [{ name: 'Test Building', qty }],
    };
    total += qty;
  }
  return { items, total };
}

function makeInventory(
  entries: Record<string, Record<string, ReturnType<typeof tagGroup>>>
): ProcessedInventory {
  return entries as unknown as ProcessedInventory;
}

function emptyPackages(): Package {
  return {};
}

// -- woodworking --

describe('buildSubViewConfig - Woodworking', () => {
  const inventory = makeInventory({
    Wood: {
      'Wood Log': tagGroup('Wood Log', [
        [1, 708],
        [2, 4],
        [3, 3],
        [4, 3424],
      ]),
      Plank: tagGroup('Plank', [
        [1, 759],
        [2, 86],
        [3, 268],
        [4, 20],
      ]),
      Bark: tagGroup('Bark', [
        [1, 911],
        [2, 1248],
        [3, 275],
        [4, 95],
      ]),
      Timber: tagGroup('Timber', [
        [2, 4],
        [3, 2],
      ]),
      Trunk: tagGroup('Trunk', [
        [1, 456],
        [4, 69],
      ]),
      'Stripped Wood': tagGroup('Stripped Wood', [[3, 1]]),
    },
    Metal: {
      Nail: tagGroup(
        'Nails',
        [
          [1, 3],
          [3, 130],
        ],
        'Nails'
      ),
    },
    Stone: {
      Pebbles: tagGroup('Pebbles', [
        [1, 888],
        [2, 154],
        [3, 10],
      ]),
      Clay: tagGroup('Clay', [[1, 50]]),
      "Potter's Mix": tagGroup("Potter's Mix", []),
    },
    Other: {
      Other: {
        items: {
          901: { id: 901, name: 'Empty Bucket', tier: 5, qty: 12, buildings: [] },
          902: { id: 902, name: 'Water Bucket', tier: 5, qty: 0, buildings: [] },
          903: { id: 903, name: 'Refined Plank', tier: 1, qty: 87, buildings: [] },
        },
        total: 99,
      },
    },
  });

  const packages: Package = {
    'Wood Log Package': {
      1001: { name: 'Wood Log Package', tier: 1, qty: 0 },
    },
    'Plank Package': {},
    'Bark Package': {},
  };

  it('returns correct title', () => {
    const config = buildSubViewConfig(inventory, packages, WOODWORKING);
    expect(config.title).toBe('Woodworking');
  });

  it('extracts cargo from Trunk tag', () => {
    const config = buildSubViewConfig(inventory, packages, WOODWORKING);
    expect(config.cargo).not.toBeNull();
    expect(config.cargo?.name).toBe('trunk');
    expect(config.cargo?.tiers[0]).toBe(456);
    expect(config.cargo?.tiers[3]).toBe(69);
  });

  it('extracts consumables by name', () => {
    const config = buildSubViewConfig(inventory, packages, WOODWORKING);
    expect(config.consumables).toHaveLength(2);
    expect(config.consumables[0].name).toBe('empty bucket');
    expect(config.consumables[0].value).toBe(12);
    expect(config.consumables[1].name).toBe('water bucket');
    expect(config.consumables[1].value).toBe(0);
    expect(config.consumables[1].hint).toBe('-> provisions');
  });

  it('builds material rows with correct tier aggregation', () => {
    const config = buildSubViewConfig(inventory, packages, WOODWORKING);
    const materials = config.sections.find((s) => s.label === 'materials');
    expect(materials).toBeDefined();

    const woodLog = materials?.rows.find((r) => r.key === 'Wood Log');
    expect(woodLog).toBeDefined();
    expect(woodLog?.tiers[0]).toBe(708);
    expect(woodLog?.tiers[1]).toBe(4);
    expect(woodLog?.tiers[2]).toBe(3);
    expect(woodLog?.tiers[3]).toBe(3424);
  });

  it('marks output rows with correct semantic', () => {
    const config = buildSubViewConfig(inventory, packages, WOODWORKING);
    const materials = config.sections.find((s) => s.label === 'materials');
    const timber = materials?.rows.find((r) => r.key === 'Timber');
    expect(timber?.cls).toBe('output');

    const refined = materials?.rows.find((r) => r.key === 'Refined Plank');
    expect(refined?.cls).toBe('output');
    expect(refined?.tiers[0]).toBe(87);
  });

  it('finds items by name across categories', () => {
    const config = buildSubViewConfig(inventory, packages, WOODWORKING);
    const materials = config.sections.find((s) => s.label === 'materials');
    const refined = materials?.rows.find((r) => r.key === 'Refined Plank');
    expect(refined?.tiers[0]).toBe(87);
  });

  it('resolves package rows from Package data', () => {
    const config = buildSubViewConfig(inventory, packages, WOODWORKING);
    const pkgSection = config.sections.find((s) => s.label === 'packages');
    expect(pkgSection).toBeDefined();
    const wlp = pkgSection?.rows.find((r) => r.key === 'Wood Log Package');
    expect(wlp).toBeDefined();
  });

  it('returns empty tiers for missing tags', () => {
    const config = buildSubViewConfig(inventory, packages, WOODWORKING);
    const materials = config.sections.find((s) => s.label === 'materials');
    const sapling = materials?.rows.find((r) => r.key === 'Sapling');
    expect(sapling).toBeDefined();
    expect(sapling?.tiers.every((v) => v === 0)).toBe(true);
  });

  it('bottlenecks array starts empty', () => {
    const config = buildSubViewConfig(inventory, packages, WOODWORKING);
    expect(config.bottlenecks).toEqual([]);
  });
});

// -- farming --

describe('buildSubViewConfig - Farming', () => {
  const inventory = makeInventory({
    Farming: {
      'Grain Seeds': tagGroup('Grain Seeds', [
        [1, 50],
        [2, 30],
      ]),
      Grain: tagGroup('Grain', [
        [1, 200],
        [2, 150],
      ]),
      Vegetable: tagGroup('Vegetable', [[1, 100]]),
      Fertilizer: tagGroup('Fertilizer', [[1, 500]]),
    },
    Other: {
      Other: {
        items: {
          801: { id: 801, name: 'Water Bucket', tier: 5, qty: 25, buildings: [] },
        },
        total: 25,
      },
    },
  });

  it('has no cargo', () => {
    const config = buildSubViewConfig(inventory, emptyPackages(), FARMING);
    expect(config.cargo).toBeNull();
  });

  it('splits seeds and crops into separate sections', () => {
    const config = buildSubViewConfig(inventory, emptyPackages(), FARMING);
    const seeds = config.sections.find((s) => s.label === 'seeds');
    const crops = config.sections.find((s) => s.label === 'crops');
    expect(seeds).toBeDefined();
    expect(crops).toBeDefined();
    expect(seeds?.rows.some((r) => r.key === 'Grain Seeds')).toBe(true);
    expect(crops?.rows.some((r) => r.key === 'Grain')).toBe(true);
  });

  it('finds water bucket as consumable', () => {
    const config = buildSubViewConfig(inventory, emptyPackages(), FARMING);
    expect(config.consumables).toHaveLength(1);
    expect(config.consumables[0].value).toBe(25);
  });
});

// -- smithing (cross-domain inputs) --

describe('buildSubViewConfig - Smithing', () => {
  const inventory = makeInventory({
    Metal: {
      Ore: tagGroup('Ore', [
        [1, 100],
        [2, 50],
      ]),
      'Ore Concentrate': tagGroup('Ore Concentrate', [
        [1, 4],
        [2, 22],
      ]),
      Ingot: tagGroup('Ingot', [[1, 10]]),
      'Molten Ingot': tagGroup('Molten Ingot', [[3, 10]]),
      'Ore Chunk': tagGroup('Ore Chunk', [[1, 2]]),
      Nail: tagGroup('Nails', [[2, 100]], 'Nails'),
    },
    Wood: {
      'Wood Log': tagGroup('Wood Log', [
        [1, 604],
        [2, 53],
        [3, 162],
      ]),
      Plank: tagGroup('Plank', [[1, 200]]),
    },
    Cloth: {
      Cloth: tagGroup('Cloth', [[1, 50]]),
      Rope: tagGroup('Rope', [[1, 20]]),
    },
    Leather: {
      Leather: tagGroup('Leather', [[1, 30]]),
    },
    Other: {
      Other: {
        items: {
          701: { id: 701, name: 'Metalsmelting Flux', tier: 1, qty: 0, buildings: [] },
          702: { id: 702, name: 'Refined Ingot', tier: 1, qty: 0, buildings: [] },
        },
        total: 0,
      },
    },
  });

  it('extracts ore chunk as cargo', () => {
    const config = buildSubViewConfig(inventory, emptyPackages(), SMITHING);
    expect(config.cargo?.name).toBe('ore chunk');
    expect(config.cargo?.tiers[0]).toBe(2);
  });

  it('includes cross-domain inputs in materials', () => {
    const config = buildSubViewConfig(inventory, emptyPackages(), SMITHING);
    const materials = config.sections.find((s) => s.label === 'materials');
    const woodLog = materials?.rows.find((r) => r.key === 'Wood Log');
    expect(woodLog?.tiers[0]).toBe(604);
    const cloth = materials?.rows.find((r) => r.key === 'Cloth');
    expect(cloth?.tiers[0]).toBe(50);
  });

  it('finds flux as consumable with zero value', () => {
    const config = buildSubViewConfig(inventory, emptyPackages(), SMITHING);
    expect(config.consumables[0].name).toBe('metalsmelting flux');
    expect(config.consumables[0].value).toBe(0);
  });
});

// -- edge cases --

describe('buildSubViewConfig - edge cases', () => {
  it('handles completely empty inventory', () => {
    const config = buildSubViewConfig({}, emptyPackages(), WOODWORKING);
    expect(config.cargo?.tiers.every((v) => v === 0)).toBe(true);
    expect(config.consumables.every((c) => c.value === 0)).toBe(true);
    config.sections.forEach((s) => {
      s.rows.forEach((r) => {
        expect(r.tiers.every((v) => v === 0)).toBe(true);
      });
    });
  });

  it('finds tags regardless of which category they live under', () => {
    const inventory = makeInventory({
      SomeNewCategory: {
        'Wood Log': tagGroup('Wood Log', [[1, 100]]),
      },
    });
    const config = buildSubViewConfig(inventory, emptyPackages(), WOODWORKING);
    const materials = config.sections.find((s) => s.label === 'materials');
    const woodLog = materials?.rows.find((r) => r.key === 'Wood Log');
    expect(woodLog?.tiers[0]).toBe(100);
  });
});
