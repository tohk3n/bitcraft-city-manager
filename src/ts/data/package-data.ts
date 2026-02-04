/**
 * Package Data Utilities
 *
 * Lookups and conversions for package ↔ item relationships.
 * Packages are cargo entities that bundle N items into one cargo unit.
 *
 * Operates on packages.json data. All functions are pure — accept data
 * as parameters, return results, no side effects.
 */

import type { PackagesFile, PackageEntry } from './types.js';

// =============================================================================
// LOOKUPS
// =============================================================================

/**
 * Get the package entry for an item ID.
 * Returns the cargo ID, multiplier, and package name.
 */
export function getPackageForItem(
  packages: PackagesFile,
  itemId: string
): PackageEntry | null {
  return packages.byItemId[itemId] ?? null;
}

/**
 * Get the item entry for a cargo/package ID.
 * Returns the item ID, multiplier, and item name.
 */
export function getItemForPackage(
  packages: PackagesFile,
  cargoId: string
): PackageEntry | null {
  return packages.byCargoId[cargoId] ?? null;
}

// =============================================================================
// MULTIPLIER UTILITIES
// =============================================================================

/**
 * Get the package multiplier for an item.
 * Returns 1 if the item has no package (safe default for multiplication).
 */
export function getPackageMultiplier(
  packages: PackagesFile,
  itemId: string
): number {
  return packages.byItemId[itemId]?.quantity ?? 1;
}

/**
 * Expand a package count into total item quantity.
 * e.g. 3 Exquisite Wood Log Packages → { itemId: "5010001", quantity: 300 }
 */
export function expandPackageQuantity(
  packages: PackagesFile,
  cargoId: string,
  packageCount: number
): { itemId: string; quantity: number } | null {
  const entry = packages.byCargoId[cargoId];
  if (!entry || !entry.itemId) return null;
  return {
    itemId: entry.itemId,
    quantity: entry.quantity * packageCount,
  };
}

// =============================================================================
// TYPE CHECKS
// =============================================================================

/**
 * Check if an item can be packaged into cargo.
 */
export function isPackageable(packages: PackagesFile, itemId: string): boolean {
  return itemId in packages.byItemId;
}

/**
 * Check if a cargo ID is a package.
 */
export function isPackage(packages: PackagesFile, cargoId: string): boolean {
  return cargoId in packages.byCargoId;
}

// =============================================================================
// BULK OPERATIONS
// =============================================================================

/**
 * Get all item IDs that have a corresponding package.
 */
export function getAllPackageableItems(packages: PackagesFile): string[] {
  return Object.keys(packages.byItemId);
}

/**
 * Get all cargo IDs that are packages.
 */
export function getAllPackages(packages: PackagesFile): string[] {
  return Object.keys(packages.byCargoId);
}