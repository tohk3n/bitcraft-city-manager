// Process inventory data using API-provided item/cargo metadata
import { CONFIG } from './config.js';

// Process raw API response into structured inventory
export function processInventory(data) {
  const buildings = data.buildings || [];
  const itemMeta = buildMetaLookup(data.items || []);
  const cargoMeta = buildMetaLookup(data.cargos || []);

  // Structure: { category: { tag: { items: [{id, name, tier, qty, buildings}], total } } }
  const inventory = {};

  // Material matrix: category -> tier -> quantity
  const materialMatrix = {};
  for (const cat of CONFIG.MATRIX_CATEGORIES) {
    materialMatrix[cat] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  }

  // Food totals by item
  const foodItems = {};

  // Scholar totals by tier
  const scholarByTier = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };

  for (const building of buildings) {
    const buildingName = building.buildingNickname || building.buildingName;

    for (const slot of building.inventory || []) {
      const contents = slot.contents;
      if (!contents) continue;

      const id = contents.item_id;
      const qty = contents.quantity;
      const isItem = contents.item_type === 'item';

      const meta = isItem ? itemMeta[id] : cargoMeta[id];
      if (!meta) continue;

      const tag = meta.tag || 'Other';
      const category = CONFIG.TAG_TO_CATEGORY[tag] || 'Other';
      const tier = meta.tier > 0 ? meta.tier : 1;
      const tierKey = Math.min(tier, 7);

      // Aggregate raw materials into matrix by category and tier
      if (CONFIG.RAW_MATERIAL_TAGS.has(tag) && materialMatrix[category]) {
        materialMatrix[category][tierKey] += qty;
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

      const tagGroup = inventory[category][tag];

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
      const existing = tagGroup.items[id].buildings.find(b => b.name === buildingName);
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
function buildMetaLookup(arr) {
  const map = {};
  for (const item of arr) {
    map[item.id] = item;
  }
  return map;
}

// Process buildings data into crafting station summary
export function processCraftingStations(buildings) {
  const active = {};   // name -> { tiers: {1:0, 2:0, ...}, total: 0 }
  const passive = {};

  for (const building of buildings) {
    const func = building.functions?.[0];
    if (!func) continue;

    const tier = func.level || 1;
    const tierKey = Math.min(tier, 7);
    const name = building.buildingName;

    // Active: has crafting slots
    if (func.crafting_slots > 0) {
      if (!active[name]) {
        active[name] = { tiers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }, total: 0 };
      }
      active[name].tiers[tierKey]++;
      active[name].total++;
    }
    // Passive: has refining slots (kilns, smelters, looms, etc.)
    else if (func.refining_slots > 0) {
      if (!passive[name]) {
        passive[name] = { tiers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }, total: 0 };
      }
      passive[name].tiers[tierKey]++;
      passive[name].total++;
    }
  }

  return { active, passive };
// }
