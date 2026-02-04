/**
 * BitJita Data Module
 *
 * Clean data access layer for BitJita game data.
 *
 * Usage:
 *   import { loadCoreData, getRecipe, categorize } from '../data/index.js';
 *
 *   const { recipes, gathered } = await loadCoreData();
 *   const plank = getRecipe(recipes, 'Simple Plank:2');
 *   const category = categorize(plank, plank.tag, gathered.has(plank.id));
 *
 * File structure:
 *   - types.ts        Type definitions (this will move to types)
 *   - loader.ts       Data loading and caching
 *   - recipe-data.ts  Recipe lookups and categorization
 *   - item-data.ts    Item metadata, market, equipment
 *   - station-data.ts Station lookups and craftable items
 *   - package-data.ts Package lookups, item mappings, and multipliers
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  // File structures
  RecipesFile,
  RecipeEntry,
  RecipeInput,
  StationRequirement,
  SkillRequirement,
  ToolRequirement,
  ItemsMetaFile,
  ItemMeta,
  MarketStats,
  EquipmentStats,
  ToolStats,
  FoodStats,
  StationsFile,
  StationEntry,
  GatheredFile,
  PackagesFile,
  PackageEntry,

  // Runtime types
  ItemCategory,
  ResolvedRecipe,
  ResolvedInput,
  ItemInfo,
  ItemKey,
  ParsedKey,
} from './types.js';

// =============================================================================
// LOADER
// =============================================================================

export {
  loadRecipes,
  loadItemsMeta,
  loadStations,
  loadGathered,
  loadPackages,
  loadCoreData,
  loadAllData,
  clearCache,
  isLoaded,
} from './loader.js';

// =============================================================================
// RECIPE DATA
// =============================================================================

export {
  // Key utilities
  createKey,
  parseKey,
  isId,

  // Lookups
  resolveId,
  getRecipe,
  getRecipeById,
  hasItem,
  getAllIds,
  getAllKeys,

  // Categorization
  categorize,
  isTrackable,

  // Resolution
  resolveRecipe,
  getInputRecipes,

  // Filtering
  findRecipes,
  findByTag,
  findByTier,
  findByStation,
} from './recipe-data.js';

// =============================================================================
// ITEM DATA
// =============================================================================

export {
  // Lookups
  getItemMeta,
  getItemMetaByKey,

  // Market
  getMarketStats,
  calculateInventoryValue,
  getMarketItems,

  // Equipment
  getEquipmentStats,
  findEquipment,
  findEquipmentBySlot,

  // Tools
  getToolStats,
  findTools,
  findToolsByType,

  // Food
  getFoodStats,
  findFood,
  findFoodByStation,

  // General filtering
  findItemsByTag,
  findItemsByTier,
  findItemsByRarity,
} from './item-data.js';

// =============================================================================
// STATION DATA
// =============================================================================

export {
  // Lookups
  getStation,
  getStationName,
  getAllStationTypes,

  // Craftable items
  getCraftableItemIds,
  getAllCraftableItemIds,
  getCraftableRecipes,
  getAllCraftableRecipes,

  // Station queries
  getStationTiers,
  getStationTierCounts,
  findStationForItem,
  getStationSummary,
} from './station-data.js';

// =============================================================================
// PACKAGE DATA
// =============================================================================

export {
  // Lookups
  getPackageForItem,
  getItemForPackage,

  // Multipliers
  getPackageMultiplier,
  expandPackageQuantity,

  // Type checks
  isPackageable,
  isPackage,

  // Bulk
  getAllPackageableItems,
  getAllPackages,
} from './package-data.js';
