/**
 * Inventory Matcher
 *
 * Builds inventory lookups from API data.
 * Package expansion uses canonical data from packages.json.
 */

import { getItemForPackage } from '../../data/package-data.js';
import type {
  ApiItem,
  ApiCargo,
  Building,
  InventoryLookup,
  MetaLookups,
} from '../../types/index.js';
import type { PackagesFile } from '../../data/types.js';

export function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function createKey(name: string, tier: number): string {
  return `${normalizeName(name)}:${tier}`;
}

export function buildInventoryLookup(
  buildings: Building[],
  itemMeta: Record<number, ApiItem>,
  cargoMeta: Record<number, ApiCargo>,
  packages: PackagesFile
): InventoryLookup {
  const lookup: InventoryLookup = new Map();

  for (const building of buildings) {
    for (const slot of building.inventory || []) {
      const contents = slot.contents;
      if (!contents) continue;

      const isCargo = contents.item_type === 'cargo';
      const meta = isCargo ? cargoMeta[contents.item_id] : itemMeta[contents.item_id];
      if (!meta) continue;

      let name = meta.name;
      const tier = meta.tier ?? 0;
      let qty = contents.quantity;

      // If this is a cargo slot, check if it's a package
      if (isCargo) {
        const packageEntry = getItemForPackage(packages, String(contents.item_id));
        if (packageEntry) {
          // Use the base item's name and expand the quantity
          name = packageEntry.name;
          qty *= packageEntry.quantity;
          // Tier comes from the cargo meta (package inherits the item's tier)
        }
      }

      const key = createKey(name, tier);
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
