/**
 * Data Loader
 */

import type {
  RecipesFile,
  ItemsMetaFile,
  StationsFile,
  GatheredFile,
  PackagesFile,
} from './types.js';

// =============================================================================
// CACHE
// =============================================================================

interface DataCache {
  recipes: RecipesFile | null;
  itemsMeta: ItemsMetaFile | null;
  stations: StationsFile | null;
  gathered: GatheredFile | null;
  gatheredSet: Set<string> | null;
  packages: PackagesFile | null;
}

const cache: DataCache = {
  recipes: null,
  itemsMeta: null,
  stations: null,
  gathered: null,
  gatheredSet: null,
  packages: null,
};

// =============================================================================
// LOADERS
// =============================================================================

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

export async function loadRecipes(): Promise<RecipesFile> {
  if (!cache.recipes) {
    cache.recipes = await fetchJson<RecipesFile>('/data/bitjita/recipes.json');
  }
  return cache.recipes;
}

// Load items-meta.json (for market stats, equipment stats, etc.)
export async function loadItemsMeta(): Promise<ItemsMetaFile> {
  if (!cache.itemsMeta) {
    cache.itemsMeta = await fetchJson<ItemsMetaFile>('/data/bitjita/items-meta.json');
  }
  return cache.itemsMeta;
}

export async function loadStations(): Promise<StationsFile> {
  if (!cache.stations) {
    cache.stations = await fetchJson<StationsFile>('/data/bitjita/stations.json');
  }
  return cache.stations;
}

// Load gathered.json and build lookup set
export async function loadGathered(): Promise<Set<string>> {
  if (!cache.gatheredSet) {
    if (!cache.gathered) {
      cache.gathered = await fetchJson<GatheredFile>('/data/bitjita/gathered.json');
    }
    cache.gatheredSet = new Set(cache.gathered.items);
  }
  return cache.gatheredSet;
}

export async function loadPackages(): Promise<PackagesFile> {
  if (!cache.packages) {
    cache.packages = await fetchJson<PackagesFile>('/data/bitjita/packages.json');
  }
  return cache.packages;
}

export async function loadCoreData(): Promise<{
  recipes: RecipesFile;
  gathered: Set<string>;
}> {
  const [recipes, gathered] = await Promise.all([loadRecipes(), loadGathered()]);
  return { recipes, gathered };
}

export async function loadAllData(): Promise<{
  recipes: RecipesFile;
  itemsMeta: ItemsMetaFile;
  stations: StationsFile;
  gathered: Set<string>;
  packages: PackagesFile;
}> {
  const [recipes, itemsMeta, stations, gathered, packages] = await Promise.all([
    loadRecipes(),
    loadItemsMeta(),
    loadStations(),
    loadGathered(),
    loadPackages(),
  ]);
  return { recipes, itemsMeta, stations, gathered, packages };
}

// =============================================================================
// CACHE MANAGEMENT
// =============================================================================

/**
 * Clear all cached data (mostly for testing...or a forced refresh)
 */
export function clearCache(): void {
  cache.recipes = null;
  cache.itemsMeta = null;
  cache.stations = null;
  cache.gathered = null;
  cache.gatheredSet = null;
  cache.packages = null;
}

/**
 * Check if specific data is loaded
 */
export function isLoaded(key: keyof Omit<DataCache, 'gatheredSet'>): boolean {
  return cache[key] !== null;
}