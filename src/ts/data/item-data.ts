/**
 * Item Data Utilities
 *
 * Operates on items-meta.json data.
 */

import type {
  ItemsMetaFile,
  ItemMeta,
  MarketStats,
  EquipmentStats,
  ToolStats,
  FoodStats,
  RecipesFile,
  ItemKey,
} from './types.js';
import { resolveId } from './recipe-data.js';

// =============================================================================
// LOOKUPS
// =============================================================================

/**
 * Get item metadata by ID
 */
export function getItemMeta(items: ItemsMetaFile, id: string): ItemMeta | null {
  return items.items[id] ?? null;
}

/**
 * Get item metadata by ID or "Name:tier" key
 * Requires recipes data for key resolution
 */
export function getItemMetaByKey(
  items: ItemsMetaFile,
  recipes: RecipesFile,
  key: ItemKey
): ItemMeta | null {
  const id = resolveId(recipes, key);
  if (!id) return null;
  return getItemMeta(items, id);
}

// =============================================================================
// MARKET DATA
// =============================================================================

export function getMarketStats(items: ItemsMetaFile, id: string): MarketStats | null {
  return items.items[id]?.market ?? null;
}

export function calculateInventoryValue(
  items: ItemsMetaFile,
  inventory: Map<string, number>, // id → quantity
  priceType: 'sellLow' | 'sellMed' | 'buyHigh' | 'buyMed' = 'sellMed'
): number {
  let total = 0;
  for (const [id, qty] of inventory) {
    const market = items.items[id]?.market;
    if (market) {
      total += (market[priceType] ?? 0) * qty;
    }
  }
  return total;
}

export function getMarketItems(
  items: ItemsMetaFile,
  sortBy: keyof MarketStats = 'sellMed',
  descending: true
): ItemMeta[] {
  const withMarket = Object.values(items.items).filter((item) => item.market);

  return withMarket.sort((a, b) => {
    const aVal = a.market?.[sortBy] ?? 0;
    const bVal = b.market?.[sortBy] ?? 0;
    return descending ? bVal - aVal : aVal - bVal;
  });
}

// =============================================================================
// EQUIPMENT DATA
// =============================================================================

export function getEquipmentStats(items: ItemsMetaFile, id: string): EquipmentStats[] | null {
  return items.items[id]?.equipment ?? null;
}

export function findEquipment(items: ItemsMetaFile): ItemMeta[] {
  return Object.values(items.items).filter((item) => item.equipment && item.equipment.length > 0);
}

export function findEquipmentBySlot(items: ItemsMetaFile, slot: number): ItemMeta[] {
  return Object.values(items.items).filter((item) => item.equipment?.some((e) => e.slot === slot));
}

// =============================================================================
// TOOL DATA
// =============================================================================

export function getToolStats(items: ItemsMetaFile, id: string): ToolStats | null {
  return items.items[id]?.tool ?? null;
}

export function findTools(items: ItemsMetaFile): ItemMeta[] {
  return Object.values(items.items).filter((item) => item.tool);
}

export function findToolsByType(items: ItemsMetaFile, toolType: number): ItemMeta[] {
  return Object.values(items.items).filter((item) => item.tool?.type === toolType);
}

// =============================================================================
// FOOD DATA
// =============================================================================

export function getFoodStats(items: ItemsMetaFile, id: string): FoodStats | null {
  return items.items[id]?.food ?? null;
}

export function findFood(items: ItemsMetaFile): ItemMeta[] {
  return Object.values(items.items).filter((item) => item.food);
}

export function findFoodBySatiation(items: ItemsMetaFile, descending: true): ItemMeta[] {
  const food = findFood(items);
  return food.sort((a, b) => {
    const aVal = a.food?.satiation ?? 0;
    const bVal = b.food?.satiation ?? 0;
    return descending ? bVal - aVal : aVal - bVal;
  });
}

// =============================================================================
// GENERAL FILTERING
// =============================================================================

export function findItemsByTag(items: ItemsMetaFile, tagMatch: string): ItemMeta[] {
  const lower = tagMatch.toLowerCase();
  return Object.values(items.items).filter((item) => item.tag?.toLowerCase().includes(lower));
}

export function findItemsByTier(items: ItemsMetaFile, tier: number): ItemMeta[] {
  return Object.values(items.items).filter((item) => item.tier === tier);
}

export function findItemsByRarity(items: ItemsMetaFile, rarity: number): ItemMeta[] {
  return Object.values(items.items).filter((item) => item.rarity === rarity);
}
