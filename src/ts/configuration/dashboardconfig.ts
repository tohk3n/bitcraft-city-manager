export const DASHBOARD_CONFIG = {
  // Categories shown in the material matrix
  MATRIX_CATEGORIES: ['Wood', 'Metal', 'Stone', 'Cloth', 'Farming', 'Fishing', 'Leather', 'Gem'],
  // Category mappings: which tags belong to which high-level category
  TAG_CATEGORIES: {
    Wood: ['Wood Log', 'Plank', 'Bark', 'Timber', 'Trunk', 'Stripped Wood'],
    Metal: ['Ingot', 'Ore', 'Ore Concentrate', 'Ore Chunk', 'Nail', 'Molten Ingot'],
    Stone: [
      'Pebbles',
      'Brick',
      'Clay',
      "Potter's Mix",
      'Chunk',
      'Geode',
      'Sand',
      'Glass',
      'Gypsite',
    ],
    Cloth: ['Plant Fiber', 'Thread', 'Cloth', 'Cloth Strip', 'Filament', 'Rope'],
    Farming: [
      'Fertilizer',
      'Grain',
      'Grain Seeds',
      'Vegetable',
      'Vegetable Seeds',
      'Filament Seeds',
      'Berry',
      'Flower',
      'Mushroom',
      'Vegetable Plant',
      'Filament Plant',
      'Roots',
    ],
    Fishing: [
      'Bait',
      'Lake Fish',
      'Lake Fish Filet',
      'Ocean Fish',
      'Oceanfish Filet',
      'Chum',
      'Fish Oil',
      'Crushed Shells',
      'Baitfish',
    ],
    Gems: ['Ruby', 'Emerald', 'Diamond', 'Sapphire'],
    UncutGems: ['Uncut Ruby', 'Uncut Emerald', 'Uncut Diamond', 'Uncut Sapphire'],
    GemFragment: ['Ruby Fragment', 'Emerald Fragment', 'Diamond Fragment', 'Sapphire Fragment'],
    Leather: ['Leather', 'Raw Pelt', 'Cleaned Pelt', 'Tanned Pelt', 'Tannin', 'Raw Meat'],
    Food: ['Basic Food', 'Meal', 'Dough'],
    Scholar: ['Parchment', 'Journal', 'Ancient Hieroglyphs', 'Ink', 'Pigment'],
    Packages: ['Package', 'Sheeting'],
    Tools: [
      'Forester Tool',
      'Miner Tool',
      'Farmer Tool',
      'Tailor Tool',
      'Mason Tool',
      'Blacksmith Tool',
      'Hunter Tool',
      'Forager Tool',
      'Carpenter Tool',
      'Scholar Tool',
    ],
  },

  // Tags that count as "raw materials" for tier aggregation
  RAW_MATERIAL_TAGS: new Set([
    'Wood Log',
    'Plank',
    'Bark',
    'Timber',
    'Trunk',
    'Ingot',
    'Ore Concentrate',
    'Ore Chunk',
    'Nail',
    'Pebbles',
    'Brick',
    'Clay',
    "Potter's Mix",
    'Chunk',
    'Sand',
    'Glass',
    'Plant Fiber',
    'Thread',
    'Cloth',
    'Filament',
    'Rope',
    'Fertilizer',
    'Grain',
    'Vegetable',
    'Bait',
    'Lake Fish',
    'Lake Fish Filet',
    'Ocean Fish',
    'Oceanfish Filet',
    'Chum',
    'Leather',
    'Tanned Pelt',
    'Tannin',
    'Raw Meat',
  ]),
  SUPPLY: new Set(['Frame', 'Timber', 'Tarp', 'Brick Slab', 'Sheeting']),

  // Supply cargo types for the production potential panel.
  // Tags match recipe tags exactly from recipes.json.
  // Discovered via diagnostic dump of actual recipe data.
  SUPPLY_TYPES: [
    { label: 'Timber', tag: 'Timber' },
    { label: 'Frames', tag: 'Frame' },
    { label: 'Tarp', tag: 'Tarp' },
    { label: 'Slab', tag: 'Brick Slab' },
    { label: 'Sheeting', tag: 'Sheeting' },
  ] as const,
  // Build reverse lookup: tag -> category (computed at load time)
  TAG_TO_CATEGORY: {} as Record<string, string>,
  // Inventory category display order
  CATEGORY_ORDER: [
    'Wood',
    'Metal',
    'Stone',
    'Cloth',
    'Farming',
    'Fishing',
    'Leather',
    'Packages',
    'Tools',
    'Gem',
    'Other',
  ],
  // Actual food to be shown in the food tab, incomplete and not yet used
  FRIDGE: ['Fine Deluxe Ocean Fish Sticks', 'Succulent Ocean Fish Sticks'],
  // rules for sorting food
  FOOD_RULE: [
    { words: ['fish'], prio: 0 },
    { words: ['meat'], prio: 1 },
    { words: ['mushroom', 'berry'], prio: 2 },
  ],
  // Amount of entries shown in the food dashboard
  FOOD_ENTRIES: 15,
  // Tier specifier
  SPECIFIER: [
    'Rough',
    'Basic',
    'Simple',
    'Sturdy',
    'Fine',
    'Exquisite',
    'Peerless',
    'Ornate',
    'Pristine',
    'Flawless',
    'Magnificent',
  ],
  GEM_NAMES: ['Ruby', 'Sapphire', 'Diamond', 'Emerald'],
  BG_CONST: 'background: rgba(88, 166, 255, 0.2);',
};
// Initialize reverse lookup
for (const [category, tags] of Object.entries(DASHBOARD_CONFIG.TAG_CATEGORIES)) {
  for (const tag of tags) {
    DASHBOARD_CONFIG.TAG_TO_CATEGORY[tag] = category;
  }
}
