/**
 * Inventory Matcher
 *
 * Pure functions for building and querying inventory lookups.
 * No side effects, no external dependencies beyond passed parameters.
 */

import type {
    ApiItem,
    ApiCargo,
    Building,
    ItemMappingsFile,
    ItemMapping,
    InventoryLookup,
    MetaLookups,
    MappingType
} from '../../types.js';

// Package multipliers - how many individual items per package
const PACKAGE_MULTIPLIERS = {
    default: 100,
        flower: 500,
        fiber: 1000
};

/**
 * Normalize item name for consistent matching.
 */
export function normalizeName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Create a lookup key for an item.
 */
export function createKey(name: string, tier: number): string {
    return `${normalizeName(name)}:${tier}`;
}

/**
 * Determine package multiplier based on item name/tag.
 * Different item types have different package sizes.
 */
export function getPackageMultiplier(name: string, tag = ''): number {
    const lowerName = normalizeName(name);
    const lowerTag = tag.toLowerCase();

    if (lowerName.includes('flower') || lowerTag.includes('flower')) {
        return PACKAGE_MULTIPLIERS.flower;
    }
    if (lowerName.includes('fiber') || lowerTag.includes('fiber')) {
        return PACKAGE_MULTIPLIERS.fiber;
    }
    return PACKAGE_MULTIPLIERS.default;
}

/**
 * Check if an item is a package (contains multiple items).
 */
export function isPackage(name: string, tag = ''): boolean {
    const lowerName = name.toLowerCase();
    const lowerTag = tag.toLowerCase();
    return lowerTag.includes('package') || lowerName.includes('package');
}

/**
 * Extract base item name from a package name.
 * "Package of Fine Brick" -> "Fine Brick"
 * "Fine Brick Package" -> "Fine Brick"
 */
export function extractBaseItemName(name: string): string {
    return name
    .replace(/package\s+of\s+/i, '')
    .replace(/\s+package$/i, '')
    .trim();
}

/**
 * Build inventory lookup from API building data.
 * Aggregates quantities by item key, handles packages.
 */
export function buildInventoryLookup(
    buildings: Building[],
    itemMeta: Record<number, ApiItem>,
    cargoMeta: Record<number, ApiCargo>
): InventoryLookup {
    const lookup: InventoryLookup = new Map();

    for (const building of buildings) {
        const slots = building.inventory || [];

        for (const slot of slots) {
            const contents = slot.contents;
            if (!contents) continue;

            const id = contents.item_id;
            const qty = contents.quantity;
            const isItem = contents.item_type === 'item';

            // Get metadata from appropriate source
            const meta = isItem ? itemMeta[id] : cargoMeta[id];
            if (!meta) continue;

            const name = meta.name;
            const tier = meta.tier ?? 0;
            const tag = meta.tag || '';

            // Handle packages - expand to individual item count
            let effectiveQty = qty;
            let effectiveName = name;

            if (isPackage(name, tag)) {
                effectiveName = extractBaseItemName(name);
                effectiveQty = qty * getPackageMultiplier(name, tag);
            }

            // Aggregate by key
            const key = createKey(effectiveName, tier);
            lookup.set(key, (lookup.get(key) || 0) + effectiveQty);
        }
    }

    return lookup;
}

/**
 * Build metadata lookup tables from API data.
 */
export function buildMetaLookups(items: ApiItem[], cargos: ApiCargo[]): MetaLookups {
    const itemMeta: Record<number, ApiItem> = {};
    for (const item of items || []) {
        itemMeta[item.id] = item;
    }

    const cargoMeta: Record<number, ApiCargo> = {};
    for (const cargo of cargos || []) {
        cargoMeta[cargo.id] = cargo;
    }

    return { itemMeta, cargoMeta };
}

export interface ItemQuantityResult {
    qty: number;
    mapping: ItemMapping | null;
    trackable: boolean;
}

/**
 * Get quantity of an item from inventory lookup.
 * Handles tier fallbacks for tierless items.
 * Respects trackable status from mappings.
 */
export function getItemQuantity(
    lookup: InventoryLookup,
    name: string,
    tier: number,
    mappings: ItemMappingsFile | null = null
): ItemQuantityResult {
    const mapping = mappings?.mappings?.[name] || null;

    // Non-trackable items always return 0 - they don't exist in inventory
    if (mapping && mapping.trackable === false) {
        return { qty: 0, mapping, trackable: false };
    }

    // Use API equivalent name if specified in mappings
    const searchName = mapping?.apiEquivalent || name;

    // Try exact tier match first
    const key = createKey(searchName, tier);
    if (lookup.has(key)) {
        return { qty: lookup.get(key)!, mapping, trackable: true };
    }

    // Try tier -1 (tierless items like Water Bucket, Pitch)
    const keyNeg = createKey(searchName, -1);
    if (lookup.has(keyNeg)) {
        return { qty: lookup.get(keyNeg)!, mapping, trackable: true };
    }

    // Try tier 0
    const key0 = createKey(searchName, 0);
    if (lookup.has(key0)) {
        return { qty: lookup.get(key0)!, mapping, trackable: true };
    }

    // Not found - trackable but quantity is 0
    const trackable = mapping ? mapping.trackable !== false : true;
    return { qty: 0, mapping, trackable };
}

/**
 * Check if an item is trackable (can exist in inventory).
 */
export function isTrackable(name: string, mappings: ItemMappingsFile | null): boolean {
    const mapping = mappings?.mappings?.[name];
    return mapping ? mapping.trackable !== false : true;
}

/**
 * Get the mapping type for an item.
 */
export function getMappingType(name: string, mappings: ItemMappingsFile | null): MappingType {
    return mappings?.mappings?.[name]?.type || null;
}
