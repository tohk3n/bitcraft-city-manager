/**
 * Task List - Filterable, sortable task cards
 *
 * Renders deficit items with filter/sort controls and copy functionality.
 */

import { formatCompact, categorizeByActivity } from './lib/progress-calc.js';

// Module state for current filter/sort settings
let currentItems = [];
let filterTier = '';
let filterActivity = '';
let sortBy = 'deficit';

/**
 * Render the task list with controls.
 *
 * @param {HTMLElement} container - Container element
 * @param {Array} items - Items from report.firstTrackable
 */
export function render(container, items) {
    if (!items || items.length === 0) {
        container.innerHTML = '<div class="task-empty">All requirements met</div>';
        return;
    }

    const itemsWithDeficit = items.filter(item => item.deficit > 0);

    if (itemsWithDeficit.length === 0) {
        container.innerHTML = '<div class="task-complete">All materials in stock!</div>';
        return;
    }

    // Store items and reset filters
    currentItems = itemsWithDeficit;

    // Get unique tiers and activities for filter options
    const tiers = [...new Set(itemsWithDeficit.map(i => i.tier))].sort((a, b) => a - b);
    const activities = [...new Set(itemsWithDeficit.map(i => categorizeByActivity(i.name)))].sort();

    container.innerHTML = `
    <div class="task-controls">
    <div class="task-filters">
    <select id="task-filter-tier" class="task-select">
    <option value="">All Tiers</option>
    ${tiers.map(t => `<option value="${t}">T${t}</option>`).join('')}
    </select>
    <select id="task-filter-activity" class="task-select">
    <option value="">All Activities</option>
    ${activities.map(a => `<option value="${a}">${a}</option>`).join('')}
    </select>
    </div>
    <div class="task-sort">
    <label>Sort:</label>
    <select id="task-sort" class="task-select">
    <option value="deficit">Deficit ↓</option>
    <option value="deficit-asc">Deficit ↑</option>
    <option value="tier">Tier ↓</option>
    <option value="tier-asc">Tier ↑</option>
    <option value="activity">Activity</option>
    <option value="name">Name</option>
    </select>
    </div>
    </div>
    <div class="task-cards" id="task-cards"></div>
    `;

    // Wire up controls
    container.querySelector('#task-filter-tier').addEventListener('change', e => {
        filterTier = e.target.value;
        renderCards(container.querySelector('#task-cards'));
    });

    container.querySelector('#task-filter-activity').addEventListener('change', e => {
        filterActivity = e.target.value;
        renderCards(container.querySelector('#task-cards'));
    });

    container.querySelector('#task-sort').addEventListener('change', e => {
        sortBy = e.target.value;
        renderCards(container.querySelector('#task-cards'));
    });

    renderCards(container.querySelector('#task-cards'));
}

/**
 * Render the task cards based on current filter/sort state.
 */
function renderCards(container) {
    // Filter
    let items = currentItems.filter(item => {
        if (filterTier && item.tier !== parseInt(filterTier, 10)) return false;
        if (filterActivity && categorizeByActivity(item.name) !== filterActivity) return false;
        return true;
    });

    // Sort
    items = sort(items, sortBy);

    if (items.length === 0) {
        container.innerHTML = '<div class="task-empty">No items match filters</div>';
        return;
    }

    container.innerHTML = items.map(item => renderCard(item)).join('');

    // Wire up copy buttons
    container.querySelectorAll('.task-copy').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            copyTask(btn);
        });
    });
}

/**
 * Render a single task card.
 */
function renderCard(item) {
    const pct = item.required > 0
    ? Math.round((Math.min(item.have, item.required) / item.required) * 100)
    : 100;
    const activity = categorizeByActivity(item.name);
    const taskText = `${item.deficit.toLocaleString()}x ${item.name} (T${item.tier})`;

    return `
    <div class="task-card">
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
    <div class="task-progress-fill" style="width: ${pct}%"></div>
    </div>
    </div>
    <div class="task-counts">
    <span class="task-have">${formatCompact(item.have)}</span>
    <span class="task-sep">/</span>
    <span class="task-need">${formatCompact(item.required)}</span>
    </div>
    <div class="task-deficit">-${formatCompact(item.deficit)}</div>
    </div>
    `;
}

/**
 * Sort items by criteria.
 */
function sort(items, by) {
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
            return sorted.sort((a, b) =>
            categorizeByActivity(a.name).localeCompare(categorizeByActivity(b.name)) || b.deficit - a.deficit
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
function copyTask(btn) {
    const text = btn.dataset.text;
    navigator.clipboard.writeText(text).then(() => {
        const original = btn.textContent;
        btn.textContent = '✓';
        setTimeout(() => btn.textContent = original, 1500);
    });
}
