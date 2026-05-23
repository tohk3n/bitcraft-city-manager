/**
 * Craft Time Calculator, Pure Math
 *
 * All the number-crunching, none of the pixels.
 * Takes recipe performance data + character stats, returns timing results.
 *
 * ADR: Use per-recipe values from the API (effort, swingTime, staminaPerSwing)
 * instead of the old per-tier lookup tables. The standalone calculator approximated
 * these with reverse-engineered tier constants, close but not exact. The API gives
 * canonical values per recipe, so use those directly.
 *
 * The API's `actionsRequired` is the effort pool, NOT the swing count. The user's
 * progress-per-swing (from tool power / skill / buffs) determines actual swings:
 *   swings = ceil(effort / progressPerSwing)
 * The standalone calculator had this right with its two-input model.
 * I was wrong when I said it collapsed to one value. Lesson learned.
 */

// =============================================================================
// TYPES
// =============================================================================

/** What the recipe gives (from recipes.json) */
export interface RecipePerformance {
  effort: number; // the work pool per craft (actionsRequired in API)
  swingTime: number; // seconds per swing
  staminaPerSwing: number; // stamina consumed per swing
  xpPerSwing: number; // XP granted per swing
}

/**
 * What the player brings to the table.
 *
 * progressPerSwing is the tricky one, it's character-dependent (tool power,
 * skill level, buffs) and NOT in the recipe data. The recipe says "90 effort",
 * your character does 20 progress per swing, so ceil(90/20) = 5 actual swings.
 * Users will need to read this from their in-game crafting UI.
 */
export interface CharacterStats {
  progressPerSwing: number; // how much effort each swing removes
  totalStamina: number; // max stamina bar
  foodRegenPerSec: number; // stamina regen from food (0 = no food)
  activeRegenPerSec: number; // passive/equipment regen while crafting
}

/** Everything you need to know before committing hours of your life */
export interface CraftTimeResult {
  totalSwings: number;
  swingTime: number;
  activeTime: number; // seconds actually swinging
  swingsPerBar: number; // swings before stamina depletes
  staminaCycles: number; // how many times you drain and refill
  restTime: number; // total seconds spent staring at the screen waiting
  totalTime: number; // activeTime + restTime
  totalXP: number;
  totalStaminaCost: number; // total stamina consumed (for the curious)
}

// =============================================================================
// FOOD REGEN TABLE
// =============================================================================

// These come from the game client, not the API. API has foodStats.satiation
// but the regen rate per food tier is a client-side constant.
// If this ever drifts, check the game's food buff tooltip.
const FOOD_REGEN: Record<number, number> = {
  0: 0.25,
  1: 7.25,
  2: 9.25,
  3: 11.25,
  4: 13.25,
  5: 15.25,
  6: 17.25,
  7: 19.25,
  8: 21.25,
  9: 23.25,
  10: 25.25,
};

/** Look up stamina regen rate for a food tier. Returns base regen if unknown. */
export function getFoodRegen(foodTier: number): number {
  return FOOD_REGEN[foodTier] ?? FOOD_REGEN[0];
}

/** All valid food tiers for UI dropdowns */
export function getFoodTiers(): { tier: number; regenPerSec: number }[] {
  return Object.entries(FOOD_REGEN).map(([tier, regen]) => ({
    tier: Number(tier),
    regenPerSec: regen,
  }));
}

// =============================================================================
// CALCULATIONS
// =============================================================================

/**
 * How many swings before your stamina bar is empty.
 *
 * Active regen partially offsets drain, each swing takes swingTime seconds,
 * during which you regen (swingTime × activeRegen) stamina. Net drain per
 * swing is (staminaPerSwing - swingTime × activeRegen).
 *
 * Edge case: if regen >= drain, you never run out. Return Infinity.
 */
export function calcSwingsPerBar(
  totalStamina: number,
  staminaPerSwing: number,
  swingTime: number,
  activeRegenPerSec: number
): number {
  const netDrain = staminaPerSwing - swingTime * activeRegenPerSec;
  if (netDrain <= 0) return Infinity; // regen outpaces drain, swing forever
  return Math.floor(totalStamina / netDrain);
}

/**
 * How many full drain/refill cycles to complete the craft.
 * 1 cycle = no rest needed. 2+ = you're going to wait.
 */
export function calcStaminaCycles(totalSwings: number, swingsPerBar: number): number {
  if (swingsPerBar === Infinity) return 1;
  if (swingsPerBar <= 0) return Infinity; // shouldn't happen, but don't divide by zero
  return Math.ceil(totalSwings / swingsPerBar);
}

/**
 * Total rest time between stamina cycles.
 *
 * You rest (cycles - 1) times. Each rest refills your full bar.
 * Rest regen = food regen (you're not swinging, so no active drain/regen).
 *
 * Returns 0 if no rest needed (single cycle or infinite swings).
 */
export function calcRestTime(
  staminaCycles: number,
  totalStamina: number,
  foodRegenPerSec: number
): number {
  if (staminaCycles <= 1) return 0;
  if (foodRegenPerSec <= 0) return Infinity; // defensive, shouldn't happen, base regen is 0.25/s
  const restPeriods = staminaCycles - 1;
  const timePerRest = totalStamina / foodRegenPerSec;
  return restPeriods * timePerRest;
}

// --- MAIN CALCULATION ---

/**
 * Calculate everything for a single craft operation.
 *
 * craftCount: how many of this item you're making (multiplies effort).
 * Defaults to 1
 * Planner integration will want to pass deficit quantities.
 */
export function calculateCraftTime(
  recipe: RecipePerformance,
  character: CharacterStats,
  craftCount = 1
): CraftTimeResult {
  // The core math the standalone calculator had right all along:
  // effort is the work pool, progress chews through it each swing
  const swingsPerCraft = Math.ceil(recipe.effort / character.progressPerSwing);
  const totalSwings = swingsPerCraft * craftCount;
  const activeTime = totalSwings * recipe.swingTime;

  const swingsPerBar = calcSwingsPerBar(
    character.totalStamina,
    recipe.staminaPerSwing,
    recipe.swingTime,
    character.activeRegenPerSec
  );

  const staminaCycles = calcStaminaCycles(totalSwings, swingsPerBar);
  const restTime = calcRestTime(staminaCycles, character.totalStamina, character.foodRegenPerSec);

  return {
    totalSwings,
    swingTime: recipe.swingTime,
    activeTime,
    swingsPerBar: swingsPerBar === Infinity ? totalSwings : swingsPerBar,
    staminaCycles: staminaCycles === Infinity ? 1 : staminaCycles,
    restTime: restTime === Infinity ? 0 : restTime,
    totalTime: activeTime + (restTime === Infinity ? 0 : restTime),
    totalXP: totalSwings * recipe.xpPerSwing,
    totalStaminaCost: totalSwings * recipe.staminaPerSwing,
  };
}

// --- FORMATTING ---

/** "2h 14m 30s" or "14m 30s" or "30s", no leading zeros, no fluff */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** "1,234" or "1.2K" or "1.2M", compact for UI, full for small numbers */
export function formatNumber(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
}
