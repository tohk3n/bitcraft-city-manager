/**
 * Recipe Expander
 *
 * Expands codex recipe trees to calculate ideal quantities.
 * Pure function - no inventory awareness, no side effects.
 *
 * Phase 1 of the cascade algorithm: determine what's needed
 * assuming we start from zero inventory.
 */

import { isTrackable, getMappingType } from './inventory-matcher.js';
import type {
    Codex,
    CodexNode,
    ExpandedCodex,
    ExpandedNode,
    ItemMappingsFile,
    MappingType,
    FlattenedItem,
    AggregatedItem,
    FirstTrackableResult
} from '../../types.js';

interface AggregatedItemInternal {
    name: string;
    tier: number;
    idealQty: number;
    trackable: boolean;
    mappingType: MappingType;
    sources: Set<string>;
}

/**
 * Expand a codex to calculate ideal quantities for each item.
 * Creates a deep clone with idealQty calculated on each node.
 */
export function expandRecipes(
    codex: Codex,
    targetCount: number,
    mappings: ItemMappingsFile | null = null
): ExpandedCodex {
    return {
        name: codex.name,
        tier: codex.tier,
        targetCount,
        researches: codex.researches.map(research =>
        expandNode(research, targetCount, mappings)
        )
    };
}

/**
 * Expand a single node and its children recursively.
 * Calculates idealQty based on recipeQty and batch count.
 */
function expandNode(
    node: CodexNode,
    batchCount: number,
    mappings: ItemMappingsFile | null
): ExpandedNode {
    const recipeQty = node.qty || 1;
    // idealQty is simply the qty needed for N completions
    const idealQty = recipeQty * batchCount;

    const trackable = isTrackable(node.name, mappings);
    const mappingType = getMappingType(node.name, mappings);

    return {
        name: node.name,
        tier: node.tier,
        recipeQty,
        idealQty,
        trackable,
        mappingType,
        // Children also get the batch count, not the accumulated qty
        children: (node.children || []).map(child =>
        expandNode(child, batchCount, mappings)
        )
    };
}

/**
 * Get a flat list of all items from an expanded tree.
 * Useful for debugging or alternate calculations.
 */
export function flattenExpanded(expandedCodex: ExpandedCodex): FlattenedItem[] {
    const items: FlattenedItem[] = [];

    function collect(node: ExpandedNode, researchName: string): void {
        items.push({
            name: node.name,
            tier: node.tier,
            idealQty: node.idealQty,
            trackable: node.trackable,
            mappingType: node.mappingType,
            research: researchName
        });

        for (const child of node.children || []) {
            collect(child, researchName);
        }
    }

    for (const research of expandedCodex.researches) {
        collect(research, research.name);
    }

    return items;
}

interface AggregateOptions {
    trackableOnly?: boolean;
}

/**
 * Aggregate expanded items by key (name:tier).
 * Sums idealQty for items appearing in multiple branches.
 */
export function aggregateExpanded(
    expandedCodex: ExpandedCodex,
    options: AggregateOptions = {}
): Map<string, AggregatedItem> {
    const { trackableOnly = false } = options;
    const aggregated = new Map<string, AggregatedItemInternal>();

    function collect(node: ExpandedNode, sources: Set<string>): void {
        if (trackableOnly && !node.trackable) {
            // Skip non-trackable, but still process children
            for (const child of node.children || []) {
                collect(child, sources);
            }
            return;
        }

        const key = `${node.name}:${node.tier}`;

        if (!aggregated.has(key)) {
            aggregated.set(key, {
                name: node.name,
                tier: node.tier,
                idealQty: 0,
                trackable: node.trackable,
                mappingType: node.mappingType,
                sources: new Set()
            });
        }

        const item = aggregated.get(key)!;
        item.idealQty += node.idealQty;
        sources.forEach(s => item.sources.add(s));

        for (const child of node.children || []) {
            collect(child, sources);
        }
    }

    for (const research of expandedCodex.researches) {
        collect(research, new Set([research.name]));
    }

    // Convert source Sets to arrays for JSON serialization
    const result = new Map<string, AggregatedItem>();
    for (const [key, item] of aggregated) {
        result.set(key, {
            ...item,
            sources: Array.from(item.sources)
        });
    }

    return result;
}

/**
 * Find the first trackable items in each branch.
 * These are the items that actually exist in inventory at the highest level.
 */
export function findFirstTrackable(expandedCodex: ExpandedCodex): FirstTrackableResult[] {
    const results: FirstTrackableResult[] = [];

    function findInBranch(
        node: ExpandedNode,
        parentName: string | null = null
    ): FirstTrackableResult | FirstTrackableResult[] | null {
        if (node.trackable) {
            // Found first trackable - don't go deeper
            return {
                name: node.name,
                tier: node.tier,
                idealQty: node.idealQty,
                mappingType: node.mappingType,
                parent: parentName
            };
        }

        // Not trackable - check children
        const found: FirstTrackableResult[] = [];
        for (const child of node.children || []) {
            const result = findInBranch(child, node.name);
            if (result) {
                if (Array.isArray(result)) {
                    found.push(...result);
                } else {
                    found.push(result);
                }
            }
        }

        return found.length > 0 ? found : null;
    }

    for (const research of expandedCodex.researches) {
        // Research itself is not trackable, find first trackable in its children
        for (const child of research.children || []) {
            const found = findInBranch(child, research.name);
            if (found) {
                if (Array.isArray(found)) {
                    results.push(...found);
                } else {
                    results.push(found);
                }
            }
        }
    }

    return results;
}
