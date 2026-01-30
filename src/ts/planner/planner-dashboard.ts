/**
 * Dashboard - Material requirements grouped by activity
 */

import { formatCompact, categorizeByActivity } from './lib/progress-calc.js';
import type { TrackableItem, ProgressReport } from '../types/index.js';

// =============================================================================
// TYPES
// =============================================================================

interface ActivityGroup {
    name: string;
    items: TrackableItem[];
}

interface Filters {
    tier: number | null;
    activity: string | null;
    hideComplete: boolean;
    sortBy: 'deficit' | 'tier' | 'name';
    compactNames: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ACTIVITY_ORDER = [
    'Mining', 'Logging', 'Foraging', 'Farming', 'Fishing', 'Hunting', 'Crafting'
];

const TIER_PREFIXES = [
    'Basic', 'Simple', 'Sturdy', 'Fine', 'Exquisite',
    'Rough', 'Novice', 'Essential', 'Proficient', 'Advanced',
    'Infused', 'Refined'
];

// =============================================================================
// PURE FUNCTIONS
// =============================================================================

function groupByActivity(items: TrackableItem[]): ActivityGroup[] {
    const map = new Map<string, TrackableItem[]>();
    
    for (const item of items) {
        const activity = categorizeByActivity(item.name);
        if (!map.has(activity)) map.set(activity, []);
        map.get(activity)!.push(item);
    }
    
    return ACTIVITY_ORDER
        .filter(name => map.has(name))
        .map(name => ({ name, items: map.get(name)! }));
}

function filterItems(items: TrackableItem[], filters: Filters): TrackableItem[] {
    return items.filter(item => {
        if (filters.hideComplete && item.deficit === 0) return false;
        if (filters.tier !== null && item.tier !== filters.tier) return false;
        return true;
    });
}

function sortItems(items: TrackableItem[], by: Filters['sortBy']): TrackableItem[] {
    const copy = [...items];
    switch (by) {
        case 'deficit': return copy.sort((a, b) => b.deficit - a.deficit);
        case 'tier': return copy.sort((a, b) => b.tier - a.tier || b.deficit - a.deficit);
        case 'name': return copy.sort((a, b) => a.name.localeCompare(b.name));
    }
}

function filterGroups(groups: ActivityGroup[], activity: string | null): ActivityGroup[] {
    if (!activity) return groups;
    return groups.filter(g => g.name === activity);
}

function stripTierPrefix(name: string): string {
    for (const prefix of TIER_PREFIXES) {
        if (name.startsWith(prefix + ' ')) return name.slice(prefix.length + 1);
    }
    return name;
}

function sumDeficit(items: TrackableItem[]): number {
    return items.reduce((sum, i) => sum + i.deficit, 0);
}

function calcPercent(items: TrackableItem[]): number {
    const required = items.reduce((sum, i) => sum + i.required, 0);
    if (required === 0) return 100;
    const have = items.reduce((sum, i) => sum + Math.min(i.have, i.required), 0);
    return Math.round((have / required) * 100);
}

// =============================================================================
// RENDER FUNCTIONS
// =============================================================================

function renderItem(item: TrackableItem, compactNames: boolean): string {
    const status = item.deficit === 0 ? 'complete' 
        : item.pctComplete >= 50 ? 'partial' 
        : 'missing';
    
    const displayName = compactNames ? stripTierPrefix(item.name) : item.name;
    const tooltip = compactNames && displayName !== item.name ? `title="${item.name}"` : '';

    return `
        <div class="dash-item ${status}" ${tooltip}>
            <span class="dash-item-name">${displayName}</span>
            <span class="dash-item-tier">T${item.tier}</span>
            <span class="dash-item-deficit">${item.deficit > 0 ? `-${formatCompact(item.deficit)}` : '✓'}</span>
            <div class="dash-item-bar">
                <div class="dash-item-bar-fill" style="width: ${item.pctComplete}%"></div>
            </div>
        </div>`;
}

function renderGroup(group: ActivityGroup, collapsed: boolean, compactNames: boolean): string {
    const deficit = sumDeficit(group.items);
    const percent = calcPercent(group.items);
    
    return `
        <div class="dash-group ${collapsed ? 'collapsed' : ''}" data-activity="${group.name}">
            <div class="dash-group-header">
                <span class="dash-group-toggle">▼</span>
                <span class="dash-group-name">${group.name}</span>
                <span class="dash-group-stats">${group.items.length} · -${formatCompact(deficit)}</span>
                <div class="dash-group-bar">
                    <div class="dash-group-bar-fill" style="width: ${percent}%"></div>
                </div>
                <span class="dash-group-pct">${percent}%</span>
                <button class="dash-copy-group" title="Copy ${group.name} tasks">📋</button>
            </div>
            <div class="dash-group-items">
                ${group.items.map(item => renderItem(item, compactNames)).join('')}
            </div>
        </div>`;
}

function renderToolbar(tiers: number[], activities: string[], filters: Filters): string {
    return `
        <div class="dash-toolbar">
            <div class="dash-filters">
                <select id="dash-tier" class="dash-select">
                    <option value="">All Tiers</option>
                    ${tiers.map(t => `<option value="${t}" ${filters.tier === t ? 'selected' : ''}>T${t}</option>`).join('')}
                </select>
                <select id="dash-activity" class="dash-select">
                    <option value="">All Activities</option>
                    ${activities.map(a => `<option value="${a}" ${filters.activity === a ? 'selected' : ''}>${a}</option>`).join('')}
                </select>
            </div>
            <div class="dash-options">
                <label class="dash-toggle">
                    <input type="checkbox" id="dash-hide-complete" ${filters.hideComplete ? 'checked' : ''}>
                    <span>Hide ✓</span>
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

function itemToText(item: TrackableItem): string {
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
    const sections = groups
        .map(groupToText)
        .filter(text => text.split('\n').length > 1); // Has items beyond header
    
    if (sections.length === 0) return '';
    return [header, '', ...sections].join('\n');
}

// =============================================================================
// MODULE STATE & CONTROLLER
// =============================================================================

let items: TrackableItem[] = [];
let targetTier = 0;
let filters: Filters = {
    tier: null,
    activity: null,
    hideComplete: true,
    sortBy: 'deficit',
    compactNames: false
};
let collapsed = new Set<string>();
let container: HTMLElement | null = null;

function getVisibleGroups(): ActivityGroup[] {
    const filtered = filterItems(items, filters);
    const sorted = sortItems(filtered, filters.sortBy);
    const grouped = groupByActivity(sorted);
    return filterGroups(grouped, filters.activity);
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
        .map(g => renderGroup(g, collapsed.has(g.name), filters.compactNames))
        .join('');
    
    wireGroupEvents(groupsEl as HTMLElement, groups);
}

function wireGroupEvents(el: HTMLElement, groups: ActivityGroup[]): void {
    // Toggle collapse
    el.querySelectorAll<HTMLElement>('.dash-group-header').forEach(header => {
        header.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('.dash-copy-group')) return;
            
            const group = header.closest('.dash-group') as HTMLElement;
            const activity = group?.dataset.activity;
            if (!activity) return;
            
            collapsed.has(activity) ? collapsed.delete(activity) : collapsed.add(activity);
            group.classList.toggle('collapsed', collapsed.has(activity));
        });
    });
    
    // Copy group
    el.querySelectorAll<HTMLElement>('.dash-copy-group').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const group = btn.closest('.dash-group') as HTMLElement;
            const activity = group?.dataset.activity;
            const data = groups.find(g => g.name === activity);
            if (data) copyText(groupToText(data), btn);
        });
    });
}

function wireToolbarEvents(): void {
    if (!container) return;
    
    const on = <T extends HTMLElement>(id: string, event: string, handler: (el: T) => void) => {
        container!.querySelector(id)?.addEventListener(event, (e) => handler(e.target as T));
    };
    
    on<HTMLSelectElement>('#dash-tier', 'change', el => {
        filters.tier = el.value ? parseInt(el.value, 10) : null;
        renderGroups();
    });
    
    on<HTMLSelectElement>('#dash-activity', 'change', el => {
        filters.activity = el.value || null;
        renderGroups();
    });
    
    on<HTMLInputElement>('#dash-hide-complete', 'change', el => {
        filters.hideComplete = el.checked;
        renderGroups();
    });
    
    on<HTMLInputElement>('#dash-compact', 'change', el => {
        filters.compactNames = el.checked;
        renderGroups();
    });
    
    on<HTMLSelectElement>('#dash-sort', 'change', el => {
        filters.sortBy = el.value as Filters['sortBy'];
        renderGroups();
    });
}

function copyText(text: string, btn: HTMLElement): void {
    navigator.clipboard.writeText(text).then(() => {
        const original = btn.innerHTML;
        btn.innerHTML = '✓';
        setTimeout(() => btn.innerHTML = original, 1500);
    });
}

// =============================================================================
// PUBLIC API
// =============================================================================

export function render(el: HTMLElement, report: ProgressReport & { targetTier: number }): void {
    container = el;
    items = report.trackableItems;
    targetTier = report.targetTier;
    
    if (items.length === 0) {
        el.innerHTML = '<div class="dash-empty">No materials needed</div>';
        return;
    }
    
    const tiers = [...new Set(items.map(i => i.tier))].sort((a, b) => a - b);
    const activities = ACTIVITY_ORDER.filter(a => items.some(i => categorizeByActivity(i.name) === a));
    
    el.innerHTML = `
        <div class="dash">
            ${renderToolbar(tiers, activities, filters)}
            <div id="dash-groups"></div>
        </div>`;
    
    wireToolbarEvents();
    renderGroups();
}

export function generateDashboardText(): string {
    const groups = getVisibleGroups();
    const filterDesc = [
        filters.tier !== null ? `T${filters.tier}` : null,
        filters.activity
    ].filter(Boolean).join(', ');
    
    const header = filterDesc 
        ? `**T${targetTier} Upgrade** (${filterDesc} only)`
        : `**T${targetTier} Upgrade**`;
    
    return groupsToText(groups, header);
}

export function generateFullText(): string {
    const allGroups = groupByActivity(sortItems(items, 'deficit'));
    return groupsToText(allGroups, `**T${targetTier} Upgrade**`);
}

export function hasActiveFilters(): boolean {
    return filters.tier !== null || filters.activity !== null;
}