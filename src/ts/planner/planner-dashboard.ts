/**
 * Dashboard - Dense, scannable material requirements view
 * 
 * Groups items by activity (Mining, Logging, etc.) for easy delegation.
 * Optimized for quick scanning: deficit is primary, progress is secondary.
 * 
 * Features:
 * - Filter by tier and activity
 * - Sort by deficit, tier, or name
 * - Copy filtered results
 * - Compact name option (strips tier prefixes)
 */

import { formatCompact, categorizeByActivity } from './lib/progress-calc.js';
import type { ProcessedNode, MappingType } from '../types/index.js';

// Collected item with computed fields
interface DashboardItem {
    name: string;
    tier: number;
    required: number;
    have: number;
    deficit: number;
    percent: number;
}

// Activity group with aggregated stats
interface ActivityGroup {
    activity: string;
    items: DashboardItem[];
    totalDeficit: number;
    totalRequired: number;
    totalHave: number;
    percent: number;
}

// Filter/sort state
interface FilterState {
    hideComplete: boolean;
    tierFilter: number | null;      // null = all tiers
    activityFilter: string | null;  // null = all activities
    sortBy: 'deficit' | 'tier' | 'name';
    compactNames: boolean;
}

// Tier prefixes to strip for compact display
const TIER_PREFIXES = [
    'Basic', 'Simple', 'Sturdy', 'Fine', 'Exquisite',
    'Rough', 'Novice', 'Essential', 'Proficient', 'Advanced',
    'Infused', 'Refined'
];

// Module state
let filterState: FilterState = {
    hideComplete: true,
    tierFilter: null,
    activityFilter: null,
    sortBy: 'deficit',
    compactNames: false
};
let collapsedGroups = new Set<string>();
let cachedGroups: ActivityGroup[] = [];
let containerRef: HTMLElement | null = null;

/**
 * Get compact name by stripping tier prefix.
 */
function getCompactName(name: string): string {
    for (const prefix of TIER_PREFIXES) {
        if (name.startsWith(prefix + ' ')) {
            return name.slice(prefix.length + 1);
        }
    }
    return name;
}

/**
 * Render the dashboard into the container.
 */
export function render(
    container: HTMLElement,
    researches: ProcessedNode[],
    studyJournals: ProcessedNode | null
): void {
    containerRef = container;
    cachedGroups = collectByActivity(researches, studyJournals);
    
    if (cachedGroups.length === 0) {
        container.innerHTML = '<div class="dash-empty">No materials needed</div>';
        return;
    }

    // Collect all unique tiers for filter dropdown
    const allTiers = new Set<number>();
    for (const group of cachedGroups) {
        for (const item of group.items) {
            allTiers.add(item.tier);
        }
    }
    const tierOptions = Array.from(allTiers).sort((a, b) => a - b);

    // Activity options
    const activityOptions = cachedGroups.map(g => g.activity);

    container.innerHTML = `
        <div class="dash">
            <div class="dash-toolbar">
                <div class="dash-filters">
                    <select id="dash-tier-filter" class="dash-select" title="Filter by tier">
                        <option value="">All Tiers</option>
                        ${tierOptions.map(t => `<option value="${t}" ${filterState.tierFilter === t ? 'selected' : ''}>T${t}</option>`).join('')}
                    </select>
                    <select id="dash-activity-filter" class="dash-select" title="Filter by activity">
                        <option value="">All Activities</option>
                        ${activityOptions.map(a => `<option value="${a}" ${filterState.activityFilter === a ? 'selected' : ''}>${a}</option>`).join('')}
                    </select>
                </div>
                <div class="dash-options">
                    <label class="dash-toggle" title="Hide items with zero deficit">
                        <input type="checkbox" id="dash-hide-complete" ${filterState.hideComplete ? 'checked' : ''}>
                        <span>Hide done</span>
                    </label>
                    <label class="dash-toggle" title="Shorten names by removing tier prefixes">
                        <input type="checkbox" id="dash-compact-names" ${filterState.compactNames ? 'checked' : ''}>
                        <span>Short names</span>
                    </label>
                </div>
                <div class="dash-sort">
                    <label>Sort:</label>
                    <select id="dash-sort" class="dash-select">
                        <option value="deficit" ${filterState.sortBy === 'deficit' ? 'selected' : ''}>Deficit</option>
                        <option value="tier" ${filterState.sortBy === 'tier' ? 'selected' : ''}>Tier</option>
                        <option value="name" ${filterState.sortBy === 'name' ? 'selected' : ''}>Name</option>
                    </select>
                </div>
            </div>
            <div class="dash-groups" id="dash-groups"></div>
        </div>
    `;

    const groupsEl = container.querySelector('#dash-groups') as HTMLElement;

    // Wire up controls
    container.querySelector('#dash-tier-filter')?.addEventListener('change', (e) => {
        const val = (e.target as HTMLSelectElement).value;
        filterState.tierFilter = val ? parseInt(val, 10) : null;
        renderGroups(groupsEl);
    });

    container.querySelector('#dash-activity-filter')?.addEventListener('change', (e) => {
        const val = (e.target as HTMLSelectElement).value;
        filterState.activityFilter = val || null;
        renderGroups(groupsEl);
    });

    container.querySelector('#dash-hide-complete')?.addEventListener('change', (e) => {
        filterState.hideComplete = (e.target as HTMLInputElement).checked;
        renderGroups(groupsEl);
    });

    container.querySelector('#dash-compact-names')?.addEventListener('change', (e) => {
        filterState.compactNames = (e.target as HTMLInputElement).checked;
        renderGroups(groupsEl);
    });

    container.querySelector('#dash-sort')?.addEventListener('change', (e) => {
        filterState.sortBy = (e.target as HTMLSelectElement).value as FilterState['sortBy'];
        renderGroups(groupsEl);
    });

    renderGroups(groupsEl);
}

/**
 * Apply filters and get visible groups/items.
 */
function getFilteredGroups(): ActivityGroup[] {
    return cachedGroups
        .filter(g => !filterState.activityFilter || g.activity === filterState.activityFilter)
        .map(g => {
            let items = g.items;
            
            // Apply tier filter
            if (filterState.tierFilter !== null) {
                items = items.filter(i => i.tier === filterState.tierFilter);
            }
            
            // Apply hide complete
            if (filterState.hideComplete) {
                items = items.filter(i => i.deficit > 0);
            }
            
            // Apply sort
            items = sortItems([...items], filterState.sortBy);
            
            return { ...g, items };
        })
        .filter(g => g.items.length > 0);
}

/**
 * Sort items by criteria.
 */
function sortItems(items: DashboardItem[], by: FilterState['sortBy']): DashboardItem[] {
    switch (by) {
        case 'deficit':
            return items.sort((a, b) => b.deficit - a.deficit);
        case 'tier':
            return items.sort((a, b) => b.tier - a.tier || b.deficit - a.deficit);
        case 'name':
            return items.sort((a, b) => a.name.localeCompare(b.name));
        default:
            return items;
    }
}

/**
 * Render activity groups.
 */
function renderGroups(container: HTMLElement): void {
    const visibleGroups = getFilteredGroups();

    if (visibleGroups.length === 0) {
        container.innerHTML = '<div class="dash-complete">No items match filters</div>';
        return;
    }

    container.innerHTML = visibleGroups.map(g => renderGroup(g)).join('');

    // Attach event listeners
    container.querySelectorAll<HTMLElement>('.dash-group-header').forEach(header => {
        header.addEventListener('click', (e) => {
            // Don't toggle if clicking copy button
            if ((e.target as HTMLElement).closest('.dash-copy-group')) return;
            
            const activity = header.dataset.activity;
            if (!activity) return;

            if (collapsedGroups.has(activity)) {
                collapsedGroups.delete(activity);
            } else {
                collapsedGroups.add(activity);
            }

            const group = header.closest('.dash-group');
            group?.classList.toggle('collapsed', collapsedGroups.has(activity));
        });
    });

    // Copy group button
    container.querySelectorAll<HTMLElement>('.dash-copy-group').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const activity = btn.dataset.activity;
            const group = visibleGroups.find(g => g.activity === activity);
            if (group) {
                const text = generateGroupText(group);
                copyToClipboard(text, btn);
            }
        });
    });
}

/**
 * Render a single activity group.
 */
function renderGroup(group: ActivityGroup): string {
    const isCollapsed = collapsedGroups.has(group.activity);
    const itemCount = group.items.length;
    const totalDeficit = group.items.reduce((sum, i) => sum + i.deficit, 0);
    const pct = group.totalRequired > 0 
        ? Math.round((group.totalHave / group.totalRequired) * 100) 
        : 100;

    return `
        <div class="dash-group ${isCollapsed ? 'collapsed' : ''}">
            <div class="dash-group-header" data-activity="${group.activity}">
                <span class="dash-group-toggle">&#9660;</span>
                <span class="dash-group-name">${group.activity}</span>
                <span class="dash-group-stats">${itemCount} &middot; -${formatCompact(totalDeficit)}</span>
                <div class="dash-group-bar">
                    <div class="dash-group-bar-fill" style="width: ${pct}%"></div>
                </div>
                <span class="dash-group-pct">${pct}%</span>
                <button class="dash-copy-group" data-activity="${group.activity}" title="Copy ${group.activity} tasks">
                    &#128203;
                </button>
            </div>
            <div class="dash-group-items">
                ${group.items.map(renderItem).join('')}
            </div>
        </div>
    `;
}

/**
 * Render a single item chip.
 */
function renderItem(item: DashboardItem): string {
    const status = item.deficit === 0 ? 'complete' 
        : item.percent >= 50 ? 'partial' 
        : 'missing';
    
    const displayName = filterState.compactNames ? getCompactName(item.name) : item.name;
    const needsTooltip = filterState.compactNames && displayName !== item.name;

    return `
        <div class="dash-item ${status}" ${needsTooltip ? `title="${item.name}"` : ''}>
            <span class="dash-item-name">${displayName}</span>
            <span class="dash-item-tier">T${item.tier}</span>
            <span class="dash-item-deficit">${item.deficit > 0 ? `-${formatCompact(item.deficit)}` : '&#10003;'}</span>
            <div class="dash-item-bar">
                <div class="dash-item-bar-fill" style="width: ${item.percent}%"></div>
            </div>
        </div>
    `;
}

/**
 * Collect all trackable items grouped by activity.
 */
function collectByActivity(
    researches: ProcessedNode[],
    studyJournals: ProcessedNode | null
): ActivityGroup[] {
    const items = new Map<string, DashboardItem>();

    function collect(node: ProcessedNode): void {
        if (node.satisfiedByParent) return;

        if (node.trackable && node.required > 0) {
            const key = `${node.name}:${node.tier}`;
            if (!items.has(key)) {
                items.set(key, {
                    name: node.name,
                    tier: node.tier,
                    required: 0,
                    have: node.have,
                    deficit: 0,
                    percent: 0
                });
            }
            items.get(key)!.required += node.required;
        }

        for (const child of node.children || []) {
            collect(child);
        }
    }

    for (const research of researches) {
        collect(research);
    }
    if (studyJournals) {
        collect(studyJournals);
    }

    // Calculate deficits and group by activity
    const byActivity = new Map<string, DashboardItem[]>();

    for (const item of items.values()) {
        item.deficit = Math.max(0, item.required - item.have);
        item.percent = item.required > 0 
            ? Math.round((Math.min(item.have, item.required) / item.required) * 100)
            : 100;

        const activity = categorizeByActivity(item.name);
        if (!byActivity.has(activity)) {
            byActivity.set(activity, []);
        }
        byActivity.get(activity)!.push(item);
    }

    // Build groups with aggregated stats
    const activityOrder = ['Mining', 'Logging', 'Farming', 'Fishing', 'Hunting', 'Crafting'];
    
    return activityOrder
        .filter(a => byActivity.has(a))
        .map(activity => {
            const groupItems = byActivity.get(activity)!;
            // Default sort by deficit
            groupItems.sort((a, b) => b.deficit - a.deficit);

            const totalRequired = groupItems.reduce((sum, i) => sum + i.required, 0);
            const totalHave = groupItems.reduce((sum, i) => sum + Math.min(i.have, i.required), 0);

            return {
                activity,
                items: groupItems,
                totalDeficit: groupItems.reduce((sum, i) => sum + i.deficit, 0),
                totalRequired,
                totalHave,
                percent: totalRequired > 0 ? Math.round((totalHave / totalRequired) * 100) : 100
            };
        });
}

/**
 * Generate copyable text for a group.
 */
function generateGroupText(group: ActivityGroup): string {
    const lines = [`**${group.activity.toUpperCase()}**`];
    for (const item of group.items) {
        if (item.deficit > 0) {
            lines.push(`- ${item.deficit.toLocaleString()}x ${item.name} (T${item.tier})`);
        }
    }
    return lines.join('\n');
}

/**
 * Generate copyable text for filtered view (what user currently sees).
 */
export function generateDashboardText(targetTier: number): string {
    const visibleGroups = getFilteredGroups();
    
    if (visibleGroups.length === 0) return '';
    
    const lines: string[] = [];
    
    // Header with filter info if filtered
    const filterParts: string[] = [];
    if (filterState.tierFilter !== null) filterParts.push(`T${filterState.tierFilter}`);
    if (filterState.activityFilter) filterParts.push(filterState.activityFilter);
    
    if (filterParts.length > 0) {
        lines.push(`**T${targetTier} Upgrade** (${filterParts.join(', ')} only)`);
    } else {
        lines.push(`**T${targetTier} Upgrade**`);
    }
    lines.push('');

    for (const group of visibleGroups) {
        if (group.items.length === 0) continue;

        lines.push(`**${group.activity.toUpperCase()}**`);
        for (const item of group.items) {
            if (item.deficit > 0) {
                lines.push(`- ${item.deficit.toLocaleString()}x ${item.name} (T${item.tier})`);
            }
        }
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Generate full (unfiltered) export text.
 */
export function generateFullText(targetTier: number): string {
    if (cachedGroups.length === 0) return '';
    
    const lines = [`**T${targetTier} Upgrade**`, ''];

    for (const group of cachedGroups) {
        const items = group.items.filter(i => i.deficit > 0);
        if (items.length === 0) continue;

        lines.push(`**${group.activity.toUpperCase()}**`);
        for (const item of items) {
            lines.push(`- ${item.deficit.toLocaleString()}x ${item.name} (T${item.tier})`);
        }
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Check if any filters are active.
 */
export function hasActiveFilters(): boolean {
    return filterState.tierFilter !== null || filterState.activityFilter !== null;
}

function copyToClipboard(text: string, btn: HTMLElement): void {
    navigator.clipboard.writeText(text).then(() => {
        const original = btn.innerHTML;
        btn.innerHTML = '&#10003;';
        setTimeout(() => btn.innerHTML = original, 1500);
    });
}