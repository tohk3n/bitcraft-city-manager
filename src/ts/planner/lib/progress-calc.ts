/**
 * Progress Calculator
 *
 * Calculates progress statistics from processed recipe trees.
 * Pure functions for aggregation and grouping.
 */

import { collectFirstTrackable, collectTrackableItems, collectSecondLevel } from './cascade-calc.js';
import type {
    ProcessedCodex,
    ProcessedNode,
    TrackableItem,
    FirstTrackableItem,
    SecondLevelItem,
    ProgressReport,
    ActivityGroup,
    ResearchProgress
} from '../../types/index.js';

/**
 * Activity categories for grouping items.
 */
const ACTIVITIES = {
    MINING: 'Mining',
    LOGGING: 'Logging',
    FORAGING: 'Foraging',
    FARMING: 'Farming',
    FISHING: 'Fishing',
    HUNTING: 'Hunting',
    CRAFTING: 'Crafting'
} as const;
type Activity = typeof ACTIVITIES[keyof typeof ACTIVITIES];

/**
 * Categorize an item by gathering/crafting activity.
 */
export function categorizeByActivity(name: string): Activity {
    const lower = name.toLowerCase();

    // Mining - raw stone/ore materials
    if (lower.includes('chunk') || lower.includes('ore') || lower.includes('pebble') ||
        lower.includes('clay lump') || lower.includes('gypsite') || lower.includes('sand')) {
        return ACTIVITIES.MINING;
        }

    // Logging - raw wood materials
    if (lower.includes('trunk') || lower.includes('bark') || lower.includes('log')) {
        return ACTIVITIES.LOGGING;
    }

            // Foraging - wild plants gathered from the world
    if (lower.includes('flower') || lower.includes('berry') || 
        lower.includes('roots') || lower.includes('plant fiber')) {
        return ACTIVITIES.FORAGING;
    }

    // Farming - plants and crops
    if (lower.includes('seed') || lower.includes('grain') || lower.includes('vegetable')) {
        return ACTIVITIES.FARMING;
    }

    // Fishing - aquatic creatures
    if (lower.includes('fish') || lower.includes('crawfish') || lower.includes('crawdad') ||
        lower.includes('lobster') || lower.includes('crab') || lower.includes('darter') ||
        lower.includes('chub') || lower.includes('shiner')) {
        return ACTIVITIES.FISHING;
    }

    // Hunting - animal materials
    if (lower.includes('pelt') || lower.includes('hide')) {
        return ACTIVITIES.HUNTING;
    }

    // Everything else is crafting
    return ACTIVITIES.CRAFTING;
}

interface ProgressSummary {
    percent: number;
    totalRequired: number;
    totalContribution: number;
    totalItems: number;
    completeCount: number;
    items: TrackableItem[];
}

/**
 * Calculate overall progress from processed codex.
 * Uses first trackable items as the progress metric.
 */
export function calculateProgress(processedCodex: ProcessedCodex): ProgressSummary {
    // Use all trackable items, not just first trackable
    const trackable = collectTrackableItems(processedCodex);

    let totalRequired = 0;
    let totalContribution = 0;

    for (const item of trackable) {
        totalRequired += item.required;
        totalContribution += Math.min(item.have, item.required);
    }

    const percent = totalRequired > 0
        ? Math.round((totalContribution / totalRequired) * 100)
        : 100;

    const completeCount = trackable.filter(item => item.deficit === 0).length;

    return {
        percent,
        totalRequired,
        totalContribution,
        totalItems: trackable.length,
        completeCount,
        items: trackable
    };
}

/**
 * Calculate progress by research branch.
 */
export function calculateProgressByResearch(
    processedCodex: ProcessedCodex
): Record<string, ResearchProgress> {
    const byResearch: Record<string, ResearchProgress> = {};

    for (const research of processedCodex.researches) {
        let totalRequired = 0;
        let totalContribution = 0;
        const items: TrackableItem[] = [];

        // Walk tree to find trackable items in this research
        function collect(node: ProcessedNode): void {
            if (node.trackable && node.required > 0) {
                totalRequired += node.required;
                totalContribution += Math.min(node.have, node.required);
            }
            for (const child of node.children || []) {
                collect(child);
            }
        }

        collect(research);

        const percent = totalRequired > 0
        ? Math.round((totalContribution / totalRequired) * 100)
        : 100;

        byResearch[research.name] = {
            percent,
            totalRequired,
            totalContribution,
            items
        };
    }

    return byResearch;
}

/**
 * Group items by activity for task assignment.
 */
export function groupByActivity(
    items: FirstTrackableItem[]
): Record<string, ActivityGroup> {
    const byActivity: Record<string, ActivityGroup> = {};

    for (const item of items) {
        if (item.deficit <= 0) continue;

        const activity = categorizeByActivity(item.name);

        if (!byActivity[activity]) {
            byActivity[activity] = {
                activity,
                items: [],
                totalDeficit: 0
            };
        }

        byActivity[activity].items.push(item);
        byActivity[activity].totalDeficit += item.deficit;
    }

    // Sort items within each activity by deficit
    for (const activity of Object.keys(byActivity)) {
        byActivity[activity].items.sort((a, b) => b.deficit - a.deficit);
    }

    return byActivity;
}

/**
 * Generate a complete progress report.
 */
export function generateProgressReport(processedCodex: ProcessedCodex): ProgressReport {
    const firstTrackable = collectFirstTrackable(processedCodex);
    const trackableItems = collectTrackableItems(processedCodex);
    const progress = calculateProgress(processedCodex);
    const byResearch = calculateProgressByResearch(processedCodex);
    const byActivity = groupByActivity(firstTrackable);
    const secondLevel = collectSecondLevel(processedCodex);

    return {
        overall: {
            percent: progress.percent,
            totalRequired: progress.totalRequired,
            totalContribution: progress.totalContribution,
            completeCount: progress.completeCount,
            totalItems: progress.totalItems
        },
        byResearch,
        byActivity,
        trackableItems,
        firstTrackable,
        secondLevel,
        targetCount: processedCodex.targetCount
    };
}

/**
 * Format a number compactly for display.
 */
export function formatCompact(num: number): string {
    if (num >= 1e9) {
        return (num / 1e9).toFixed(num >= 10e9 ? 0 : 1).replace(/\.0$/, '') + 'B';
    }
    if (num >= 1e6) {
        return (num / 1e6).toFixed(num >= 10e6 ? 0 : 1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1e4) {
        return (num / 1e3).toFixed(num >= 100e3 ? 0 : 1).replace(/\.0$/, '') + 'K';
    }
    return num.toLocaleString();
}

/**
 * Generate exportable task list text (Discord-friendly markdown).
 */
export function generateExportText(report: ProgressReport, targetTier: number): string {
    const { overall, byActivity } = report;

    if (overall.completeCount === overall.totalItems) {
        return `**T${targetTier} Upgrade**\nAll requirements met!`;
    }

    const lines: string[] = [];
    lines.push(`**T${targetTier} Upgrade**`);
    lines.push(`Progress: ${overall.percent}% complete`);
    lines.push('');

    const activityOrder = ['Mining', 'Logging', 'Foraging', 'Farming', 'Fishing', 'Hunting', 'Crafting'];

    for (const activity of activityOrder) {
        const data = byActivity[activity];
        if (!data || data.items.length === 0) continue;

        lines.push(`**${activity.toUpperCase()}**`);

        for (const item of data.items) {
            const tierStr = item.tier > 0 ? ` (T${item.tier})` : '';
            lines.push(`- ${formatCompact(item.deficit)}x ${item.name}${tierStr}`);
        }

        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Generate CSV export of ALL material requirements (deep walk).
 * Matches the clipboard copy format.
 */
export function generateCSV(report: ProgressReport, targetTier: number): string {
    const lines = ['activity,name,tier,required,have,deficit'];
    
    // Use trackableItems (full tree walk) not firstTrackable (stops early)
    const { trackableItems } = report;
    
    // Group by activity and sort by deficit (matching clipboard format)
    const byActivity = new Map<string, typeof trackableItems>();
    
    for (const item of trackableItems) {
        if (item.deficit <= 0) continue; // Skip complete items
        
        const activity = categorizeByActivity(item.name);
        if (!byActivity.has(activity)) {
            byActivity.set(activity, []);
        }
        byActivity.get(activity)!.push(item);
    }
    
    // Sort each activity group by deficit descending
    const activityOrder = ['Mining', 'Logging', 'Foraging', 'Farming', 'Fishing', 'Hunting', 'Crafting'];
    
    for (const activity of activityOrder) {
        const items = byActivity.get(activity);
        if (!items || items.length === 0) continue;
        
        items.sort((a, b) => b.deficit - a.deficit);
        
        for (const item of items) {
            const escapedName = item.name.includes(',') ? `"${item.name}"` : item.name;
            lines.push([
                activity,
                escapedName,
                item.tier,
                item.required,
                item.have,
                item.deficit
            ].join(','));
        }
    }
    
    return lines.join('\n');
}

export { ACTIVITIES };
