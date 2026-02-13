/**
 * Progress Calculator
 *
 * Calculates progress statistics from processed recipe trees.
 * Pure functions for aggregation and grouping.
 */

import {
  collectFirstTrackable,
  collectTrackableItems,
  collectSecondLevel,
} from './cascade-calc.js';
import type {
  ProcessedCodex,
  ProcessedNode,
  TrackableItem,
  FirstTrackableItem,
  ProgressReport,
  ActivityGroup,
  ResearchProgress,
  MappingType,
  Activity,
  PlanItem,
  PlanProgressSummary,
} from '../../types/index.js';
import { createKey } from './inventory-matcher.js';
import { CONFIG } from '../../configuration/index.js';

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
  CRAFTING: 'Crafting',
} as const;

const ACTIVITY_ORDER = CONFIG.PLANNER.ACTIVITY_ORDER;

/**
 * Categorize an item by gathering/crafting activity.
 */
export function categorizeByActivity(name: string): Activity {
  const lower = name.toLowerCase();

  // Mining - raw stone/ore materials
  if (
    lower.includes('chunk') ||
    lower.includes('ore') ||
    lower.includes('pebble') ||
    lower.includes('clay lump') ||
    lower.includes('gypsite') ||
    lower.includes('sand')
  ) {
    return ACTIVITIES.MINING;
  }

  // Logging - raw wood materials
  if (lower.includes('trunk') || lower.includes('bark') || lower.includes('log')) {
    return ACTIVITIES.LOGGING;
  }

  // Foraging - wild plants gathered from the world
  if (
    lower.includes('flower') ||
    lower.includes('berry') ||
    lower.includes('roots') ||
    lower.includes('plant fiber')
  ) {
    return ACTIVITIES.FORAGING;
  }

  // Farming - plants and crops
  if (lower.includes('seed') || lower.includes('grain') || lower.includes('vegetable')) {
    return ACTIVITIES.FARMING;
  }

  // Fishing - aquatic creatures
  if (
    lower.includes('fish') ||
    lower.includes('crawfish') ||
    lower.includes('crawdad') ||
    lower.includes('lobster') ||
    lower.includes('crab') ||
    lower.includes('darter') ||
    lower.includes('chub') ||
    lower.includes('shiner')
  ) {
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

  const percent = totalRequired > 0 ? Math.round((totalContribution / totalRequired) * 100) : 100;

  const completeCount = trackable.filter((item) => item.deficit === 0).length;

  return {
    percent,
    totalRequired,
    totalContribution,
    totalItems: trackable.length,
    completeCount,
    items: trackable,
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

    const percent = totalRequired > 0 ? Math.round((totalContribution / totalRequired) * 100) : 100;

    byResearch[research.name] = {
      percent,
      totalRequired,
      totalContribution,
      items,
    };
  }

  return byResearch;
}

/**
 * Group items by activity for task assignment.
 */
export function groupByActivity(items: FirstTrackableItem[]): Record<string, ActivityGroup> {
  const byActivity: Record<string, ActivityGroup> = {};

  for (const item of items) {
    if (item.deficit <= 0) continue;

    const activity = categorizeByActivity(item.name);

    if (!byActivity[activity]) {
      byActivity[activity] = {
        activity,
        items: [],
        totalDeficit: 0,
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
      totalItems: progress.totalItems,
    },
    byResearch,
    byActivity,
    trackableItems,
    firstTrackable,
    secondLevel,
    targetCount: processedCodex.targetCount,
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

  const activityOrder = [
    'Mining',
    'Logging',
    'Foraging',
    'Farming',
    'Fishing',
    'Hunting',
    'Crafting',
  ];

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
export function generateCSV(report: ProgressReport): string {
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
    byActivity.get(activity)?.push(item);
  }

  // Sort each activity group by deficit descending
  const activityOrder = [
    'Mining',
    'Logging',
    'Foraging',
    'Farming',
    'Fishing',
    'Hunting',
    'Crafting',
  ];

  for (const activity of activityOrder) {
    const items = byActivity.get(activity);
    if (!items || items.length === 0) continue;

    items.sort((a, b) => b.deficit - a.deficit);

    for (const item of items) {
      const escapedName = item.name.includes(',') ? `"${item.name}"` : item.name;
      lines.push(
        [activity, escapedName, item.tier, item.required, item.have, item.deficit].join(',')
      );
    }
  }

  return lines.join('\n');
}

/**
 * Flatten a processed codex tree into a single deduplicated list of PlanItems.
 *
 * Walks both researches and studyJournals. Deduplicates by name:tier key,
 * summing `required` across occurrences. Each item gets its activity and
 * actionable flag computed once during flattening.
 */
export function flattenPlan(codex: ProcessedCodex): PlanItem[] {
  const items = new Map<
    string,
    {
      name: string;
      tier: number;
      required: number;
      have: number;
      mappingType: MappingType;
      hasTrackableChildren: boolean;
      trackable: boolean;
    }
  >();

  function collect(node: ProcessedNode): void {
    // Add this node if it qualifies
    if (node.trackable && node.required > 0 && !node.satisfiedByParent) {
      const key = createKey(node.name, node.tier);
      const hasTrackableChildren = node.children.some((c) => c.trackable);
      let item = items.get(key);

      if (!item) {
        item = {
          name: node.name,
          tier: node.tier,
          required: 0,
          have: node.have,
          mappingType: node.mappingType,
          hasTrackableChildren,
          trackable: node.trackable,
        };
        items.set(key, item);
      }

      item.required += node.required;
      if (hasTrackableChildren) {
        item.hasTrackableChildren = true;
      }
    }

    // Always recurse
    for (const child of node.children) collect(child);
  }

  // Walk researches
  for (const research of codex.researches) collect(research);

  // Walk study journals (fixes missing journal sub-materials)
  if (codex.studyJournals) collect(codex.studyJournals);

  return Array.from(items.values())
    .map((item): PlanItem => {
      const deficit = Math.max(0, item.required - item.have);
      return {
        name: item.name,
        tier: item.tier,
        required: item.required,
        have: item.have,
        deficit,
        pctComplete:
          item.required > 0
            ? Math.round((Math.min(item.have, item.required) / item.required) * 100)
            : 100,
        activity: categorizeByActivity(item.name),
        actionable: item.trackable && !item.hasTrackableChildren,
        mappingType: item.mappingType,
      };
    })
    .sort((a, b) => b.deficit - a.deficit);
}

/**
 * Calculate aggregate progress from a PlanItem list.
 */
export function calculatePlanProgress(items: PlanItem[]): PlanProgressSummary {
  let totalRequired = 0;
  let totalContribution = 0;

  for (const item of items) {
    totalRequired += item.required;
    totalContribution += Math.min(item.have, item.required);
  }

  return {
    percent: totalRequired > 0 ? Math.round((totalContribution / totalRequired) * 100) : 100,
    totalRequired,
    totalContribution,
    totalItems: items.length,
    completeCount: items.filter((item) => item.deficit === 0).length,
  };
}

/**
 * Generate Discord-friendly export text from PlanItems.
 */
export function generatePlanExportText(items: PlanItem[], targetTier: number): string {
  const progress = calculatePlanProgress(items);

  if (progress.completeCount === progress.totalItems) {
    return `**T${targetTier} Upgrade**\nAll requirements met!`;
  }

  const lines: string[] = [];
  lines.push(`**T${targetTier} Upgrade**`);
  lines.push(`Progress: ${progress.percent}% complete`);
  lines.push('');

  for (const activity of ACTIVITY_ORDER) {
    const activityItems = items.filter((i) => i.activity === activity && i.deficit > 0);
    if (activityItems.length === 0) continue;

    activityItems.sort((a, b) => b.deficit - a.deficit);
    lines.push(`**${activity.toUpperCase()}**`);

    for (const item of activityItems) {
      const tierStr = item.tier > 0 ? ` (T${item.tier})` : '';
      lines.push(`- ${formatCompact(item.deficit)}x ${item.name}${tierStr}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate CSV from PlanItems.
 */
export function generatePlanCSV(items: PlanItem[]): string {
  const lines = ['activity,name,tier,required,have,deficit'];

  for (const activity of ACTIVITY_ORDER) {
    const activityItems = items
      .filter((i) => i.activity === activity && i.deficit > 0)
      .sort((a, b) => b.deficit - a.deficit);

    for (const item of activityItems) {
      const escapedName = item.name.includes(',') ? `"${item.name}"` : item.name;
      lines.push(
        [activity, escapedName, item.tier, item.required, item.have, item.deficit].join(',')
      );
    }
  }

  return lines.join('\n');
}

export { ACTIVITIES };
