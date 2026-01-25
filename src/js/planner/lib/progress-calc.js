/**
 * Progress Calculator
 *
 * Calculates progress statistics from processed recipe trees.
 * Pure functions for aggregation and grouping.
 */

import { collectFirstTrackable, collectTrackableItems, collectSecondLevel } from './cascade-calc.js';

/**
 * Activity categories for grouping items.
 */
const ACTIVITIES = {
    MINING: 'Mining',
    LOGGING: 'Logging',
    FARMING: 'Farming',
    FISHING: 'Fishing',
    HUNTING: 'Hunting',
    CRAFTING: 'Crafting'
};

/**
 * Categorize an item by gathering/crafting activity.
 *
 * @param {string} name - Item name
 * @returns {string} Activity category
 */
export function categorizeByActivity(name) {
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

        // Farming - plants and crops
        if (lower.includes('flower') || lower.includes('fiber') || lower.includes('berry') ||
            lower.includes('roots') || lower.includes('seed') || lower.includes('grain')) {
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

/**
 * Calculate overall progress from processed codex.
 * Uses first trackable items as the progress metric.
 *
 * @param {Object} processedCodex - Result from applyCascade
 * @returns {Object} Progress summary
 */
export function calculateProgress(processedCodex) {
    const firstTrackable = collectFirstTrackable(processedCodex);

    // Calculate totals from first trackable items
    let totalRequired = 0;
    let totalContribution = 0;

    for (const item of firstTrackable) {
        totalRequired += item.required;
        totalContribution += Math.min(item.have, item.required);
    }

    const percent = totalRequired > 0
    ? Math.round((totalContribution / totalRequired) * 100)
    : 100;

    // Count complete items
    const completeCount = firstTrackable.filter(item => item.deficit === 0).length;

    return {
        percent,
        totalRequired,
        totalContribution,
        totalItems: firstTrackable.length,
        completeCount,
        items: firstTrackable
    };
}

/**
 * Calculate progress by research branch.
 *
 * @param {Object} processedCodex - Result from applyCascade
 * @returns {Object} Map of research name -> progress data
 */
export function calculateProgressByResearch(processedCodex) {
    const byResearch = {};

    for (const research of processedCodex.researches) {
        let totalRequired = 0;
        let totalContribution = 0;

        // Walk tree to find trackable items in this research
        function collect(node) {
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
            status: research.status
        };
    }

    return byResearch;
}

/**
 * Group items by activity for task assignment.
 *
 * @param {Array} items - Array of items with deficit
 * @returns {Object} Map of activity -> items array
 */
export function groupByActivity(items) {
    const byActivity = {};

    for (const item of items) {
        if (item.deficit <= 0) continue;

        const activity = categorizeByActivity(item.name);

        if (!byActivity[activity]) {
            byActivity[activity] = {
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
 *
 * @param {Object} processedCodex - Result from applyCascade
 * @returns {Object} Comprehensive progress report
 */
export function generateProgressReport(processedCodex) {
    const firstTrackable = collectFirstTrackable(processedCodex);
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
        firstTrackable,
        secondLevel,
        codexName: processedCodex.name,
        codexTier: processedCodex.tier,
        targetCount: processedCodex.targetCount
    };
}

/**
 * Format a number compactly for display.
 *
 * @param {number} num - Number to format
 * @returns {string} Formatted string (e.g., "1.2M", "456K")
 */
export function formatCompact(num) {
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
 *
 * @param {Object} report - Result from generateProgressReport
 * @param {number} targetTier - Target tier number
 * @returns {string} Formatted task list
 */
export function generateExportText(report, targetTier) {
    const { overall, byActivity, codexName } = report;

    if (overall.completeCount === overall.totalItems) {
        return `**T${targetTier} Upgrade - ${codexName}**\nAll requirements met!`;
    }

    const lines = [];
    lines.push(`**T${targetTier} Upgrade - ${codexName}**`);
    lines.push(`Progress: ${overall.percent}% complete`);
    lines.push('');

    const activityOrder = ['Mining', 'Logging', 'Farming', 'Fishing', 'Hunting', 'Crafting'];

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

export { ACTIVITIES };
