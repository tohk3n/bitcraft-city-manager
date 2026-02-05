import { describe, expect, it } from 'vitest';
import {
  getPackageForItem,
  getItemForPackage,
  getPackageMultiplier,
  expandPackageQuantity,
  isPackageable,
  isPackage,
  getAllPackageableItems,
  getAllPackages,
} from '../package-data.js';
import type { PackagesFile } from '../types.js';

// =============================================================================
// TEST FIXTURES
// =============================================================================

const mockPackages: PackagesFile = {
  version: 1,
  generated: '2026-02-02',
  byItemId: {
    '5010001': {
      cargoId: '550000',
      quantity: 100,
      name: 'Exquisite Wood Log Package',
    },
    '5010002': {
      cargoId: '550001',
      quantity: 200,
      name: 'Exquisite Parchment Package',
    },
    '5010003': {
      cargoId: '550002',
      quantity: 500,
      name: 'Simple Pebble Package',
    },
    '5010004': {
      cargoId: '550003',
      quantity: 1000,
      name: 'Plant Fiber Package',
    },
  },
  byCargoId: {
    '550000': {
      itemId: '5010001',
      quantity: 100,
      name: 'Exquisite Wood Log',
    },
    '550001': {
      itemId: '5010002',
      quantity: 200,
      name: 'Exquisite Parchment',
    },
    '550002': {
      itemId: '5010003',
      quantity: 500,
      name: 'Simple Pebble',
    },
    '550003': {
      itemId: '5010004',
      quantity: 1000,
      name: 'Plant Fiber',
    },
  },
};

const emptyPackages: PackagesFile = {
  version: 1,
  generated: '2026-02-02',
  byItemId: {},
  byCargoId: {},
};

// =============================================================================
// LOOKUPS
// =============================================================================

describe('getPackageForItem', () => {
  it('returns package entry for a packageable item', () => {
    const entry = getPackageForItem(mockPackages, '5010001');
    expect(entry).not.toBeNull();
    expect(entry?.cargoId).toBe('550000');
    expect(entry?.quantity).toBe(100);
    expect(entry?.name).toBe('Exquisite Wood Log Package');
  });

  it('returns null for non-packageable item', () => {
    expect(getPackageForItem(mockPackages, '9999')).toBeNull();
  });

  it('returns null on empty packages', () => {
    expect(getPackageForItem(emptyPackages, '5010001')).toBeNull();
  });
});

describe('getItemForPackage', () => {
  it('returns item entry for a package cargo ID', () => {
    const entry = getItemForPackage(mockPackages, '550000');
    expect(entry).not.toBeNull();
    expect(entry?.itemId).toBe('5010001');
    expect(entry?.quantity).toBe(100);
    expect(entry?.name).toBe('Exquisite Wood Log');
  });

  it('returns null for non-package cargo ID', () => {
    expect(getItemForPackage(mockPackages, '9999')).toBeNull();
  });
});

// =============================================================================
// MULTIPLIER UTILITIES
// =============================================================================

describe('getPackageMultiplier', () => {
  it('returns multiplier for packageable item', () => {
    expect(getPackageMultiplier(mockPackages, '5010001')).toBe(100);
    expect(getPackageMultiplier(mockPackages, '5010002')).toBe(200);
    expect(getPackageMultiplier(mockPackages, '5010003')).toBe(500);
    expect(getPackageMultiplier(mockPackages, '5010004')).toBe(1000);
  });

  it('returns 1 for non-packageable item (safe default)', () => {
    expect(getPackageMultiplier(mockPackages, '9999')).toBe(1);
  });
});

describe('expandPackageQuantity', () => {
  it('expands package count into total items', () => {
    const result = expandPackageQuantity(mockPackages, '550000', 3);
    expect(result).not.toBeNull();
    expect(result?.itemId).toBe('5010001');
    expect(result?.quantity).toBe(300);
  });

  it('handles 1000x multiplier', () => {
    const result = expandPackageQuantity(mockPackages, '550003', 5);
    expect(result).not.toBeNull();
    expect(result?.quantity).toBe(5000);
  });

  it('handles zero packages', () => {
    const result = expandPackageQuantity(mockPackages, '550000', 0);
    expect(result).not.toBeNull();
    expect(result?.quantity).toBe(0);
  });

  it('returns null for non-package cargo ID', () => {
    expect(expandPackageQuantity(mockPackages, '9999', 5)).toBeNull();
  });
});

// =============================================================================
// TYPE CHECKS
// =============================================================================

describe('isPackageable', () => {
  it('returns true for items with packages', () => {
    expect(isPackageable(mockPackages, '5010001')).toBe(true);
    expect(isPackageable(mockPackages, '5010004')).toBe(true);
  });

  it('returns false for items without packages', () => {
    expect(isPackageable(mockPackages, '9999')).toBe(false);
  });
});

describe('isPackage', () => {
  it('returns true for package cargo IDs', () => {
    expect(isPackage(mockPackages, '550000')).toBe(true);
    expect(isPackage(mockPackages, '550003')).toBe(true);
  });

  it('returns false for non-package cargo IDs', () => {
    expect(isPackage(mockPackages, '9999')).toBe(false);
  });
});

// =============================================================================
// BULK OPERATIONS
// =============================================================================

describe('getAllPackageableItems', () => {
  it('returns all item IDs with packages', () => {
    const ids = getAllPackageableItems(mockPackages);
    expect(ids).toHaveLength(4);
    expect(ids).toContain('5010001');
    expect(ids).toContain('5010004');
  });

  it('returns empty array for empty packages', () => {
    expect(getAllPackageableItems(emptyPackages)).toHaveLength(0);
  });
});

describe('getAllPackages', () => {
  it('returns all package cargo IDs', () => {
    const ids = getAllPackages(mockPackages);
    expect(ids).toHaveLength(4);
    expect(ids).toContain('550000');
    expect(ids).toContain('550003');
  });

  it('returns empty array for empty packages', () => {
    expect(getAllPackages(emptyPackages)).toHaveLength(0);
  });
});
