/**
 * Task List - Filterable, sortable task cards
 */

import { formatCompact, categorizeByActivity } from './lib/progress-calc.js';
import type { FirstTrackableItem } from '../types/index.js';

// Sort options
type SortOption = 'deficit' | 'deficit-asc' | 'tier' | 'tier-asc' | 'activity' | 'name';

// Module state
let currentItems: FirstTrackableItem[] = [];
let filterTier = '';
let filterActivity = '';
let sortBy: SortOption = 'deficit';
let hideComplete = true;

/**
 * Render the task list with controls.
 */
export function render(container: HTMLElement, items: FirstTrackableItem[]): void {
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="task-empty">All requirements met</div>';
    return;
  }

  currentItems = items;

  const itemsWithDeficit = items.filter((i) => i.deficit > 0);

  if (itemsWithDeficit.length === 0 && hideComplete) {
    container.innerHTML = '<div class="task-complete">All materials in stock!</div>';
    return;
  }

  const tiers = [...new Set(items.map((i) => i.tier))].sort((a, b) => a - b);
  const activities = [...new Set(items.map((i) => categorizeByActivity(i.name)))].sort();

  container.innerHTML = `
    <div class="task-controls">
    <div class="task-filters">
    <select id="task-filter-tier" class="task-select">
    <option value="">All Tiers</option>
    ${tiers.map((t) => `<option value="${t}">T${t}</option>`).join('')}
    </select>
    <select id="task-filter-activity" class="task-select">
    <option value="">All Activities</option>
    ${activities.map((a) => `<option value="${a}">${a}</option>`).join('')}
    </select>
    </div>
    <label class="task-toggle">
    <input type="checkbox" id="task-hide-complete" ${hideComplete ? 'checked' : ''}>
    <span>Hide complete</span>
    </label>
    <div class="task-sort">
    <label>Sort:</label>
    <select id="task-sort" class="task-select">
    <option value="deficit">Deficit (high)</option>
    <option value="deficit-asc">Deficit (low)</option>
    <option value="tier">Tier (high)</option>
    <option value="tier-asc">Tier (low)</option>
    <option value="activity">Activity</option>
    <option value="name">Name</option>
    </select>
    </div>
    </div>
    <div class="task-cards" id="task-cards"></div>
    `;

  const cardsEl = container.querySelector('#task-cards') as HTMLElement;

  container.querySelector('#task-filter-tier')?.addEventListener('change', (e) => {
    filterTier = (e.target as HTMLSelectElement).value;
    renderCards(cardsEl);
  });

  container.querySelector('#task-filter-activity')?.addEventListener('change', (e) => {
    filterActivity = (e.target as HTMLSelectElement).value;
    renderCards(cardsEl);
  });

  container.querySelector('#task-sort')?.addEventListener('change', (e) => {
    sortBy = (e.target as HTMLSelectElement).value as SortOption;
    renderCards(cardsEl);
  });

  container.querySelector('#task-hide-complete')?.addEventListener('change', (e) => {
    hideComplete = (e.target as HTMLInputElement).checked;
    renderCards(cardsEl);
  });

  renderCards(cardsEl);
}

/**
 * Render task cards based on current filter/sort state.
 */
function renderCards(container: HTMLElement): void {
  let items = currentItems.filter((item) => {
    if (hideComplete && item.deficit === 0) return false;
    if (filterTier && item.tier !== parseInt(filterTier, 10)) return false;
    if (filterActivity && categorizeByActivity(item.name) !== filterActivity) return false;
    return true;
  });

  items = sort(items, sortBy);

  if (items.length === 0) {
    container.innerHTML = '<div class="task-empty">No items match filters</div>';
    return;
  }

  container.innerHTML = items.map((item) => renderCard(item)).join('');

  container.querySelectorAll<HTMLButtonElement>('.task-copy').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyTask(btn);
    });
  });
}

/**
 * Render a single task card.
 */
function renderCard(item: FirstTrackableItem): string {
  const pct =
    item.required > 0
      ? Math.round((Math.min(item.have, item.required) / item.required) * 100)
      : 100;
  const activity = categorizeByActivity(item.name);
  const isComplete = item.deficit === 0;
  const deficitText = isComplete ? 'Done' : `-${formatCompact(item.deficit)}`;
  const taskText = isComplete
    ? `${item.name} (T${item.tier}) - Complete`
    : `${item.deficit.toLocaleString()}x ${item.name} (T${item.tier})`;

  return `
    <div class="task-card ${isComplete ? 'complete' : ''}">
    <div class="task-header">
    <span class="task-name">${item.name}</span>
    <button class="task-copy" data-text="${taskText}" title="Copy">📋</button>
    </div>
    <div class="task-meta">
    <span class="task-tier">T${item.tier}</span>
    <span class="task-activity">${activity}</span>
    </div>
    <div class="task-progress">
    <div class="task-progress-bar">
    <div class="task-progress-fill ${isComplete ? 'complete' : ''}" style="width: ${pct}%"></div>
    </div>
    </div>
    <div class="task-counts">
    <span class="task-have">${formatCompact(item.have)}</span>
    <span class="task-sep">/</span>
    <span class="task-need">${formatCompact(item.required)}</span>
    </div>
    <div class="task-deficit ${isComplete ? 'complete' : ''}">${deficitText}</div>
    </div>
    `;
}

/**
 * Sort items by criteria.
 */
function sort(items: FirstTrackableItem[], by: SortOption): FirstTrackableItem[] {
  const sorted = [...items];
  switch (by) {
    case 'deficit':
      return sorted.sort((a, b) => b.deficit - a.deficit);
    case 'deficit-asc':
      return sorted.sort((a, b) => a.deficit - b.deficit);
    case 'tier':
      return sorted.sort((a, b) => b.tier - a.tier || b.deficit - a.deficit);
    case 'tier-asc':
      return sorted.sort((a, b) => a.tier - b.tier || b.deficit - a.deficit);
    case 'activity':
      return sorted.sort(
        (a, b) =>
          categorizeByActivity(a.name).localeCompare(categorizeByActivity(b.name)) ||
          b.deficit - a.deficit
      );
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return sorted;
  }
}

/**
 * Copy task text to clipboard.
 */
function copyTask(btn: HTMLButtonElement): void {
  const text = btn.dataset.text || '';
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = '✔';
    setTimeout(() => (btn.textContent = original), 1500);
  });
}
