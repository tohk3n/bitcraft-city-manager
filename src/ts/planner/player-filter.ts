/**
 * Player Capability Filter
 *
 * Three game rules gate what a player can work on:
 *   1. Skill:   floor(level / 10) >= itemTier
 *   2. Tool:    toolTier + 1 >= itemTier
 *   3. Station: claim owns a station of that function_type at >= itemTier
 *
 * Uses real recipe data (stationType, skillName, skillLevel) carried
 * through the pipeline from RecipeEntry → ExpandedNode → PlanItem.
 * Falls back to pass-through for items missing recipe data (gathered
 * items with no recipe entry).
 */

import type { PlanItem } from '../types/index.js';

// ── Types ─────────────────────────────────────────────────────────

/** Skill name → level (e.g. { Carpentry: 40, Mining: 25 }) */
export type PlayerSkills = Record<string, number>;

/** Skill name → best tool tier the player has for that skill */
export type PlayerTools = Record<string, number>;

/** Station function_type → highest tier of that station in the claim */
export type ClaimStations = Record<number, number>;

export interface FilterContext {
  player: { skills: PlayerSkills; tools: PlayerTools };
  stations: ClaimStations;
}

// ── Core ──────────────────────────────────────────────────────────

export function effectiveTier(skillLevel: number, toolTier: number): number {
  return Math.min(Math.floor(skillLevel / 10), toolTier + 1);
}

/**
 * Items without recipe data (no skill/station) always pass.
 * Better to show something we can't classify than to hide it.
 */
export function canPlayerWork(item: PlanItem, ctx: FilterContext): boolean {
  if (item.tier === 0) return true;

  // Skill + tool check
  if (item.skillName) {
    const cap = effectiveTier(
      ctx.player.skills[item.skillName] ?? 0,
      ctx.player.tools[item.skillName] ?? 0
    );
    if (cap < item.tier) return false;
  }

  // Station check — uses function_type from the recipe, matched against
  // the claim's buildings which share the same function_type identifier
  if (item.stationType != null) {
    if ((ctx.stations[item.stationType] ?? 0) < item.tier) return false;
  }

  return true;
}

export function filterByCapability(items: PlanItem[], ctx: FilterContext): PlanItem[] {
  return items.filter((item) => canPlayerWork(item, ctx));
}
