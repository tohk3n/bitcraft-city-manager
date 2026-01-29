export const DASHBOARD_CONFIG = {



    // Categories shown in the material matrix
    MATRIX_CATEGORIES: ['Wood', 'Metal', 'Stone', 'Cloth', 'Farming', 'Fishing', 'Leather'],

    // Category mappings: which tags belong to which high-level category
    TAG_CATEGORIES: {
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
    },

    // Tags that count as "raw materials" for tier aggregation
    RAW_MATERIAL_TAGS: new Set([
        'Wood Log', 'Plank', 'Bark', 'Timber', 'Trunk',
        'Ingot', 'Ore Concentrate', 'Ore Chunk', 'Nail',
        'Pebbles', 'Brick', 'Clay', "Potter's Mix", 'Chunk', 'Sand', 'Glass',
        'Plant Fiber', 'Thread', 'Cloth', 'Filament', 'Rope',
        'Fertilizer', 'Grain', 'Vegetable',
        'Bait', 'Lake Fish', 'Lake Fish Filet', 'Ocean Fish', 'Oceanfish Filet', 'Chum',
        'Leather', 'Tanned Pelt', 'Tannin', 'Raw Meat',
    ]),
    // Build reverse lookup: tag -> category (computed at load time)
    TAG_TO_CATEGORY: {} as Record<string, string>,
    // Inventory category display order
    CATEGORY_ORDER: [
        'Wood', 'Metal', 'Stone', 'Cloth', 'Farming', 'Fishing', 'Leather',
        'Packages', 'Gems', 'Tools', 'Other'
    ],
    // Categories excluded from inventory grid (shown in quick stats instead)
    INVENTORY_GRID_EXCLUDE: ['Food', 'Scholar'],

    //TODO check if this can not be done with css
    BG_CONST : 'background: rgba(88, 166, 255, 0.2);'
}
// Initialize reverse lookup
for (const [category, tags] of Object.entries(DASHBOARD_CONFIG.TAG_CATEGORIES)) {
    for (const tag of tags) {
        DASHBOARD_CONFIG.TAG_TO_CATEGORY[tag] = category;
    }
}