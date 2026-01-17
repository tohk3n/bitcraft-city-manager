// Process inventory data using API-provided item/cargo metadata
// No hardcoded IDs - groups dynamically by tag

// Category mappings: which tags belong to which high-level category
const TAG_CATEGORIES = {
  'Wood': ['Wood Log', 'Plank', 'Bark', 'Timber', 'Trunk', 'Stripped Wood'],
  'Metal': ['Ingot', 'Ore', 'Ore Concentrate', 'Ore Chunk', 'Nail', 'Molten Ingot'],
  'Stone': ['Pebbles', 'Brick', 'Clay', "Potter's Mix", 'Chunk', 'Geode', 'Sand', 'Glass', 'Gypsite'],
  'Cloth': ['Plant Fiber', 'Thread', 'Cloth', 'Cloth Strip', 'Filament', 'Rope'],
  'Farming': ['Fertilizer', 'Grain', 'Grain Seeds', 'Vegetable', 'Vegetable Seeds', 'Filament Seeds', 'Berry', 'Flower', 'Mushroom', 'Vegetable Plant', 'Filament Plant', 'Roots'],
  'Fishing': ['Bait', 'Lake Fish', 'Lake Fish Filet', 'Ocean Fish', 'Oceanfish Filet', 'Chum', 'Fish Oil', 'Crushed Shells', 'Baitfish'],
  'Leather': ['Leather', 'Raw Pelt', 'Cleaned Pelt', 'Tanned Pelt', 'Tannin', 'Raw Meat'],
  'Food': ['Basic Food', 'Meal', 'Dough'],
  'Scholar': ['Parchment', 'Journal', 'Ancient Hieroglyphs', 'Ink', 'Pigment'],
  'Packages': ['Package', 'Sheeting'],
  'Gems': ['Gem', 'Gem Fragment'],
  'Tools': ['Forester Tool', 'Miner Tool', 'Farmer Tool', 'Tailor Tool', 'Mason Tool', 'Blacksmith Tool', 'Hunter Tool', 'Forager Tool', 'Carpenter Tool', 'Scholar Tool'],
};

// Tags that count as "raw materials" for tier aggregation
const RAW_MATERIAL_TAGS = new Set([
  'Wood Log', 'Plank', 'Bark', 'Timber', 'Trunk',
  'Ingot', 'Ore Concentrate', 'Ore Chunk', 'Nail',
  'Pebbles', 'Brick', 'Clay', "Potter's Mix", 'Chunk', 'Sand', 'Glass',
  'Plant Fiber', 'Thread', 'Cloth', 'Filament', 'Rope',
  'Fertilizer', 'Grain', 'Vegetable',
  'Bait', 'Lake Fish', 'Lake Fish Filet', 'Ocean Fish', 'Oceanfish Filet', 'Chum',
  'Leather', 'Tanned Pelt', 'Tannin', 'Raw Meat',
]);

// Build reverse lookup: tag -> category
function buildTagToCategory() {
  const map = {};
  for (const [category, tags] of Object.entries(TAG_CATEGORIES)) {
    for (const tag of tags) {
      map[tag] = category;
    }
  }
  return map;
}

const TAG_TO_CATEGORY = buildTagToCategory();

// Categories to include in the material matrix (order matters for display)
const MATRIX_CATEGORIES = ['Wood', 'Metal', 'Stone', 'Cloth', 'Farming', 'Fishing', 'Leather'];

// Process raw API response into structured inventory
function processInventory(data) {
  const buildings = data.buildings || [];
  const itemMeta = buildMetaLookup(data.items || []);
  const cargoMeta = buildMetaLookup(data.cargos || []);
  
  // Structure: { category: { tag: { items: [{id, name, tier, qty, buildings}], total } } }
  const inventory = {};
  
  // Material matrix: category -> tier -> quantity
  const materialMatrix = {};
  for (const cat of MATRIX_CATEGORIES) {
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
      const category = TAG_TO_CATEGORY[tag] || 'Other';
      const tier = meta.tier > 0 ? meta.tier : 1;
      const tierKey = Math.min(tier, 7);
      
      // Aggregate raw materials into matrix by category and tier
      if (RAW_MATERIAL_TAGS.has(tag) && materialMatrix[category]) {
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
