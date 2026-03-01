/**
 * Player Context Builder
 *
 * Bridges citizen API data into the FilterContext that player-filter consumes.
 *
 * The tricky bit: tools have a toolSkillId (number) but FilterContext wants
 * skill names (string). The skillNames map from the citizens API resolves this.
 * If a tool's skillId isn't in the map, we skip it.
 */

import { API } from '../api.js';
import { createLogger } from '../logger.js';
import type { FilterContext, PlayerTools, ClaimStations } from './player-filter.js';
import type { CitizenRecord, CitizensData } from '../citizens/index.js';
import type { Building } from '../types/index.js';

const log = createLogger('PlayerCtx');

export async function buildFilterContext(
  playerId: string,
  citizensData: CitizensData,
  buildings: Building[]
): Promise<FilterContext | null> {
  const record = citizensData.records.find((r) => r.entityId === playerId);
  if (!record) {
    log.warn(`Player ${playerId} not found in citizen records`);
    return null;
  }

  if (!record.gear) {
    try {
      await loadPlayerGear(record);
    } catch (err) {
      log.warn(`Failed to load gear for ${record.userName}: ${(err as Error).message}`);
    }
  }

  return {
    player: {
      skills: record.skills ?? {},
      tools: extractTools(record, citizensData.skillNames),
    },
    stations: extractStations(buildings),
  };
}

// ── Tools ─────────────────────────────────────────────────────────

/** Best tool tier per skill name, across all player inventories. */
function extractTools(record: CitizenRecord, skillNames: Record<string, string>): PlayerTools {
  const tools: PlayerTools = {};
  if (!record.gear?.tools) return tools;

  for (const tool of record.gear.tools) {
    const skillName = skillNames[String(tool.toolSkillId)];
    if (!skillName) continue;

    const current = tools[skillName] ?? 0;
    if (tool.tier > current) {
      tools[skillName] = tool.tier;
    }
  }

  return tools;
}

// ── Stations ──────────────────────────────────────────────────────

/**
 * Highest tier per function_type from claim buildings.
 *
 * Keyed by function_type (number), not building name. This matches
 * recipe.station.type directly — no string mapping needed.
 */
function extractStations(buildings: Building[]): ClaimStations {
  const stations: ClaimStations = {};

  for (const building of buildings) {
    for (const func of building.functions ?? []) {
      if (!func.crafting_slots && !func.refining_slots) continue;

      const tier = func.level ?? 0;
      if (tier <= 0) continue;

      const type = func.function_type;
      if (type == null) continue;

      const current = stations[type] ?? 0;
      if (tier > current) {
        stations[type] = tier;
      }
    }
  }

  return stations;
}

// ── Gear Loading ──────────────────────────────────────────────────

/** Minimal fetch — just tools from player inventories. */
async function loadPlayerGear(record: CitizenRecord): Promise<void> {
  const invResp = await API.getPlayerInventories(record.entityId);
  const items = invResp.items || {};
  const tools = [];

  for (const inv of invResp.inventories || []) {
    const isToolbelt = inv.inventoryName === 'Toolbelt';
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
        source: inv.inventoryName || 'Unknown',
      });
    }
  }

  record.gear = {
    equipment: [],
    vault: [],
    grid: {},
    tools,
  };
}
