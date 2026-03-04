/**
 * Dashboard - Full-width stacked panels with column-wrapped items
 *
 * Consumes PlanItem[] — one flat list, one item type.
 * Groups by activity, splits Crafting into intermediates/finals,
 * sorts panels by total deficit, renders items in CSS columns
 * that fill horizontal space within each full-width panel.
 * Deficit magnitude bars scale relative to the panel's max.
 */

import { formatCompact } from './lib/progress-calc.js';
import { CONFIG } from '../configuration/index.js';
import type { PlanItem, Activity } from '../types/index.js';
import { createLogger } from '../logger.js';
const log = createLogger('planner-dashboard');
// =============================================================================
// TYPES
// =============================================================================

interface ActivityGroup {
  name: string;
  activity: Activity;
  items: PlanItem[];
}

interface Filters {
  tier: number | null;
  activity: string | null;
  hideComplete: boolean;
  actionableOnly: boolean;
  sortBy: 'deficit' | 'tier' | 'name';
  compactNames: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ACTIVITY_ORDER = CONFIG.PLANNER.ACTIVITY_ORDER;

const TIER_PREFIXES = [
  // Materials
  'Rough',
  'Sturdy',
  'Fine',
  'Peerless',
  'Ornate',
  'Pristine',
  'Magnificent',
  'Exquisite',
  // Farming
  'Simple',
  'Basic',
  'Infused',
  // Scholar
  "Beginner's",
  'Novice',
  'Comprehensive',
  'Essential',
  'Proficient',
  'Advanced',
  // Ore
  'Ferralith',
  'Pyrelite',
  'Emarium',
  'Elenvar',
  'Rathium',
  'Aurumite',
  'Umbracite',
  'Celestium',
  'Luminite',
];

const CRAFTING_INTERMEDIATES = 'Crafting (inter)';
const CRAFTING_FINALS = 'Crafting (finals)';

// =============================================================================
// PURE FUNCTIONS
// =============================================================================

/**
 * Group items by activity, splitting Crafting into intermediates and finals.
 */
function groupByActivity(items: PlanItem[]): ActivityGroup[] {
  const map = new Map<Activity, PlanItem[]>();

  for (const item of items) {
    let group = map.get(item.activity);
    if (!group) {
      group = [];
      map.set(item.activity, group);
    }
    group.push(item);
  }

  const groups: ActivityGroup[] = [];

  for (const activity of ACTIVITY_ORDER) {
    const activityItems = map.get(activity);
    if (!activityItems || activityItems.length === 0) continue;

    if (activity === 'Crafting') {
      const intermediates = activityItems.filter((i) => i.mappingType === 'intermediate');
      const finals = activityItems.filter((i) => i.mappingType !== 'intermediate');

      if (intermediates.length > 0) {
        groups.push({ name: CRAFTING_INTERMEDIATES, activity, items: intermediates });
      }
      if (finals.length > 0) {
        groups.push({ name: CRAFTING_FINALS, activity, items: finals });
      }
    } else {
      groups.push({ name: activity, activity, items: activityItems });
    }
  }

  return groups;
}

/**
 * Sort panels by total deficit descending — biggest bottleneck first.
 */
function sortGroupsByDeficit(groups: ActivityGroup[]): ActivityGroup[] {
  return [...groups].sort((a, b) => {
    const aDeficit = a.items.reduce((sum, i) => sum + i.deficit, 0);
    const bDeficit = b.items.reduce((sum, i) => sum + i.deficit, 0);
    return bDeficit - aDeficit;
  });
}

function filterItems(items: PlanItem[], filters: Filters): PlanItem[] {
  return items.filter((item) => {
    if (filters.hideComplete && item.deficit === 0) return false;
    if (filters.actionableOnly && !item.actionable) return false;
    if (filters.tier !== null && item.tier !== filters.tier) return false;
    return true;
  });
}

function sortItems(items: PlanItem[], by: Filters['sortBy']): PlanItem[] {
  const copy = [...items];
  switch (by) {
    case 'deficit':
      return copy.sort((a, b) => b.deficit - a.deficit);
    case 'tier':
      return copy.sort((a, b) => b.tier - a.tier || b.deficit - a.deficit);
    case 'name':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
}

function filterGroups(groups: ActivityGroup[], activity: string | null): ActivityGroup[] {
  if (!activity) return groups;
  return groups.filter((g) => g.activity === activity);
}

function stripTierPrefix(name: string): string {
  for (const prefix of TIER_PREFIXES) {
    const index = name.indexOf(prefix + ' ');
    if (index !== -1) {
      return name.slice(index + prefix.length + 1);
    }
  }
  return name;
}

// =============================================================================
// RENDER FUNCTIONS
// =============================================================================

function renderItem(item: PlanItem, compactNames: boolean, maxDeficit: number): string {
  const status = item.deficit === 0 ? 'complete' : item.pctComplete >= 50 ? 'partial' : 'missing';
  const displayName = compactNames ? stripTierPrefix(item.name) : item.name;
  const tooltip = compactNames && displayName !== item.name ? `title="${item.name}"` : '';
  const barPct = maxDeficit > 0 ? Math.round((item.deficit / maxDeficit) * 100) : 0;

  return `
    <div class="dash-row ${status}" ${tooltip}>
      <span class="dash-row-bar" style="width: ${barPct}%"></span>
      <span class="dash-row-name">${displayName}</span>
      <span class="dash-row-tier">T${item.tier}</span>
      <span class="dash-row-deficit">${item.deficit > 0 ? `-${formatCompact(item.deficit)}` : '✓'}</span>
    </div>`;
}

function renderPanel(group: ActivityGroup, collapsed: boolean, compactNames: boolean): string {
  const totalDeficit = group.items.reduce((sum, i) => sum + i.deficit, 0);
  const totalRequired = group.items.reduce((sum, i) => sum + i.required, 0);
  const totalHave = group.items.reduce((sum, i) => sum + Math.min(i.have, i.required), 0);
  const percent = totalRequired > 0 ? Math.round((totalHave / totalRequired) * 100) : 100;
  const maxDeficit = group.items.reduce((max, i) => Math.max(max, i.deficit), 0);

  return `
    <div class="dash-panel ${collapsed ? 'collapsed' : ''}" data-group="${group.name}">
      <div class="dash-panel-header">
        <span class="dash-panel-toggle">▼</span>
        <span class="dash-panel-name">${group.name}</span>
        <span class="dash-panel-stats">${group.items.length} · -${formatCompact(totalDeficit)}</span>
        <div class="dash-panel-bar">
          <div class="dash-panel-bar-fill" style="width: ${percent}%"></div>
        </div>
        <span class="dash-panel-pct">${percent}%</span>
        <button class="dash-copy-group" title="Copy ${group.name} tasks">📋</button>
      </div>
      <div class="dash-panel-items">
        ${group.items.map((item) => renderItem(item, compactNames, maxDeficit)).join('')}
      </div>
    </div>`;
}

function renderToolbar(tiers: number[], activities: string[], filters: Filters): string {
  return `
    <div class="dash-toolbar">
      <div class="dash-filters">
        <select id="dash-tier" class="dash-select">
          <option value="">All Tiers</option>
          ${tiers.map((t) => `<option value="${t}" ${filters.tier === t ? 'selected' : ''}>T${t}</option>`).join('')}
        </select>
        <select id="dash-activity" class="dash-select">
          <option value="">All Activities</option>
          ${activities.map((a) => `<option value="${a}" ${filters.activity === a ? 'selected' : ''}>${a}</option>`).join('')}
        </select>
      </div>
      <div class="dash-options">
        <label class="dash-toggle">
          <input type="checkbox" id="dash-hide-complete" ${filters.hideComplete ? 'checked' : ''}>
          <span>Hide ✓</span>
        </label>
        <label class="dash-toggle">
          <input type="checkbox" id="dash-actionable" ${filters.actionableOnly ? 'checked' : ''}>
          <span>Actionable</span>
        </label>
        <label class="dash-toggle">
          <input type="checkbox" id="dash-compact" ${filters.compactNames ? 'checked' : ''}>
          <span>Short names</span>
        </label>
      </div>
      <div class="dash-sort">
        <span>Sort:</span>
        <select id="dash-sort" class="dash-select">
          <option value="deficit" ${filters.sortBy === 'deficit' ? 'selected' : ''}>Deficit</option>
          <option value="tier" ${filters.sortBy === 'tier' ? 'selected' : ''}>Tier</option>
          <option value="name" ${filters.sortBy === 'name' ? 'selected' : ''}>Name</option>
        </select>
      </div>
    </div>`;
}

// =============================================================================
// TEXT EXPORT
// =============================================================================

function itemToText(item: PlanItem): string {
  return `- ${item.deficit.toLocaleString()}x ${item.name} (T${item.tier})`;
}

function groupToText(group: ActivityGroup): string {
  const lines = [`**${group.name.toUpperCase()}**`];
  for (const item of group.items) {
    if (item.deficit > 0) lines.push(itemToText(item));
  }
  return lines.join('\n');
}

function groupsToText(groups: ActivityGroup[], header: string): string {
  const sections = groups.map(groupToText).filter((text) => text.split('\n').length > 1);
  if (sections.length === 0) return '';
  return [header, '', ...sections].join('\n');
}

// =============================================================================
// MODULE STATE & CONTROLLER
// =============================================================================

let items: PlanItem[] = [];
let targetTier = 0;
const filters: Filters = {
  tier: null,
  activity: null,
  hideComplete: true,
  actionableOnly: false,
  sortBy: 'deficit',
  compactNames: true,
};
const collapsed = new Set<string>();
let container: HTMLElement | null = null;

function getVisibleGroups(): ActivityGroup[] {
  const filtered = filterItems(items, filters);
  const sorted = sortItems(filtered, filters.sortBy);
  const grouped = groupByActivity(sorted);
  const activityFiltered = filterGroups(grouped, filters.activity);
  return sortGroupsByDeficit(activityFiltered);
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

function wireGroupEvents(el: HTMLElement, groups: ActivityGroup[]): void {
  el.querySelectorAll<HTMLElement>('.dash-panel-header').forEach((header) => {
    header.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.dash-copy-group')) return;

      const panel = header.closest('.dash-panel') as HTMLElement;
      const groupName = panel?.dataset.group;
      if (!groupName) return;

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
      const panel = btn.closest('.dash-panel') as HTMLElement;
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

  on<HTMLSelectElement>('#dash-activity', 'change', (el) => {
    filters.activity = el.value || null;
    renderGroups();
  });

  on<HTMLInputElement>('#dash-hide-complete', 'change', (el) => {
    filters.hideComplete = el.checked;
    renderGroups();
  });

  on<HTMLInputElement>('#dash-actionable', 'change', (el) => {
    filters.actionableOnly = el.checked;
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

function copyText(text: string, btn: HTMLElement): void {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = '✓';
    setTimeout(() => (btn.innerHTML = original), 1500);
  });
}

// =============================================================================
// PUBLIC API
// =============================================================================

export function render(el: HTMLElement, planItems: PlanItem[], tier: number): void {
  container = el;
  items = planItems;
  targetTier = tier;
  log.info(items);
  if (items.length === 0) {
    el.innerHTML = '<div class="dash-empty">No materials needed</div>';
    return;
  }

  const tiers = [...new Set(items.map((i) => i.tier))].sort((a, b) => a - b);
  const activities = ACTIVITY_ORDER.filter((a) => items.some((i) => i.activity === a));

  el.innerHTML = `
    <div class="dash">
      ${renderToolbar(tiers, activities, filters)}
      <div class="dash-panels" id="dash-groups"></div>
    </div>`;

  wireToolbarEvents();
  renderGroups();
}

export function generateDashboardText(): string {
  const groups = getVisibleGroups();
  const filterDesc = [
    filters.tier !== null ? `T${filters.tier}` : null,
    filters.activity,
    filters.actionableOnly ? 'actionable' : null,
  ]
    .filter(Boolean)
    .join(', ');
  const header = `**T${targetTier} Upgrade**${filterDesc ? ` (${filterDesc})` : ''}`;
  return groupsToText(groups, header);
}

export function generateFullText(): string {
  const allWithDeficit = items.filter((i) => i.deficit > 0);
  const sorted = sortItems(allWithDeficit, 'deficit');
  const groups = groupByActivity(sorted);
  const header = `**T${targetTier} Upgrade**`;
  return groupsToText(groups, header);
}
