/**
 * BitJita Data Types
 *
 * Type definitions for transformed BitJita game data.
 * These represent the JSON file structures and runtime types.
 * TODO: Move to types folder when testing complete
 */

// =============================================================================
// FILE STRUCTURES (as stored in JSON)
// =============================================================================

/** recipes.json structure */
export interface RecipesFile {
  version: number;
  generated: string;
  source: string;
  byId: Record<string, RecipeEntry>;
  byKey: Record<string, string>; // "Name:tier" → ID
}

export interface RecipeEntry {
  id: string;
  name: string;
  tier: number;
  tag: string | null;
  entityType: 'item' | 'cargo';
  yields: number;
  inputs: RecipeInput[];
  station: StationRequirement | null;
  skill: SkillRequirement | null;
  tool: ToolRequirement | null;
  actions?: number | null;
  swingTime?: number | null;
  staminaPerSwing?: number | null;
  xpPerSwing?: number | null;
}

export interface RecipeInput {
  id: string;
  qty: number;
  isCargo?: boolean; // true if input is a cargo entity
}

export interface StationRequirement {
  type: number;
  tier: number;
  name: string | null;
}

export interface SkillRequirement {
  id: number;
  name: string;
  level: number;
}

export interface ToolRequirement {
  type: number;
  level: number;
}

/** items-meta.json structure */
export interface ItemsMetaFile {
  version: number;
  generated: string;
  items: Record<string, ItemMeta>;
}

export interface ItemMeta {
  id: string;
  name: string;
  tier: number;
  tag: string | null;
  rarity: number;
  volume: number;
  market?: MarketStats;
  equipment?: EquipmentStats[];
  tool?: ToolStats;
  food?: FoodStats;
}

export interface MarketStats {
  sellLow: number;
  sellMed: number;
  buyHigh: number;
  buyMed: number;
}

export interface EquipmentStats {
  slot: number;
  power: number;
  armor: number;
  effects: unknown[]; // TODO: type this when needed
}

export interface ToolStats {
  type: number;
  power: number;
  durability: number;
}

export interface FoodStats {
  satiation: number;
  effects: unknown[]; // TODO: type this when needed
}

/** stations.json structure */
export interface StationsFile {
  version: number;
  generated: string;
  byType: Record<string, StationEntry>;
}

export interface StationEntry {
  name: string | null;
  tiers: Record<string, string[]>; // tier → item IDs
}

/** gathered.json structure */
export interface GatheredFile {
  version: number;
  generated: string;
  items: string[]; // Item IDs
}

/** packages.json structure */
export interface PackagesFile {
  version: number;
  generated: string;
  byItemId: Record<string, PackageEntry>; // item ID → package info
  byCargoId: Record<string, PackageEntry>; // cargo ID → item info
}

export interface PackageEntry {
  itemId?: string; // present in byCargoId entries
  cargoId?: string; // present in byItemId entries
  quantity: number;
  name: string;
}

// =============================================================================
// RUNTIME TYPES (computed/derived)
// =============================================================================

/**
 * Item categories derived from tags and data.
 * Replaces the old RecipeType with something more flexible.
 */
export type ItemCategory =
  | 'gathered' // No recipe, raw resource
  | 'intermediate' // Crafted, used in other recipes
  | 'refined' // End-stage refined materials
  | 'research' // Research items
  | 'study' // Journals, carvings
  | 'equipment' // Wearable gear
  | 'tool' // Usable tools
  | 'food' // Consumable food
  | 'building' // Placeable structures
  | 'other'; // Everything else

/**
 * Resolved recipe with all lookups done.
 * Inputs include name/tier for display.
 */
export interface ResolvedRecipe extends RecipeEntry {
  category: ItemCategory;
  inputs: ResolvedInput[];
}

export interface ResolvedInput {
  id: string;
  name: string;
  tier: number;
  qty: number;
}

/**
 * Unified item lookup result.
 * Combines recipe + metadata when available.
 */
export interface ItemInfo {
  id: string;
  name: string;
  tier: number;
  tag: string | null;
  category: ItemCategory;
  recipe: RecipeEntry | null; // null for gathered items
  meta: ItemMeta | null; // null if not loaded
}

// =============================================================================
// LOOKUP TYPES
// =============================================================================

/** Accept either ID or "Name:tier" key */
export type ItemKey = string;

/** Result of parsing a key */
export interface ParsedKey {
  name: string;
  tier: number;
}
