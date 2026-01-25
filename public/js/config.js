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

    // Highest tier available
    MAX_TIER: 10,

    // External URLs
    MAP_BASE_URL: 'https://bitcraftmap.com/',

    // Flowchart zoom settings
    FLOWCHART_ZOOM: {
      MIN: 0.25,
      MAX: 2,
      STEP: 0.1,
      WHEEL_SENSITIVITY: 0.0005
    },

    // Build reverse lookup: tag -> category (computed at load time)
    TAG_TO_CATEGORY: {},

    // Matrix to show resource IDs
    RESOURCE_ID_MATRIX: {
      Trees: [
        [11,12,14,19,21,1011009,1011010,1012009,1012010],
        [13,18,20,29,1011008,2011008,2012008],
        [15,27,28,1000028,1000029,3011010,3011011,3012010,3012011,1908426535],
        [16,26,32,1566846336,3011009,3012009],
        [30,31,33,34,4011011,4012011],
        [17,23,24,25,3011008,3012008],
        [35,36,387666932],
        [1101060328],
        [1574437474,1821415333,939701809],
        [939382648,1159270109]
      ],
      OreVeins : [
        [58,59],
        [61],
        [62],
        [63],
        [64],
        [65],
        [139483458],
        [1332797261],
        [],
        []
      ],
      FiberPlants : [
        [2],
        [125],
        [130],
        [1917261269],
        [135,1005142992],
        [139,762731569],
        [128,1981854097],
        [137,1125409070],
        [1458811602],
        [473828668]
      ],
      Berries : [
        [73],
        [80],
        [78],
        [715451185],
        [75],
        [368570220,875245395],
        [582591086,1579330042],
        [84,1592739620],
        [963451338,1954847232],
        [1467799531,2110330714]
      ],
      Flowers : [
        [88,89,90,91,2144918116],
        [87,94],
        [93,95,96,97],
        [92,100],
        [98,103,138],
        [99,101],
        [104,129,723013812],
        [105,1264935363],
        [284200468],
        [102,1986100626]
      ],
      Mushrooms : [
        [74],
        [79],
        [1072537375],
        [532077242],
        [82],
        [81],
        [76,586543849],
        [85,1657885116],
        [83,1742959882],
        [1637125903,2089197796]
      ],
      Clay : [
        [66],
        [67],
        [68],
        [69],
        [70],
        [71,702104027],
        [834195042],
        [505488132],
        [1526038154],
        [1023127595]
      ],
      Sand : [
        [204021372],
        [464034838],
        [1180909566],
        [541862086],
        [1691492474],
        [999376882],
        [1332535555],
        [457752715],
        [562432497],
        [1333270269]
      ],
      Rock : [
        [38,40,43,44,46,48,41,42,45],
        [47,49,2050001],
        [50,51],
        [53,2050000,4050000,4050001,4050002,4050003,4050004,4050006,4050007],
        [54],
        [57,56],
        [1440062914,2104975743],
        [479638263,1423928615],
        [1902966974,1113640469],
        [70663203,1996631377]
      ],
      Baitfish: [
        [1110000],
        [2110000],
        [3110000],
        [4110000],
        [5110000],
        [6110000],
        [1262898141],
        [1558728865],
        [756579517],
        [1283711960]
      ],
      LakeFish: [
        [1110001],
        [2110001],
        [3110001],
        [4110001],
        [5110001],
        [6110001],
        [904022325],
        [722506673],
        [1157887989],
        [374159821]
      ],
      OceanFish: [
        [1110002],
        [2110002],
        [3110002],
        [4110002],
        [5110002],
        [6110002],
        [5045122],
        [2390533],
        [1812221896],
        [424796674]
      ],
      Carvings: [
        [140],
        [141],
        [142],
        [143],
        [144],
        [145],
        [2124845482],
        [1567694896],
        [331687458],
        [5931521926]
      ],
      Sailing: [
        [1477126404],
        [1043012047],
        [1293969473]
      ]
    }
};

// Initialize reverse lookup
for (const [category, tags] of Object.entries(CONFIG.TAG_CATEGORIES)) {
    for (const tag of tags) {
        CONFIG.TAG_TO_CATEGORY[tag] = category;
    }
}
