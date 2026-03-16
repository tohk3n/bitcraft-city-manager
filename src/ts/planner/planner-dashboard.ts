// Dashboard -- tier-grouped panels with concern columns.
//
// Walks the ProcessedNode research trees directly (via the shared
// concern-items module) to get the full pipeline including non-trackable
// intermediates. Groups items by tier top-to-bottom, then by concern
// left-to-right within each tier panel.

import { formatCompact } from './lib/progress-calc.js';
import { collectItemsFromTree, CONCERN_ORDER } from './lib/concern-items.js';
import type { ConcernItem, Concern } from './lib/concern-items.js';
import type { ProcessedNode } from '../types/index.js';

// ── Types ─────────────────────────────────────────────────────────

interface TierGroup {
  name: string;
  tier: number;
  items: ConcernItem[];
}

interface Filters {
  tier: number | null;
  hideComplete: boolean;
  compactNames: boolean;
  sortBy: 'deficit' | 'tier' | 'name';
}

// ── State ─────────────────────────────────────────────────────────

let allItems: ConcernItem[] = [];
let targetTier = 0;
let container: HTMLElement | null = null;
const collapsed = new Set<string>();

const filters: Filters = {
  tier: null,
  hideComplete: true,
  compactNames: true,
  sortBy: 'deficit',
};

// ── Data Pipeline ─────────────────────────────────────────────────

function collectAllItems(
  researches: ProcessedNode[],
  studyJournals: ProcessedNode | null
): ConcernItem[] {
  const items: ConcernItem[] = [];
  for (const research of researches) items.push(...collectItemsFromTree(research));
  if (studyJournals) items.push(...collectItemsFromTree(studyJournals));

  // Deduplicate by name:tier - items shared across branches get summed
  // required in the cascade, but collectItemsFromTree walks each branch
  // independently. Keep the entry with highest deficit.
  const deduped = new Map<string, ConcernItem>();
  for (const item of items) {
    const key = `${item.name}:${item.tier}`;
    const existing = deduped.get(key);
    if (!existing || item.deficit > existing.deficit) {
      deduped.set(key, item);
    }
  }

  return Array.from(deduped.values());
}

function filterItems(items: ConcernItem[]): ConcernItem[] {
  return items.filter((item) => {
    if (filters.hideComplete && item.deficit === 0) return false;
    if (filters.tier !== null && item.tier !== filters.tier) return false;
    return true;
  });
}

function sortItems(items: ConcernItem[]): ConcernItem[] {
  const copy = [...items];
  switch (filters.sortBy) {
    case 'deficit':
      return copy.sort((a, b) => b.deficit - a.deficit);
    case 'tier':
      return copy.sort((a, b) => b.tier - a.tier || b.deficit - a.deficit);
    case 'name':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
}

function groupByTier(items: ConcernItem[]): TierGroup[] {
  const tierMap = new Map<number, ConcernItem[]>();

  for (const item of items) {
    let group = tierMap.get(item.tier);
    if (!group) {
      group = [];
      tierMap.set(item.tier, group);
    }
    group.push(item);
  }

  return Array.from(tierMap.keys())
    .sort((a, b) => a - b)
    .map((tier) => {
      const tierItems = tierMap.get(tier) || [];

      // Within each tier, sort by concern order then deficit descending
      tierItems.sort((a, b) => {
        const ca = CONCERN_ORDER.indexOf(a.concern);
        const cb = CONCERN_ORDER.indexOf(b.concern);
        if (ca !== cb) return ca - cb;
        return b.deficit - a.deficit;
      });

      return { name: `T${tier}`, tier, items: tierItems };
    });
}

function getVisibleGroups(): TierGroup[] {
  const filtered = filterItems(allItems);
  const sorted = sortItems(filtered);
  return groupByTier(sorted);
}

// ── Rendering ─────────────────────────────────────────────────────

function renderItem(item: ConcernItem, compactNames: boolean): string {
  const status = item.deficit === 0 ? 'complete' : item.pctComplete >= 50 ? 'partial' : 'missing';
  const displayName = compactNames ? item.shortName : item.name;
  const tooltip = compactNames && item.shortName !== item.name ? `title="${item.name}"` : '';

  return `
    <div class="dash-row ${status}" ${tooltip}>
      <span class="dash-row-bar" style="width: ${item.pctComplete}%"></span>
      <span class="dash-row-name">${displayName}</span>
      <span class="dash-row-deficit">${item.deficit > 0 ? `-${formatCompact(item.deficit)}` : '\u2713'}</span>
    </div>`;
}

function renderPanel(group: TierGroup, isCollapsed: boolean, compactNames: boolean): string {
  const totalDeficit = group.items.reduce((sum, i) => sum + i.deficit, 0);
  const totalRequired = group.items.reduce((sum, i) => sum + i.required, 0);
  const totalHave = group.items.reduce((sum, i) => sum + Math.min(i.have, i.required), 0);
  const percent = totalRequired > 0 ? Math.round((totalHave / totalRequired) * 100) : 100;

  // Group items by concern for columns
  const byConcern = new Map<Concern, ConcernItem[]>();
  for (const item of group.items) {
    let list = byConcern.get(item.concern);
    if (!list) {
      list = [];
      byConcern.set(item.concern, list);
    }
    list.push(item);
  }

  const columns = CONCERN_ORDER.filter((c) => byConcern.has(c))
    .map((concern) => {
      const concernItems = byConcern.get(concern);
      if (!concernItems || concernItems.length === 0) return '';

      const complete = concernItems.filter((i) => i.deficit === 0).length;
      const pct = Math.round((complete / concernItems.length) * 100);

      return `<div class="dash-col dash-col-${concern}">
        <div class="dash-col-hdr">
          <span>${concern}</span>
          <span>${pct}%</span>
        </div>
        ${concernItems.map((item) => renderItem(item, compactNames)).join('')}
      </div>`;
    })
    .join('');

  return `
    <div class="dash-panel ${isCollapsed ? 'collapsed' : ''}" data-group="${group.name}">
      <div class="dash-panel-header">
        <span class="dash-panel-toggle">\u25BC</span>
        <span class="dash-panel-name tier-badge tier-${group.tier}">${group.name}</span>
        <span class="dash-panel-stats">${group.items.length} \u00b7 -${formatCompact(totalDeficit)}</span>
        <div class="dash-panel-bar">
          <div class="dash-panel-bar-fill" style="width: ${percent}%"></div>
        </div>
        <span class="dash-panel-pct">${percent}%</span>
        <button class="dash-copy-group" title="Copy ${group.name} tasks">\uD83D\uDCCB</button>
      </div>
      <div class="dash-panel-items">
        ${columns}
      </div>
    </div>`;
}

function renderToolbar(tiers: number[]): string {
  return `
    <div class="dash-toolbar">
      <div class="dash-filters">
        <select id="dash-tier" class="dash-select">
          <option value="">All Tiers</option>
          ${tiers.map((t) => `<option value="${t}" ${filters.tier === t ? 'selected' : ''}>T${t}</option>`).join('')}
        </select>
      </div>
      <div class="dash-options">
        <label class="dash-toggle">
          <input type="checkbox" id="dash-hide-complete" ${filters.hideComplete ? 'checked' : ''}>
          <span>Hide \u2713</span>
        </label>
        <label class="dash-toggle">
          <input type="checkbox" id="dash-compact" ${filters.compactNames ? 'checked' : ''}>
          <span>Short names</span>
        </label>
        <div class="dash-sort">
          <span>Sort:</span>
          <select id="dash-sort" class="dash-select">
            <option value="deficit" ${filters.sortBy === 'deficit' ? 'selected' : ''}>Deficit</option>
            <option value="tier" ${filters.sortBy === 'tier' ? 'selected' : ''}>Tier</option>
            <option value="name" ${filters.sortBy === 'name' ? 'selected' : ''}>Name</option>
          </select>
        </div>
      </div>
    </div>`;
}

function renderGroups(): void {
  const groupsEl = container?.querySelector('#dash-groups');
  if (!groupsEl) return;

  const groups = getVisibleGroups();

  if (groups.length === 0) {
    groupsEl.innerHTML = '<div class="dash-empty">No items match filters</div>';
    return;
  }

  groupsEl.innerHTML = groups
    .map((g) => renderPanel(g, collapsed.has(g.name), filters.compactNames))
    .join('');

  wireGroupEvents(groupsEl as HTMLElement, groups);
}

// ── Event Wiring ──────────────────────────────────────────────────

function wireGroupEvents(el: HTMLElement, groups: TierGroup[]): void {
  el.querySelectorAll<HTMLElement>('.dash-panel-header').forEach((header) => {
    header.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.dash-copy-group')) return;

      const panel = header.closest('.dash-panel') as HTMLElement | null;
      const groupName = panel?.dataset.group;
      if (!panel || !groupName) return;

      if (collapsed.has(groupName)) {
        collapsed.delete(groupName);
      } else {
        collapsed.add(groupName);
      }
      panel.classList.toggle('collapsed', collapsed.has(groupName));
    });
  });

  el.querySelectorAll<HTMLElement>('.dash-copy-group').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const panel = btn.closest('.dash-panel') as HTMLElement | null;
      const groupName = panel?.dataset.group;
      const data = groups.find((g) => g.name === groupName);
      if (data) copyText(groupToText(data), btn);
    });
  });
}

function wireToolbarEvents(): void {
  if (!container) return;

  const on = <T extends HTMLElement>(id: string, event: string, handler: (el: T) => void) => {
    container?.querySelector(id)?.addEventListener(event, (e) => handler(e.target as T));
  };

  on<HTMLSelectElement>('#dash-tier', 'change', (el) => {
    filters.tier = el.value ? parseInt(el.value, 10) : null;
    renderGroups();
  });

  on<HTMLInputElement>('#dash-hide-complete', 'change', (el) => {
    filters.hideComplete = el.checked;
    renderGroups();
  });

  on<HTMLInputElement>('#dash-compact', 'change', (el) => {
    filters.compactNames = el.checked;
    renderGroups();
  });

  on<HTMLSelectElement>('#dash-sort', 'change', (el) => {
    filters.sortBy = el.value as Filters['sortBy'];
    renderGroups();
  });
}

// ── Copy / Export ─────────────────────────────────────────────────

function copyText(text: string, btn: HTMLElement): void {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = '\u2713';
    setTimeout(() => (btn.innerHTML = original), 1500);
  });
}

function groupToText(group: TierGroup): string {
  const lines: string[] = [`**${group.name}**`];
  for (const concern of CONCERN_ORDER) {
    const items = group.items.filter((i) => i.concern === concern && i.deficit > 0);
    if (items.length === 0) continue;
    lines.push(`  ${concern.toUpperCase()}`);
    for (const item of items) {
      lines.push(`  - ${formatCompact(item.deficit)}x ${item.name}`);
    }
  }
  return lines.join('\n');
}

function groupsToText(groups: TierGroup[], header: string): string {
  const lines = [header, ''];
  for (const group of groups) {
    lines.push(groupToText(group));
    lines.push('');
  }
  return lines.join('\n');
}

// ── Public API ────────────────────────────────────────────────────

export function render(
  el: HTMLElement,
  researches: ProcessedNode[],
  studyJournals: ProcessedNode | null,
  tier: number
): void {
  container = el;
  targetTier = tier;
  allItems = collectAllItems(researches, studyJournals);

  if (allItems.length === 0) {
    el.innerHTML = '<div class="dash-empty">No materials needed</div>';
    return;
  }

  const tiers = [...new Set(allItems.map((i) => i.tier))].sort((a, b) => a - b);

  el.innerHTML = `
    <div class="dash">
      ${renderToolbar(tiers)}
      <div class="dash-panels" id="dash-groups"></div>
    </div>`;

  wireToolbarEvents();
  renderGroups();
}

export function generateDashboardText(): string {
  const groups = getVisibleGroups();
  const filterDesc = filters.tier !== null ? `T${filters.tier}` : null;
  const header = `**T${targetTier} Upgrade**${filterDesc ? ` (${filterDesc})` : ''}`;
  return groupsToText(groups, header);
}

export function generateFullText(): string {
  const withDeficit = allItems.filter((i) => i.deficit > 0);
  const groups = groupByTier(withDeficit);
  const header = `**T${targetTier} Upgrade**`;
  return groupsToText(groups, header);
}
