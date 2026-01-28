/**
 * Inventory Matcher
 * 
 * Builds and queries inventory lookups from API data.
 * Handles package expansion and name normalization.
 */

import type {
    ApiItem,
    ApiCargo,
    Building,
    InventoryLookup,
    MetaLookups
} from '../../types.js';

const PACKAGE_MULTIPLIERS: Record<string, number> = {
    default: 100,
    flower: 500,
    fiber: 1000
};

export function normalizeName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function createKey(name: string, tier: number): string {
    return `${normalizeName(name)}:${tier}`;
}

function getPackageMultiplier(name: string, tag: string): number {
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

function isPackage(name: string, tag: string): boolean {
    const lowerName = name.toLowerCase();
    const lowerTag = tag.toLowerCase();
    return lowerTag.includes('package') || lowerName.includes('package');
}

function extractBaseItemName(name: string): string {
    return name
        .replace(/package\s+of\s+/i, '')
        .replace(/\s+package$/i, '')
        .trim();
}

export function buildInventoryLookup(
    buildings: Building[],
    itemMeta: Record<number, ApiItem>,
    cargoMeta: Record<number, ApiCargo>
): InventoryLookup {
    const lookup: InventoryLookup = new Map();

    for (const building of buildings) {
        for (const slot of building.inventory || []) {
            const contents = slot.contents;
            if (!contents) continue;

            const meta = contents.item_type === 'item'
                ? itemMeta[contents.item_id]
                : cargoMeta[contents.item_id];
            if (!meta) continue;

            const tag = meta.tag || '';
            let name = meta.name;
            let qty = contents.quantity;

            if (isPackage(name, tag)) {
                name = extractBaseItemName(name);
                qty *= getPackageMultiplier(name, tag);
            }

            const key = createKey(name, meta.tier ?? 0);
            lookup.set(key, (lookup.get(key) || 0) + qty);
        }
    }

    return lookup;
}

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