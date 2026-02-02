/**
 * Station Data Utilities
 */

import type {
    StationsFile,
    StationEntry,
    RecipesFile,
    RecipeEntry
} from './types.js';
import { getRecipeById } from './recipe-data.js';

// =============================================================================
// LOOKUPS
// =============================================================================

/**
 * Get station entry by type ID
 */
export function getStation(stations: StationsFile, typeId: number): StationEntry | null {
    return stations.byType[String(typeId)] ?? null;
}

/**
 * Get station name by type ID
 */
export function getStationName(stations: StationsFile, typeId: number): string | null {
    return stations.byType[String(typeId)]?.name ?? null;
}

/**
 * Get all station type IDs
 */
export function getAllStationTypes(stations: StationsFile): number[] {
    return Object.keys(stations.byType).map(Number);
}

// =============================================================================
// CRAFTABLE ITEMS
// =============================================================================

export function getCraftableItemIds(
    stations: StationsFile,
    stationType: number,
    tier: number
): string[] {
    const station = getStation(stations, stationType);
    if (!station) return [];
    return station.tiers[String(tier)] ?? [];
}

export function getAllCraftableItemIds(
    stations: StationsFile,
    stationType: number
): string[] {
    const station = getStation(stations, stationType);
    if (!station) return [];
    return Object.values(station.tiers).flat();
}

export function getCraftableRecipes(
    stations: StationsFile,
    recipes: RecipesFile,
    stationType: number,
    tier: number
): RecipeEntry[] {
    const itemIds = getCraftableItemIds(stations, stationType, tier);
    return itemIds
        .map(id => getRecipeById(recipes, id))
        .filter((r): r is RecipeEntry => r !== null);
}

export function getAllCraftableRecipes(
    stations: StationsFile,
    recipes: RecipesFile,
    stationType: number
): RecipeEntry[] {
    const itemIds = getAllCraftableItemIds(stations, stationType);
    return itemIds
        .map(id => getRecipeById(recipes, id))
        .filter((r): r is RecipeEntry => r !== null);
}

// =============================================================================
// STATION QUERIES
// =============================================================================

export function getStationTiers(stations: StationsFile, stationType: number): number[] {
    const station = getStation(stations, stationType);
    if (!station) return [];
    return Object.keys(station.tiers).map(Number).sort((a, b) => a - b);
}

export function getStationTierCounts(
    stations: StationsFile,
    stationType: number
): Map<number, number> {
    const station = getStation(stations, stationType);
    const counts = new Map<number, number>();

    if (!station) return counts;

    for (const [tier, items] of Object.entries(station.tiers)) {
        counts.set(Number(tier), items.length);
    }

    return counts;
}

export function findStationForItem(
    recipes: RecipesFile,
    itemId: string
): { type: number; tier: number; name: string | null } | null {
    const recipe = getRecipeById(recipes, itemId);
    if (!recipe?.station) return null;

    return {
        type: recipe.station.type,
        tier: recipe.station.tier,
        name: recipe.station.name
    };
}

export function getStationSummary(
  stations: StationsFile
) {
  return Object.entries(stations.byType).map(([typeStr, station]) => {
    const tiers = Object.values(station.tiers);
    const itemCount = tiers.flat().length;
    const tierCount = tiers.length;

    return {
      type: Number(typeStr),
      name: station.name,
      tierCount,
      itemCount
    };
  });
}
