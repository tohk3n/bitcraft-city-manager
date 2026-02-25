/**
 * Material Breakdown View
 *
 * "What do I need to make 50 of these?"
 * Pick a recipe, set a multiplier, see every material down to raw resources.
 *
 * Architecture: same pattern as calculator-view.
 * - init() loads data, wires events once
 * - render() called when tab activates
 * - Pure calc lives in material-calc.ts
 *
 * This is a separate tool from the craft time calculator. That one answers
 * "how long?" — this one answers "how much?" Different questions, different UI.
 * They share the recipe picker pattern because it works.
 */

import { loadCoreData } from './data/loader.js';
import { createLogger } from './logger.js';
import { breakdownMaterials } from './material-calc.js';
import type { MaterialBreakdown, MaterialLine } from './material-calc.js';
import type { RecipesFile } from './data/types.js';

const log = createLogger('Materials');

// =============================================================================
// STATE
// =============================================================================

let recipes: RecipesFile | null = null;
let initialized = false;

/** Searchable item index — every recipe in the game */
interface SearchableItem {
  id: string;
  name: string;
  tier: number;
  hasInputs: boolean;
}

// =============================================================================
// DATA
// =============================================================================

/** Build search index from recipes. Include anything with inputs (craftable). */
function buildSearchIndex(recipesFile: RecipesFile): SearchableItem[] {
  const items: SearchableItem[] = [];

  for (const recipe of Object.values(recipesFile.byId)) {
    items.push({
      id: recipe.id,
      name: recipe.name,
      tier: recipe.tier,
      hasInputs: recipe.inputs.length > 0,
    });
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

// =============================================================================
// INIT + RENDER
// =============================================================================

export async function init(container: HTMLElement): Promise<void> {
  if (initialized) return;

  renderShell(container);

  try {
    const data = await loadCoreData();
    recipes = data.recipes;
  } catch (err) {
    log.error('Failed to load recipe data:', err);
    container.innerHTML = '<div class="empty-state">Failed to load recipe data.</div>';
    return;
  }

  const searchIndex = buildSearchIndex(recipes);
  let selectedId: string | null = null;

  // --- Wire search ---
  const searchInput = document.getElementById('mb-search') as HTMLInputElement;
  const suggestionsEl = document.getElementById('mb-suggestions');
  const countInput = document.getElementById('mb-count') as HTMLInputElement;

  searchInput?.addEventListener('input', () => {
    renderSuggestions(searchIndex, searchInput.value);
  });

  document.addEventListener('click', (e) => {
    if (suggestionsEl && !suggestionsEl.contains(e.target as Node) && e.target !== searchInput) {
      suggestionsEl.classList.add('hidden');
    }
  });

  suggestionsEl?.addEventListener('click', (e) => {
    const suggestion = (e.target as HTMLElement).closest('.mb-suggestion') as HTMLElement | null;
    if (!suggestion) return;

    const id = suggestion.dataset.id;
    if (!id) return;

    const item = searchIndex.find((i) => i.id === id);
    if (!item) return;

    selectedId = id;
    searchInput.value = `${item.name} (T${item.tier})`;
    suggestionsEl.classList.add('hidden');
    recalculate(id, countInput);
  });

  countInput?.addEventListener('input', () => {
    if (selectedId) recalculate(selectedId, countInput);
  });

  initialized = true;
  log.info('Materials breakdown initialized');
}

export async function render(container: HTMLElement): Promise<void> {
  if (!initialized) {
    await init(container);
  }
}

// =============================================================================
// SHELL — the static HTML skeleton
// =============================================================================

function renderShell(container: HTMLElement): void {
  container.innerHTML = `
    <div class="mb-layout">
      <div class="mb-panel mb-inputs">
        <h3 class="mb-heading">Recipe</h3>
        <div class="mb-field" id="mb-search-field">
          <label for="mb-search">Item</label>
          <input id="mb-search" type="text" class="term-input"
                 placeholder="Search recipes..." autocomplete="off"
                 aria-label="Search for a recipe">
          <div id="mb-suggestions" class="mb-suggestions hidden"
               role="listbox" aria-label="Recipe suggestions"></div>
        </div>
        <div class="mb-field">
          <label for="mb-count">Quantity</label>
          <input id="mb-count" type="number" class="term-input"
                 value="1" min="1" max="9999" step="1"
                 aria-label="How many to craft">
        </div>
        <div id="mb-recipe-info" class="mb-recipe-info hidden"></div>
      </div>

      <div class="mb-panel mb-results">
        <div id="mb-output">
          <p class="mb-empty-state">Pick a recipe to see the material breakdown.</p>
        </div>
      </div>
    </div>
  `;
}

// =============================================================================
// SUGGESTIONS — same pattern as calculator-view, works well
// =============================================================================

function renderSuggestions(index: SearchableItem[], query: string): void {
  const el = document.getElementById('mb-suggestions');
  if (!el) return;

  const q = query.trim().toLowerCase();
  if (q.length < 2) {
    el.classList.add('hidden');
    return;
  }

  // Craftable items first, then raw. Limit to 20 to keep dropdown manageable.
  const matches = index
    .filter((item) => item.name.toLowerCase().includes(q))
    .sort((a, b) => {
      // Prefer craftable (has inputs) over raw
      if (a.hasInputs !== b.hasInputs) return a.hasInputs ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 20);

  if (matches.length === 0) {
    el.classList.add('hidden');
    return;
  }

  el.innerHTML = matches
    .map(
      (item) => `
      <div class="mb-suggestion" data-id="${item.id}" role="option">
        <span class="tier-badge tier-${item.tier}">T${item.tier}</span>
        <span class="mb-suggestion-name">${item.name}</span>
        ${!item.hasInputs ? '<span class="mb-raw-badge">raw</span>' : ''}
      </div>
    `
    )
    .join('');

  el.classList.remove('hidden');
}

// =============================================================================
// RECALCULATE — pure data in, DOM out
// =============================================================================

function recalculate(recipeId: string, countInput: HTMLInputElement): void {
  if (!recipes) return;

  const count = Math.max(1, Math.min(9999, parseInt(countInput.value, 10) || 1));
  const breakdown = breakdownMaterials(recipes, recipeId, count);

  if (!breakdown) {
    renderError('Recipe not found in data.');
    return;
  }

  renderRecipeInfo(breakdown);
  renderBreakdown(breakdown);
}

// =============================================================================
// RENDER HELPERS
// =============================================================================

function renderRecipeInfo(bd: MaterialBreakdown): void {
  const el = document.getElementById('mb-recipe-info');
  if (!el) return;

  el.classList.remove('hidden');
  const yieldsNote = bd.recipe.yields > 1 ? ` (yields ${bd.recipe.yields}/craft)` : '';
  el.innerHTML = `
    <div class="mb-selected">
      <span class="mb-selected-name">${bd.recipe.name}</span>
      <span class="tier-badge tier-${bd.recipe.tier}">T${bd.recipe.tier}</span>
      <span class="mb-selected-detail">${bd.craftCount}×${yieldsNote}</span>
    </div>
  `;
}

function renderBreakdown(bd: MaterialBreakdown): void {
  const el = document.getElementById('mb-output');
  if (!el) return;

  // No inputs = raw resource, nothing to break down
  if (bd.tree.length === 0) {
    el.innerHTML = `<p class="mb-empty-state">This is a raw resource — nothing to break down.</p>`;
    return;
  }

  el.innerHTML = `
    ${renderTotals(bd.totals)}
    ${renderTree(bd.tree)}
  `;
}

/** The shopping list: just the leaf nodes, aggregated */
function renderTotals(totals: MaterialLine[]): string {
  if (totals.length === 0) return '';

  const rows = totals
    .map(
      (m) => `
    <tr>
      <td><span class="tier-badge tier-${m.tier}">T${m.tier}</span></td>
      <td>${m.name}</td>
      <td class="mb-qty">${m.qty.toLocaleString()}</td>
    </tr>
  `
    )
    .join('');

  return `
    <div class="mb-section">
      <h3 class="mb-heading">Raw Materials Needed</h3>
      <table class="mb-table">
        <thead><tr><th></th><th>Material</th><th>Qty</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/** Full tree view: indented to show crafting chain */
function renderTree(tree: MaterialLine[]): string {
  const rows = tree
    .map(
      (m) => `
    <tr class="${m.isRaw ? 'mb-row-raw' : 'mb-row-crafted'}">
      <td>
        <span class="mb-indent" style="padding-left: ${m.depth * 16}px">
          ${m.depth > 0 ? '└ ' : ''}
        </span>
        <span class="tier-badge tier-${m.tier}">T${m.tier}</span>
      </td>
      <td>${m.name}${m.isRaw ? '' : ' ⚒'}</td>
      <td class="mb-qty">${m.qty.toLocaleString()}</td>
    </tr>
  `
    )
    .join('');

  return `
    <details class="mb-section mb-tree-section">
      <summary class="mb-heading mb-heading-toggle">Crafting Tree</summary>
      <table class="mb-table">
        <thead><tr><th></th><th>Material</th><th>Qty</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </details>
  `;
}

function renderError(msg: string): void {
  const el = document.getElementById('mb-output');
  if (!el) return;
  el.innerHTML = `<div class="mb-error">${msg}</div>`;
}
