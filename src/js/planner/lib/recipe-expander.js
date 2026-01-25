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

/**
 * Expand a codex to calculate ideal quantities for each item.
 * Creates a deep clone with idealQty calculated on each node.
 *
 * @param {Object} codex - Codex data with researches array
 * @param {number} targetCount - Number of codex completions needed
 * @param {Object} mappings - Item mappings for trackable status
 * @returns {Object} Expanded codex with idealQty on each node
 */
export function expandRecipes(codex, targetCount, mappings = null) {
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
 *
 * @param {Object} node - Recipe node from codex
 * @param {number} batchCount - Number of codex completions needed
 * @param {Object} mappings - Item mappings
 * @returns {Object} Expanded node with idealQty and processed children
 */
function expandNode(node, batchCount, mappings) {
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
 *
 * @param {Object} expandedCodex - Result from expandRecipes
 * @returns {Array} Flat array of all nodes with their idealQty
 */
export function flattenExpanded(expandedCodex) {
    const items = [];

    function collect(node, researchName) {
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

/**
 * Aggregate expanded items by key (name:tier).
 * Sums idealQty for items appearing in multiple branches.
 *
 * @param {Object} expandedCodex - Result from expandRecipes
 * @param {Object} options - { trackableOnly: boolean }
 * @returns {Map<string, Object>} Map of itemKey -> aggregated item data
 */
export function aggregateExpanded(expandedCodex, options = {}) {
    const { trackableOnly = false } = options;
    const aggregated = new Map();

    function collect(node, sources) {
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

        const item = aggregated.get(key);
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
    for (const item of aggregated.values()) {
        item.sources = Array.from(item.sources);
    }

    return aggregated;
}

/**
 * Find the first trackable items in each branch.
 * These are the items that actually exist in inventory at the highest level.
 *
 * @param {Object} expandedCodex - Result from expandRecipes
 * @returns {Array} Array of first trackable items with their parent context
 */
export function findFirstTrackable(expandedCodex) {
    const results = [];

    function findInBranch(node, parentName = null) {
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
        const found = [];
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
