// Gear resolution, figures out what a citizen is wearing and carrying.
//
// The game has two sources of gear: equipped items (from the equipment API)
// and vault collectibles (from the vault API). A citizen might have a T3
// epic chestpiece equipped but a T4 legendary one sitting in their vault.
// We want to show the best available per slot, noting which is vault-only.
//
// Tools come from player inventories. The toolbelt is "equipped", everything
// else is stashed. We group by skill so the detail view can show "Mining: T2
// Pickaxe (equipped) +1 stashed".

import { CITIZEN_CONFIG } from '../configuration/citizenconfig.js';
import type { EquipmentSlot, VaultCollectible, PlayerInventoriesResponse } from '../types/index.js';
import type { GearSlot, ToolItem } from '../types/citizens.js';

const SLOTS = CITIZEN_CONFIG.EQUIPMENT_SLOTS;
const GEAR_TYPES = CITIZEN_CONFIG.GEAR_TYPES;
const SLOT_CODES = CITIZEN_CONFIG.SLOT_TYPE_CODES as Record<string, number>;
const RARITY_ORDER = CITIZEN_CONFIG.RARITY_ORDER;

export function rarityRank(r: string): number {
  const idx = RARITY_ORDER.indexOf(r.toLowerCase());
  return idx === -1 ? -1 : idx;
}

export function filterVaultGear(collectibles: VaultCollectible[]): VaultCollectible[] {
  const validTypes = new Set(Object.values(SLOT_CODES));
  const validTags = new Set(CITIZEN_CONFIG.CLOTHING_TAGS);
  return collectibles.filter(
    (item) => validTypes.has(item.type) && validTags.has(item.tag) && item.tier > 0
  );
}

/**
 * Build a grid[gearType][slot] = best GearSlot for each combination.
 *
 * For each gear type (cloth/leather/metal) × body slot (head/chest/...),
 * check equipped items first, then vault items. Keep whichever has higher
 * tier, breaking ties by rarity rank. Vault items that beat equipped gear
 * are tagged source:'vault' so the UI can flag them.
 *
 * Why check both "Clothing" and "Armor" tags: the game has separate item
 * categories for each material (e.g. "Cloth Clothing" and "Cloth Armor")
 * but they occupy the same equipment slot. A citizen might have armor in
 * their vault and clothing equipped, or vice versa.
 */
export function resolveGearGrid(
  equipment: EquipmentSlot[],
  vaultGear: VaultCollectible[]
): Record<string, Record<string, GearSlot | null>> {
  const grid: Record<string, Record<string, GearSlot | null>> = {};

  for (const gearType of GEAR_TYPES) {
    const gearBase = gearType.split(' ')[0];
    const gearKey = gearBase.toLowerCase();
    grid[gearKey] = {};

    for (const slot of SLOTS) {
      const equipped = equipment.find((e) => e.primary === slot && e.item?.tags === gearType);
      let best: GearSlot | null = null;

      if (equipped?.item) {
        best = {
          name: equipped.item.name,
          tier: equipped.item.tier,
          rarity: (equipped.item.rarityString || '').toLowerCase(),
          source: 'equipped',
        };
      }

      const targetType = SLOT_CODES[slot];
      const possibleTags = [`${gearBase} Clothing`, `${gearBase} Armor`];
      const vaultMatches = vaultGear.filter(
        (v) => v.type === targetType && possibleTags.includes(v.tag)
      );

      for (const v of vaultMatches) {
        const vr = (v.rarityStr || '').toLowerCase();
        const dominated =
          !best ||
          v.tier > best.tier ||
          (v.tier === best.tier && rarityRank(vr) > rarityRank(best.rarity));
        if (dominated) {
          best = { name: v.name, tier: v.tier, rarity: vr, source: 'vault' };
        }
      }

      grid[gearKey][slot] = best;
    }
  }

  return grid;
}

/**
 * Extract tools from player inventories.
 *
 * Tools are identified by having a toolType on their item metadata.
 * Items in the "Toolbelt" inventory are considered equipped; everything
 * else is stashed. Sorted: equipped first, then alphabetically by tag,
 * then by rarity descending (so the best tool surfaces first).
 */
export function parseTools(resp: PlayerInventoriesResponse): ToolItem[] {
  const items = resp.items || {};
  const tools: ToolItem[] = [];

  for (const inv of resp.inventories || []) {
    const source = inv.inventoryName || 'Unknown';
    const isToolbelt = source === 'Toolbelt';

    for (const pocket of inv.pockets || []) {
      if (!pocket.contents) continue;
      const meta = items[String(pocket.contents.itemId)];
      if (!meta?.toolType) continue;

      tools.push({
        name: meta.name,
        tier: meta.tier,
        rarity: (meta.rarityStr || 'common').toLowerCase(),
        tag: meta.tag || 'Tool',
        toolLevel: meta.toolLevel || 0,
        toolPower: meta.toolPower || 0,
        toolType: meta.toolType,
        toolSkillId: meta.toolSkillId || 0,
        equipped: isToolbelt,
        source,
      });
    }
  }

  return tools.sort((a, b) => {
    if (a.equipped !== b.equipped) return a.equipped ? -1 : 1;
    if (a.tag !== b.tag) return a.tag.localeCompare(b.tag);
    return rarityRank(b.rarity) - rarityRank(a.rarity);
  });
}

export function shortToolName(tool: ToolItem): string {
  const words = tool.name.split(' ');
  return words.length > 1 ? words[words.length - 1] : tool.name;
}
