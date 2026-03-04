// Sub-view config transformer.
// Pure function: ProcessedInventory + Package + ProfessionDef -> SubViewConfig.
// No DOM, no side effects.
//
// Bottleneck data is optional. Pass null and the view renders without it.
// When async bottleneck calc finishes, call the transformer again and
// update() the sub-view handle.

import type { ProcessedInventory, Package, TagGroup } from '../types';
import type {
  SubViewConfig,
  SubViewRow,
  SubViewSection,
  CargoData,
  ConsumableStatus,
} from '../components/sub-view';
import type {
  ProfessionDef,
  SectionDef,
  ConsumableDef,
  RowDef,
} from '../configuration/sub-view.js';
import { CONFIG } from '../configuration/config.js';

// -- public --

export function buildSubViewConfig(
  inventory: ProcessedInventory,
  packages: Package,
  profession: ProfessionDef
): SubViewConfig {
  return {
    title: profession.title,
    cargo: profession.cargo ? buildCargo(inventory, profession.cargo) : null,
    consumables: buildConsumables(inventory, profession.consumables),
    bottlenecks: [], // populated by a separate pass when bottleneck calc is wired
    sections: profession.sections.map((s) => buildSection(inventory, packages, s)),
  };
}

// -- cargo --

function buildCargo(
  inventory: ProcessedInventory,
  cargoDef: { name: string; tag: string }
): CargoData {
  const tiers = emptyTiers();
  const group = findTagGroup(inventory, cargoDef.tag);
  if (group) {
    for (const item of Object.values(group.items)) {
      tiers[clampTierIndex(item.tier)] += item.qty;
    }
  }
  return { name: cargoDef.name, tiers };
}

// -- consumables --

// looked up by exact name across all categories, collapsed to a single total
function buildConsumables(
  inventory: ProcessedInventory,
  defs: ConsumableDef[]
): ConsumableStatus[] {
  return defs.map((def) => {
    let total = 0;
    for (const category of Object.values(inventory)) {
      for (const tagGroup of Object.values(category)) {
        for (const item of Object.values(tagGroup.items)) {
          if (item.name === def.name) total += item.qty;
        }
      }
    }
    return {
      name: def.name.toLowerCase(),
      value: total,
      hint: def.hint,
    };
  });
}

// -- sections --

function buildSection(
  inventory: ProcessedInventory,
  packages: Package,
  sectionDef: SectionDef
): SubViewSection {
  return {
    label: sectionDef.label,
    rows: sectionDef.rows.map((r) => buildRow(inventory, packages, r)),
  };
}

function buildRow(inventory: ProcessedInventory, packages: Package, rowDef: RowDef): SubViewRow {
  const tiers = emptyTiers();
  const label = rowDef.label ?? rowDef.key.toLowerCase();

  if (rowDef.source === 'tag') {
    aggregateByTag(inventory, rowDef.key, tiers);
  } else {
    // name-based: could be a regular item or a package
    const found = aggregateByName(inventory, rowDef.key, tiers);
    if (!found) {
      aggregateFromPackages(packages, rowDef.key, tiers);
    }
  }

  return {
    key: rowDef.key,
    label,
    tiers,
    cls: rowDef.cls,
  };
}

// -- inventory traversal --

// aggregate all items with a matching tag across all categories
function aggregateByTag(inventory: ProcessedInventory, tag: string, tiers: number[]): void {
  const group = findTagGroup(inventory, tag);
  if (!group) return;
  for (const item of Object.values(group.items)) {
    tiers[clampTierIndex(item.tier)] += item.qty;
  }
}

// find a specific item by exact name, returns true if found
function aggregateByName(
  inventory: ProcessedInventory,
  itemName: string,
  tiers: number[]
): boolean {
  let found = false;
  for (const category of Object.values(inventory)) {
    for (const tagGroup of Object.values(category)) {
      for (const item of Object.values(tagGroup.items)) {
        if (item.name === itemName) {
          tiers[clampTierIndex(item.tier)] += item.qty;
          found = true;
        }
      }
    }
  }
  return found;
}

// packages are keyed by stripped name (no tier specifier)
function aggregateFromPackages(packages: Package, packageName: string, tiers: number[]): void {
  const pkg = packages[packageName];
  if (!pkg) return;
  for (const item of Object.values(pkg)) {
    tiers[clampTierIndex(item.tier)] += item.qty;
  }
}

// walk the full inventory tree to find a TagGroup by tag string
// tags are second-level keys: inventory[category][tag]
function findTagGroup(inventory: ProcessedInventory, tag: string): TagGroup | null {
  for (const category of Object.values(inventory)) {
    if (category[tag]) return category[tag];
  }
  return null;
}

// -- helpers --

function emptyTiers(): number[] {
  return new Array(CONFIG.MAX_TIER).fill(0);
}

function clampTierIndex(tier: number): number {
  if (tier < 1) return 0;
  if (tier > CONFIG.MAX_TIER) return CONFIG.MAX_TIER - 1;
  return tier - 1;
}
