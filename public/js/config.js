// Configuration constants - centralized magic values
export const CONFIG = {
    // Equipment slot identifiers (API field names)
    EQUIPMENT_SLOTS: [
        'head_clothing',
        'torso_clothing',
        'hand_clothing',
        'belt_clothing',
        'leg_clothing',
        'feet_clothing'
    ],

    // Display names for equipment slots
    SLOT_DISPLAY_NAMES: ['Head', 'Chest', 'Hands', 'Belt', 'Legs', 'Feet'],

    // Vault API type codes for each slot
    // type: 8=head, 9=belt, 10=torso, 11=hands, 12=legs, 13=feet
    SLOT_TYPE_CODES: {
        'head_clothing': 8,
        'torso_clothing': 10,
        'hand_clothing': 11,
        'belt_clothing': 9,
        'leg_clothing': 12,
        'feet_clothing': 13
    },

    // Armor/clothing categories
    GEAR_TYPES: ['Cloth Clothing', 'Leather Clothing', 'Metal Clothing'],

    // All clothing/armor tags (for vault filtering)
    CLOTHING_TAGS: [
        'Cloth Clothing', 'Leather Clothing', 'Metal Clothing',
        'Cloth Armor', 'Leather Armor', 'Metal Armor'
    ],

    // Rarity ordering (lowest to highest)
    RARITY_ORDER: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'],

    // Inventory category display order
    CATEGORY_ORDER: [
        'Wood', 'Metal', 'Stone', 'Cloth', 'Farming', 'Fishing', 'Leather',
        'Packages', 'Gems', 'Tools', 'Other'
    ],

    // Categories excluded from inventory grid (shown in quick stats instead)
    INVENTORY_GRID_EXCLUDE: ['Food', 'Scholar'],

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

    // Number of regions
    REGION_COUNT: 9,

    // External URLs
    MAP_BASE_URL: 'https://bitcraftmap.com/',

    // Build reverse lookup: tag -> category (computed at load time)
    TAG_TO_CATEGORY: {}
};

// Initialize reverse lookup
for (const [category, tags] of Object.entries(CONFIG.TAG_CATEGORIES)) {
    for (const tag of tags) {
        CONFIG.TAG_TO_CATEGORY[tag] = category;
    }
}
