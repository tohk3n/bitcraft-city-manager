import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  loadRecipes,
  loadItemsMeta,
  loadStations,
  loadGathered,
  loadPackages,
  loadCoreData,
  loadAllData,
  clearCache,
  isLoaded,
} from '../loader.js';

// =============================================================================
// MOCK SETUP
// =============================================================================

const mockRecipesData = {
  version: 2,
  generated: '2026-01-31',
  source: 'test',
  byId: { '1001': { id: '1001', name: 'Test Item' } },
  byKey: { 'Test Item:1': '1001' },
};

const mockItemsMetaData = {
  version: 1,
  generated: '2026-01-31',
  items: { '1001': { id: '1001', name: 'Test Item', tier: 1 } },
};

const mockStationsData = {
  version: 1,
  generated: '2026-01-31',
  byType: { '20': { name: 'Test Station', tiers: { '1': ['1001'] } } },
};

const mockGatheredData = {
  version: 1,
  generated: '2026-01-31',
  items: ['1001', '1002', '1003'],
};

const mockPackagesData = {
  version: 1,
  generated: '2026-02-02',
  byItemId: {
    '2001': { cargoId: '3001', quantity: 100, name: 'Test Package' },
  },
  byCargoId: {
    '3001': { itemId: '2001', quantity: 100, name: 'Test Item' },
  },
};

function createMockFetch() {
  return vi.fn((url: string) => {
    let data;
    if (url.includes('recipes.json')) data = mockRecipesData;
    else if (url.includes('items-meta.json')) data = mockItemsMetaData;
    else if (url.includes('stations.json')) data = mockStationsData;
    else if (url.includes('gathered.json')) data = mockGatheredData;
    else if (url.includes('packages.json')) data = mockPackagesData;
    else return Promise.resolve({ ok: false, status: 404 });

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(data),
    });
  });
}

// =============================================================================
// TESTS
// =============================================================================

describe('loader', () => {
  beforeEach(() => {
    clearCache();
    global.fetch = createMockFetch() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadRecipes', () => {
    it('loads recipes data', async () => {
      const recipes = await loadRecipes();
      expect(recipes.version).toBe(2);
      expect(recipes.byId['1001'].name).toBe('Test Item');
    });

    it('caches on subsequent calls', async () => {
      await loadRecipes();
      await loadRecipes();
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('loadItemsMeta', () => {
    it('loads items meta data', async () => {
      const items = await loadItemsMeta();
      expect(items.version).toBe(1);
      expect(items.items['1001'].name).toBe('Test Item');
    });
  });

  describe('loadStations', () => {
    it('loads stations data', async () => {
      const stations = await loadStations();
      expect(stations.byType['20'].name).toBe('Test Station');
    });
  });

  describe('loadGathered', () => {
    it('loads gathered data and returns Set', async () => {
      const gathered = await loadGathered();
      expect(gathered).toBeInstanceOf(Set);
      expect(gathered.has('1001')).toBe(true);
      expect(gathered.has('1002')).toBe(true);
      expect(gathered.size).toBe(3);
    });

    it('caches the Set', async () => {
      await loadGathered();
      await loadGathered();
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('loadPackages', () => {
    it('loads packages data', async () => {
      const packages = await loadPackages();
      expect(packages.version).toBe(1);
      expect(packages.byItemId['2001'].cargoId).toBe('3001');
      expect(packages.byCargoId['3001'].itemId).toBe('2001');
    });

    it('caches on subsequent calls', async () => {
      await loadPackages();
      await loadPackages();
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('loadCoreData', () => {
    it('loads recipes and gathered in parallel', async () => {
      const { recipes, gathered } = await loadCoreData();
      expect(recipes.version).toBe(2);
      expect(gathered.has('1001')).toBe(true);
    });
  });

  describe('loadAllData', () => {
    it('loads all data files', async () => {
      const { recipes, itemsMeta, stations, gathered, packages } = await loadAllData();
      expect(recipes.version).toBe(2);
      expect(itemsMeta.version).toBe(1);
      expect(stations.byType['20']).toBeDefined();
      expect(gathered.size).toBe(3);
      expect(packages.version).toBe(1);
      expect(packages.byItemId['2001']).toBeDefined();
    });
  });

  describe('isLoaded', () => {
    it('returns false before loading', () => {
      expect(isLoaded('recipes')).toBe(false);
      expect(isLoaded('itemsMeta')).toBe(false);
    });

    it('returns true after loading', async () => {
      await loadRecipes();
      expect(isLoaded('recipes')).toBe(true);
      expect(isLoaded('itemsMeta')).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('clears all cached data', async () => {
      await loadRecipes();
      expect(isLoaded('recipes')).toBe(true);

      clearCache();
      expect(isLoaded('recipes')).toBe(false);
    });

    it('forces reload on next call', async () => {
      await loadRecipes();
      clearCache();
      await loadRecipes();
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('throws on failed fetch', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({ ok: false, status: 500 })
      ) as unknown as typeof fetch;

      await expect(loadRecipes()).rejects.toThrow('Failed to load');
    });
  });
});
