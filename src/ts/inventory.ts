// Process inventory data using API-provided item/cargo metadata
import { CONFIG } from './configuration/config.js';
import { DASHBOARD_CONFIG } from './configuration/dashboardconfig.js';

import type {
  ClaimInventoriesResponse,
  ApiItem,
  ApiCargo,
  Building,
  InventoryProcessResult,
  ProcessedInventory,
  MaterialMatrix,
  MaterialCategory,
  Items,
  Package,
  TierQuantities,
  CraftingStationsResult,
  StationsByName,
  BuildingBreakdown,
  BuildingFunction,
  InventorySlotContents,
  TagGroup,
} from './types/index.js';

// Helper to create fresh tier quantities object
function createTierQuantities(): TierQuantities {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
}
// Process raw API response into structured inventory
export const InventoryProcessor = {
  processInventory(data: ClaimInventoriesResponse): InventoryProcessResult {
    const buildings: Building[] = data.buildings || [];

    const itemMeta: Record<number, ApiItem | ApiCargo> = buildMetaLookup(data.items || []);
    const cargoMeta: Record<number, ApiItem | ApiCargo> = buildMetaLookup(data.cargos || []);

    // Structure: { category: { tag: { items: [{id, name, tier, qty, buildings}], total } } }
    const inventory: ProcessedInventory = {};
    // Material matrix: category -> tier -> quantity
    const materialMatrix: MaterialMatrix = {} as MaterialMatrix;
    for (const cat of DASHBOARD_CONFIG.MATRIX_CATEGORIES) {
      materialMatrix[cat as MaterialCategory] = createTierQuantities();
    }

    // Food items
    const foodItems: Items = {};
    // Packages
    const packages: Package = {};
    // Supply items (cargo)
    const supplies: Items = {};
    // RegEx for package building
    const escaped = DASHBOARD_CONFIG.SPECIFIER.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`\\b(${escaped.join('|')})\\b`, 'g');

    for (const building of buildings) {
      const buildingName: string = building.buildingNickname || building.buildingName;

      for (const slot of building.inventory || []) {
        const contents: InventorySlotContents | null = slot.contents;
        if (!contents) continue;

        const id: number = contents.item_id;
        const qty: number = contents.quantity;
        const isItem: boolean = contents.item_type === 'item';

        const meta: ApiItem = isItem ? itemMeta[id] : cargoMeta[id];
        if (!meta) continue;
        const isGem: boolean = this.gemCheck(meta.name);
        const tag: string = isGem ? this.normalizeGemTag(meta.name) : meta.tag || 'Other';
        const category: string = DASHBOARD_CONFIG.TAG_TO_CATEGORY[tag] || 'Other';
        const tier: number = meta.tier > 0 ? meta.tier : 1;
        const tierKey = Math.min(tier, CONFIG.MAX_TIER) as keyof TierQuantities;

        // Aggregate raw materials into matrix by category and tier
        if (DASHBOARD_CONFIG.RAW_MATERIAL_TAGS.has(tag) && category in materialMatrix) {
          materialMatrix[category as MaterialCategory][tierKey] += qty;
        }
        // Track food items
        InventoryProcessor.updateFood(category, foodItems, meta, id, qty);
        // Track supply cargo
        InventoryProcessor.updateSupplies(DASHBOARD_CONFIG.SUPPLY, tag, supplies, meta, id, qty);
        // Look through packages to build a structure that combines everything without the tier specifier
        // [Simple Wood Log Package -> Wood Log Package]
        InventoryProcessor.updatePackage(meta, packages, regex, tag, id, qty);

        InventoryProcessor.updateInventory(inventory, id, meta, qty, tag, category, buildingName);
      }
    }
    return {
      inventory: inventory,
      materialMatrix: materialMatrix,
      foodItems: foodItems,
      supplyCargo: supplies,
      packages: packages,
    };
  },
  gemCheck(itemName: string): boolean {
    for (const gemName of DASHBOARD_CONFIG.GEM_NAMES) {
      if (itemName.includes(gemName)) return true;
    }
    return false;
  },
  normalizeGemTag(itemName: string): string {
    const uncut = itemName.includes('Uncut');
    const fragment = itemName.includes('Fragment');
    if (uncut) {
      for (const gemName of DASHBOARD_CONFIG.GEM_NAMES) {
        if (itemName.includes(gemName)) return 'Uncut ' + gemName;
      }
    } else if (fragment) {
      for (const gemName of DASHBOARD_CONFIG.GEM_NAMES) {
        if (itemName.includes(gemName)) return gemName + ' Fragment';
      }
    }
    for (const gemName of DASHBOARD_CONFIG.GEM_NAMES) {
      if (itemName.includes(gemName)) return gemName;
    }
    return 'Other';
  },
  updateInventory(
    inventory: ProcessedInventory,
    id: number,
    meta: ApiItem,
    qty: number,
    tag: string,
    category: string,
    buildingName: string
  ) {
    // Initialize nested structure
    if (!inventory[category]) inventory[category] = {};
    if (!inventory[category][tag]) {
      inventory[category][tag] = { items: {}, total: 0 };
    }

    const tagGroup: TagGroup = inventory[category][tag];
    // adds missing entries
    if (!tagGroup.items[id]) {
      tagGroup.items[id] = {
        id,
        name: meta.name,
        tier: meta.tier,
        qty: 0,
        buildings: [],
      };
    }
    tagGroup.items[id].qty += qty;
    tagGroup.total += qty;

    // Track per-building breakdown
    const existing = tagGroup.items[id].buildings.find((b) => b.name === buildingName) as
      | BuildingBreakdown
      | undefined;
    if (existing) {
      existing.qty += qty;
    } else {
      tagGroup.items[id].buildings.push({ name: buildingName, qty });
    }
  },
  // Track specified food items
  updateFood(category: string, foodItems: Items, meta: ApiItem, id: number, qty: number): void {
    if (category === 'Food') {
      if (!foodItems[id]) {
        foodItems[id] = InventoryProcessor.buildEntry(meta);
      }
      foodItems[id].qty += qty;
    }
  },
  // Track specified Supplies
  updateSupplies(
    checkArray: Set<string>,
    tag: string,
    supplies: Items,
    meta: ApiItem,
    id: number,
    qty: number
  ) {
    if (checkArray.has(tag)) {
      supplies[id] = InventoryProcessor.buildEntry(meta);
      supplies[id].qty += qty;
    }
  },
  // Updates an entry for the packages if the tag is package
  updatePackage(
    meta: ApiItem,
    packages: Package,
    regex: RegExp,
    tag: string,
    id: number,
    qty: number
  ): void {
    if (tag === 'Package') {
      const shortenedId: string = meta.name.replace(regex, '').trim();
      if (!packages[shortenedId]) {
        packages[shortenedId] = {};
      }
      if (!packages[shortenedId][id]) {
        packages[shortenedId][id] = InventoryProcessor.buildEntry(meta);
      }
      packages[shortenedId][id].qty += qty;
    }
  },
  // Returns singular entry from meta information
  buildEntry(meta: ApiItem): {
    name: string;
    tier: number;
    qty: number;
    rarity: number | undefined;
  } {
    return {
      name: meta.name,
      tier: meta.tier,
      qty: 0,
      rarity: meta.rarity,
    };
  },
};

// Build id -> metadata lookup
function buildMetaLookup(arr: ApiItem[] | ApiCargo[]): Record<number, ApiItem | ApiCargo> {
  const map: Record<number, ApiItem | ApiCargo> = {};
  for (const item of arr) {
    map[item.id] = item;
  }
  return map;
}

// Process buildings data into crafting station summary
export function processCraftingStations(buildings: Building[]): CraftingStationsResult {
  const active: StationsByName = {};
  const passive: StationsByName = {};
  for (const building of buildings) {
    const func: BuildingFunction | undefined = building.functions?.[0];
    if (!func) continue;

    const tier: number = func.level || 1;
    const tierKey = Math.min(tier, CONFIG.MAX_TIER) as keyof TierQuantities;
    const name: string = building.buildingName;

    // Active: has crafting slots
    if (func.crafting_slots && func.crafting_slots > 0) {
      if (!active[name]) {
        active[name] = { tiers: createTierQuantities(), total: 0 };
      }
      active[name].tiers[tierKey]++;
      active[name].total++;
    }
    // Passive: has refining slots (kilns, smelters, looms, etc.)
    else if (func.refining_slots && func.refining_slots > 0) {
      if (!passive[name]) {
        passive[name] = { tiers: createTierQuantities(), total: 0 };
      }
      passive[name].tiers[tierKey]++;
      passive[name].total++;
    }
  }

  return { active, passive };
}
