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
  FoodItems,
  ScholarByTier,
  TierQuantities,
  CraftingStationsResult,
  StationsByName, BuildingBreakdown, BuildingFunction, InventorySlotContents, TagGroup,
} from './types.js';

// Helper to create fresh tier quantities object
function createTierQuantities(): TierQuantities {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10:0 };
}

// Process raw API response into structured inventory
export function processInventory(data: ClaimInventoriesResponse): InventoryProcessResult {
  const buildings: Building[] = data.buildings || [];
  const itemMeta:Record<number, ApiItem|ApiCargo> = buildMetaLookup(data.items || []);
  const cargoMeta:Record<number, ApiItem|ApiCargo> = buildMetaLookup(data.cargos || []);

  // Structure: { category: { tag: { items: [{id, name, tier, qty, buildings}], total } } }
  const inventory: ProcessedInventory = {};

  // Material matrix: category -> tier -> quantity
  const materialMatrix: MaterialMatrix = {} as MaterialMatrix;
  for (const cat of DASHBOARD_CONFIG.MATRIX_CATEGORIES) {
    materialMatrix[cat as MaterialCategory] = createTierQuantities();
  }

  // Food totals by item
  const foodItems: FoodItems = {};

  // Scholar totals by tier
  const scholarByTier: ScholarByTier = createTierQuantities();

  for (const building of buildings) {
    const buildingName:string = building.buildingNickname || building.buildingName;

    for (const slot of building.inventory || []) {
      const contents:InventorySlotContents|null = slot.contents;
      if (!contents) continue;

      const id:number = contents.item_id;
      const qty:number = contents.quantity;
      const isItem:boolean = contents.item_type === 'item';

      const meta:ApiItem = isItem ? itemMeta[id] : cargoMeta[id];
      if (!meta) continue;

      const tag:string = meta.tag || 'Other';
      const category:string = DASHBOARD_CONFIG.TAG_TO_CATEGORY[tag] || 'Other';
      const tier:number = meta.tier > 0 ? meta.tier : 1;
      const tierKey = Math.min(tier, CONFIG.MAX_TIER) as keyof TierQuantities;

      // Aggregate raw materials into matrix by category and tier
      if (DASHBOARD_CONFIG.RAW_MATERIAL_TAGS.has(tag) && category in materialMatrix) {
        materialMatrix[category as MaterialCategory][tierKey] += qty;
      }

      // Track food items
      if (category === 'Food') {
        if (!foodItems[id]) {
          foodItems[id] = { name: meta.name, tier: meta.tier, qty: 0 };
        }
        foodItems[id].qty += qty;
      }

      // Track scholar items by tier
      if (category === 'Scholar') {
        scholarByTier[tierKey] += qty;
      }

      // Initialize nested structure
      if (!inventory[category]) inventory[category] = {};
      if (!inventory[category][tag]) {
        inventory[category][tag] = { items: {}, total: 0 };
      }

      const tagGroup:TagGroup = inventory[category][tag];

      if (!tagGroup.items[id]) {
        tagGroup.items[id] = {
          id,
          name: meta.name,
          tier: meta.tier,
          qty: 0,
          buildings: []
        };
      }

      tagGroup.items[id].qty += qty;
      tagGroup.total += qty;

      // Track per-building breakdown
      const existing = tagGroup.items[id].buildings.find(b => b.name === buildingName) as BuildingBreakdown | undefined;
      if (existing) {
        existing.qty += qty;
      } else {
        tagGroup.items[id].buildings.push({ name: buildingName, qty });
      }
    }
  }

  return { inventory, materialMatrix, foodItems, scholarByTier };
}

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
    const func:BuildingFunction|undefined = building.functions?.[0];
    if (!func) continue;

    const tier:number = func.level || 1;
    const tierKey = Math.min(tier, CONFIG.MAX_TIER) as keyof TierQuantities;
    const name:string = building.buildingName;

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