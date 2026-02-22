/**
 * Calculator View
 *
 * Renders the craft time calculator tab. Loads recipe data for the item picker,
 * accepts character stats, shows results. No claim required, this is a
 * standalone tool that happens to live in the same app.
 *
 * Architecture: same pattern as other views.
 * - init() wires events once
 * - render() called when tab activates
 * - Pure calc lives in craft-time-calc.ts, we just feed it and display results
 */

import { loadCoreData } from './data/loader.js';
import { createLogger } from './logger.js';
import {
  calculateCraftTime,
  formatTime,
  formatNumber,
  getFoodTiers,
  getFoodRegen,
} from './craft-time-calc.js';
import type { RecipePerformance, CharacterStats } from './craft-time-calc.js';
import type { RecipesFile, RecipeEntry } from './data/types.js';

const log = createLogger('Calculator');

// =============================================================================
// STATE
// =============================================================================

// Minimal state, just what we need to avoid redundant work
let recipes: RecipesFile | null = null;
let initialized = false;

/** Craftable items only, recipes that have timing data */
interface CraftableItem {
  id: string;
  name: string;
  tier: number;
  performance: RecipePerformance;
  station: string | null;
  skill: string | null;
}

// =============================================================================
// DATA
// =============================================================================

/**
 * Extract craftable items from recipes.
 * Filters to items with complete performance data (actions + swingTime).
 * Items with 0 stamina or 0 XP are valid, those are free crafts.
 */
function buildCraftableIndex(recipesFile: RecipesFile): CraftableItem[] {
  const items: CraftableItem[] = [];

  for (const recipe of Object.values(recipesFile.byId)) {
    // Need at minimum: actions and swingTime to calculate anything useful
    const r = recipe as RecipeEntry & {
      actions?: number | null;
      swingTime?: number | null;
      staminaPerSwing?: number | null;
      xpPerSwing?: number | null;
    };

    if (r.actions == null || r.swingTime == null) continue;
    if (r.actions <= 0) continue; // skip zero-effort recipes (instant crafts, if any)

    items.push({
      id: r.id,
      name: r.name,
      tier: r.tier,
      performance: {
        effort: r.actions,
        swingTime: r.swingTime,
        staminaPerSwing: r.staminaPerSwing ?? 0,
        xpPerSwing: r.xpPerSwing ?? 0,
      },
      station: r.station?.name ?? null,
      skill: r.skill?.name ?? null,
    });
  }

  // Tier first, that's how players think about recipes in-game
  items.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  log.info(`Indexed ${items.length} craftable items`);
  return items;
}

// =============================================================================
// RENDERING
// =============================================================================

/** Build the food tier <option> list once */
function renderFoodOptions(): string {
  return getFoodTiers()
    .map((f) => {
      const label =
        f.tier === 0 ? 'No Food (0.25/s base regen)' : `Tier ${f.tier} (${f.regenPerSec}/s)`;
      const selected = f.tier === 3 ? ' selected' : '';
      return `<option value="${f.tier}"${selected}>${label}</option>`;
    })
    .join('');
}

/** Render the static calculator shell. Event wiring happens in init(). */
function renderShell(container: HTMLElement): void {
  container.innerHTML = `
    <div class="calc-layout">
      <div class="calc-panel calc-inputs">
        <h3 class="calc-heading">Recipe</h3>
        <div class="calc-field">
          <label for="calc-search">Search Items</label>
          <input type="text" id="calc-search" placeholder="Start typing an item name..." autocomplete="off">
          <div id="calc-suggestions" class="calc-suggestions hidden"></div>
        </div>
        <div id="calc-recipe-info" class="calc-recipe-info hidden"></div>

        <div class="calc-field-row">
          <div class="calc-field">
            <label for="calc-progress">Progress per Swing</label>
            <input type="number" id="calc-progress" value="20" min="1" step="1">
          </div>
          <div class="calc-field">
            <label for="calc-count">Craft Count</label>
            <input type="number" id="calc-count" value="1" min="1" step="1">
          </div>
        </div>

        <h3 class="calc-heading">Character</h3>
        <div class="calc-field-row">
          <div class="calc-field">
            <label for="calc-stamina">Total Stamina</label>
            <input type="number" id="calc-stamina" value="409" min="1" step="1">
          </div>
          <div class="calc-field">
            <label for="calc-food">Food Tier</label>
            <select id="calc-food">${renderFoodOptions()}</select>
          </div>
          <div class="calc-field">
            <label for="calc-regen">Active Regen/s</label>
            <input type="number" id="calc-regen" value="0.1" min="0" step="0.1">
          </div>
        </div>
      </div>

      <div class="calc-panel calc-results-panel">
        <div id="calc-results" class="calc-empty-state">
          Select a recipe to calculate craft time.
        </div>
      </div>
    </div>
  `;
}

/** Show the selected recipe's canonical stats */
function renderRecipeInfo(item: CraftableItem): void {
  const el = document.getElementById('calc-recipe-info');
  if (!el) return;

  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="calc-selected">
      <span class="calc-selected-name">${item.name}</span>
      <span class="tier-badge">T${item.tier}</span>
      ${item.station ? `<span class="calc-selected-detail">${item.station}</span>` : ''}
      ${item.skill ? `<span class="calc-selected-detail">${item.skill}</span>` : ''}
    </div>
    <div class="calc-recipe-stats">
      <span>${item.performance.effort} effort</span>
      <span>${item.performance.swingTime}s/swing</span>
      <span>${item.performance.staminaPerSwing} stam/swing</span>
      <span>${item.performance.xpPerSwing} xp/swing</span>
    </div>
  `;
}

/** Render calculation results */
function renderResults(result: ReturnType<typeof calculateCraftTime>, craftCount: number): void {
  const el = document.getElementById('calc-results');
  if (!el) return;

  const restNote =
    result.staminaCycles <= 1
      ? 'Completes in one stamina bar, no rest needed.'
      : `${result.staminaCycles} cycles: craft until empty, rest until full, repeat.`;

  el.innerHTML = `
    <h3 class="calc-heading">Results</h3>
    <div class="calc-result-grid">
      <div class="calc-result-row calc-result-highlight">
        <span class="calc-result-label">Total Time</span>
        <span class="calc-result-value">${formatTime(result.totalTime)}</span>
      </div>
      <div class="calc-result-row">
        <span class="calc-result-label">Active Crafting</span>
        <span class="calc-result-value">${formatTime(result.activeTime)}</span>
      </div>
      <div class="calc-result-row">
        <span class="calc-result-label">Rest Time</span>
        <span class="calc-result-value">${formatTime(result.restTime)}</span>
      </div>
      <div class="calc-result-row">
        <span class="calc-result-label">Total Swings</span>
        <span class="calc-result-value">${formatNumber(result.totalSwings)}</span>
      </div>
      <div class="calc-result-row">
        <span class="calc-result-label">Swings per Craft</span>
        <span class="calc-result-value">${craftCount > 0 ? Math.ceil(result.totalSwings / craftCount) : '—'}</span>
      </div>
      <div class="calc-result-row">
        <span class="calc-result-label">Swings per Bar</span>
        <span class="calc-result-value">${formatNumber(result.swingsPerBar)}</span>
      </div>
      <div class="calc-result-row">
        <span class="calc-result-label">Stamina Cycles</span>
        <span class="calc-result-value">${result.staminaCycles}</span>
      </div>
      <div class="calc-result-row">
        <span class="calc-result-label">Total XP</span>
        <span class="calc-result-value">${formatNumber(Math.round(result.totalXP))}</span>
      </div>
      ${
        craftCount > 1
          ? `
      <div class="calc-result-row">
        <span class="calc-result-label">Time per Item</span>
        <span class="calc-result-value">${formatTime(result.totalTime / craftCount)}</span>
      </div>
      `
          : ''
      }
    </div>
    <div class="calc-rest-note">${restNote}</div>
  `;
}

// =============================================================================
// SEARCH / AUTOCOMPLETE
// =============================================================================

/** Render suggestion dropdown. Max 20 results, keeps it snappy. */
function renderSuggestions(items: CraftableItem[], query: string): void {
  const container = document.getElementById('calc-suggestions');
  if (!container) return;

  if (!query || query.length < 2) {
    container.classList.add('hidden');
    return;
  }

  const lower = query.toLowerCase();
  const matches = items.filter((i) => i.name.toLowerCase().includes(lower)).slice(0, 20);

  if (matches.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.innerHTML = matches
    .map(
      (item) => `
      <div class="calc-suggestion" data-id="${item.id}">
        <span class="calc-suggestion-name">${item.name}</span>
        <span class="tier-badge">T${item.tier}</span>
      </div>
    `
    )
    .join('');

  container.classList.remove('hidden');
}

// =============================================================================
// ORCHESTRATION
// =============================================================================

/** Read character inputs from the DOM */
function getCharacterStats(): CharacterStats {
  const progressPerSwing =
    parseFloat((document.getElementById('calc-progress') as HTMLInputElement)?.value) || 20;
  const stamina =
    parseFloat((document.getElementById('calc-stamina') as HTMLInputElement)?.value) || 409;
  const foodTier =
    parseInt((document.getElementById('calc-food') as HTMLSelectElement)?.value) || 0;
  const activeRegen =
    parseFloat((document.getElementById('calc-regen') as HTMLInputElement)?.value) || 0;

  return {
    progressPerSwing,
    totalStamina: stamina,
    foodRegenPerSec: getFoodRegen(foodTier),
    activeRegenPerSec: activeRegen,
  };
}

/** Run calculation with current inputs */
function recalculate(item: CraftableItem): void {
  const craftCount = Math.max(
    1,
    parseInt((document.getElementById('calc-count') as HTMLInputElement)?.value) || 1
  );
  const character = getCharacterStats();
  const result = calculateCraftTime(item.performance, character, craftCount);
  renderResults(result, craftCount);
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Initialize the calculator view.
 * Call once. Idempotent, safe to call multiple times.
 */
export async function init(container: HTMLElement): Promise<void> {
  if (initialized) return;

  renderShell(container);

  // Load recipe data (shared cache with planner, no duplicate fetches)
  try {
    const data = await loadCoreData();
    recipes = data.recipes;
  } catch (err) {
    log.error('Failed to load recipe data:', err);
    container.innerHTML = '<div class="empty-state">Failed to load recipe data.</div>';
    return;
  }

  const craftableItems = buildCraftableIndex(recipes);
  let selectedItem: CraftableItem | null = null;

  // --- Search wiring ---
  const searchInput = document.getElementById('calc-search') as HTMLInputElement;
  const suggestionsEl = document.getElementById('calc-suggestions');

  searchInput?.addEventListener('input', () => {
    renderSuggestions(craftableItems, searchInput.value);
  });

  // Close suggestions on outside click
  document.addEventListener('click', (e) => {
    if (suggestionsEl && !suggestionsEl.contains(e.target as Node) && e.target !== searchInput) {
      suggestionsEl.classList.add('hidden');
    }
  });

  // Suggestion selection (delegated)
  suggestionsEl?.addEventListener('click', (e) => {
    const suggestion = (e.target as HTMLElement).closest('.calc-suggestion') as HTMLElement | null;
    if (!suggestion) return;

    const id = suggestion.dataset.id;
    selectedItem = craftableItems.find((i) => i.id === id) ?? null;
    if (!selectedItem) return;

    searchInput.value = `${selectedItem.name} (T${selectedItem.tier})`;
    suggestionsEl.classList.add('hidden');
    renderRecipeInfo(selectedItem);
    recalculate(selectedItem);
  });

  // --- Recalc on any input change ---
  const recalcInputs = ['calc-progress', 'calc-count', 'calc-stamina', 'calc-food', 'calc-regen'];
  for (const inputId of recalcInputs) {
    document.getElementById(inputId)?.addEventListener('input', () => {
      if (selectedItem) recalculate(selectedItem);
    });
  }

  initialized = true;
  log.info('Calculator initialized');
}

/**
 * Render / activate the calculator view.
 * Currently just ensures init has run. Future: could accept planner context.
 */
export async function render(container: HTMLElement): Promise<void> {
  if (!initialized) {
    await init(container);
  }
}
