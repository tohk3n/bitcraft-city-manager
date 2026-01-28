/**
 * Dashboard - Dense, scannable material requirements view
 * 
 * Groups items by activity (Mining, Logging, etc.) for easy delegation.
 * Optimized for quick scanning: deficit is primary, progress is secondary.
 */

import { formatCompact, categorizeByActivity } from './lib/progress-calc.js';
import type { ProcessedNode, MappingType } from '../types.js';

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

// Module state
let hideComplete = true;
let collapsedGroups = new Set<string>();

/**
 * Render the dashboard into the container.
 */
export function render(
    container: HTMLElement,
    researches: ProcessedNode[],
    studyJournals: ProcessedNode | null
): void {
    const groups = collectByActivity(researches, studyJournals);
    
    if (groups.length === 0) {
        container.innerHTML = '<div class="dash-empty">No materials needed</div>';
        return;
    }

    container.innerHTML = `
        <div class="dash">
            <div class="dash-controls">
                <label class="dash-toggle">
                    <input type="checkbox" id="dash-hide-complete" ${hideComplete ? 'checked' : ''}>
                    <span>Hide complete</span>
                </label>
            </div>
            <div class="dash-groups" id="dash-groups"></div>
        </div>
    `;

    const groupsEl = container.querySelector('#dash-groups') as HTMLElement;

    container.querySelector('#dash-hide-complete')?.addEventListener('change', (e) => {
        hideComplete = (e.target as HTMLInputElement).checked;
        renderGroups(groupsEl, groups);
    });

    renderGroups(groupsEl, groups);
}

/**
 * Render activity groups.
 */
function renderGroups(container: HTMLElement, groups: ActivityGroup[]): void {
    const visibleGroups = groups
        .map(g => ({
            ...g,
            items: hideComplete ? g.items.filter(i => i.deficit > 0) : g.items
        }))
        .filter(g => g.items.length > 0);

    if (visibleGroups.length === 0) {
        container.innerHTML = '<div class="dash-complete">All materials ready</div>';
        return;
    }

    container.innerHTML = visibleGroups.map(g => renderGroup(g)).join('');

    // Attach event listeners
    container.querySelectorAll<HTMLElement>('.dash-group-header').forEach(header => {
        header.addEventListener('click', () => {
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

    return `
        <div class="dash-group ${isCollapsed ? 'collapsed' : ''}">
            <div class="dash-group-header" data-activity="${group.activity}">
                <span class="dash-group-toggle">${isCollapsed ? '▶' : '▼'}</span>
                <span class="dash-group-name">${group.activity.toUpperCase()}</span>
                <span class="dash-group-stats">${itemCount} items · -${formatCompact(totalDeficit)} total</span>
                <div class="dash-group-bar">
                    <div class="dash-group-bar-fill" style="width: ${group.percent}%"></div>
                </div>
                <span class="dash-group-pct">${group.percent}%</span>
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

    return `
        <div class="dash-item ${status}">
            <span class="dash-item-name">${item.name}</span>
            <span class="dash-item-tier">T${item.tier}</span>
            <span class="dash-item-deficit">${item.deficit > 0 ? `-${formatCompact(item.deficit)}` : '✓'}</span>
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

    // Build groups with aggregated stats, sorted by deficit desc
    const activityOrder = ['Mining', 'Logging', 'Farming', 'Fishing', 'Hunting', 'Crafting'];
    
    return activityOrder
        .filter(a => byActivity.has(a))
        .map(activity => {
            const groupItems = byActivity.get(activity)!;
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
 * Generate copyable text for all visible groups.
 */
export function generateExportText(
    researches: ProcessedNode[],
    studyJournals: ProcessedNode | null,
    targetTier: number
): string {
    const groups = collectByActivity(researches, studyJournals);
    const lines = [`**T${targetTier} Upgrade**`, ''];

    for (const group of groups) {
        const items = hideComplete ? group.items.filter(i => i.deficit > 0) : group.items;
        if (items.length === 0) continue;

        lines.push(`**${group.activity.toUpperCase()}**`);
        for (const item of items) {
            if (item.deficit > 0) {
                lines.push(`- ${item.deficit.toLocaleString()}x ${item.name} (T${item.tier})`);
            }
        }
        lines.push('');
    }

    return lines.join('\n');
}

function copyToClipboard(text: string, btn: HTMLElement): void {
    navigator.clipboard.writeText(text).then(() => {
        const original = btn.innerHTML;
        btn.innerHTML = '✓';
        setTimeout(() => btn.innerHTML = original, 1500);
    });
}