// Inventory processing types

import type { ApiItem, ApiCargo } from './api.js';
import type { ItemMapping } from './planner.js';

// =============================================================================
// TIER AND CATEGORY TYPES
// =============================================================================

export interface TierQuantities {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
    6: number;
    7: number;
    8: number;
    9: number;
    10: number;
}

export type MaterialCategory =
    | 'Wood'
    | 'Metal'
    | 'Stone'
    | 'Cloth'
    | 'Farming'
    | 'Fishing'
    | 'Leather';

export type MaterialMatrix = Record<MaterialCategory, TierQuantities>;

// =============================================================================
// FOOD AND SCHOLAR TRACKING
// =============================================================================

export interface Item {
    name: string;
    tier: number;
    qty: number;
    rarity?: number;
}

export type Items = Record<number, Item>;  // keyed by item ID

export type ScholarByTier = TierQuantities;

// =============================================================================
// BUILDING AND ITEM BREAKDOWN
// =============================================================================

export interface BuildingBreakdown {
    name: string;
    qty: number;
}

export interface InventoryItem {
    id: number;
    name: string;
    tier: number;
    qty: number;
    buildings: BuildingBreakdown[];
}

export interface TagGroup {
    items: Record<number, InventoryItem>;  // keyed by item ID
    total: number;
}

export type CategoryInventory = Record<string, TagGroup>;  // tag -> TagGroup

export type ProcessedInventory = Record<string, CategoryInventory>;  // category -> tags

export interface InventoryProcessResult {
    inventory: ProcessedInventory;
    materialMatrix: MaterialMatrix;
    foodItems: Items;
    scholarByTier: ScholarByTier;
}

// =============================================================================
// CRAFTING STATIONS
// =============================================================================

export interface StationSummary {
    tiers: TierQuantities;
    total: number;
}

export type StationsByName = Record<string, StationSummary>;

export interface CraftingStationsResult {
    active: StationsByName;
    passive: StationsByName;
}

// =============================================================================
// INVENTORY MATCHER
// =============================================================================

export type InventoryLookup = Map<string, number>;  // "name:tier" -> quantity

export interface ItemQuantityResult {
    qty: number;
    mapping: ItemMapping | null;
    trackable: boolean;
}

export interface MetaLookups {
    itemMeta: Record<number, ApiItem>;
    cargoMeta: Record<number, ApiCargo>;
}