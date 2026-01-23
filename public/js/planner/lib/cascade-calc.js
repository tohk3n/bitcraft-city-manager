import { getItemQuantity, createKey } from './inventory-matcher.js';

/**
 * Apply cascade calculation to an expanded recipe tree.
 * Processes nodes, calculating actual requirements after inventory is applied.
 *
 * @param {Object} expandedCodex - Result from expandRecipes
 * @param {Map<string, number>} inventoryLookup - From buildInventoryLookup
 * @param {Object} mappings - Item mappings for inventory lookup
 * @returns {Object} Processed codex with required/have/deficit on each node
 */
export function applyCascade(expandedCodex, inventoryLookup, mappings = null) {
    return {
        name: expandedCodex.name,
        tier: expandedCodex.tier,
        targetCount: expandedCodex.targetCount,
        researches: expandedCodex.researches.map(research =>
        processNodeCascade(research, inventoryLookup, mappings, expandedCodex.targetCount)
        )
    };
}

/**
 * Process a single node with cascade logic.
 *
 * The codex qty values represent totals needed for one codex completion.
 * Inventory at parent levels reduces child requirements proportionally.
 *
 * @param {Object} node - Expanded node with idealQty
 * @param {Map} inventoryLookup - Inventory lookup
 * @param {Object} mappings - Item mappings
 * @param {number} batchCount - Effective number of batches needed at this level
 * @returns {Object} Processed node with all calculations
 */
function processNodeCascade(node, inventoryLookup, mappings, batchCount) {
    // Required = qty for one batch × number of batches
    const required = Math.ceil(node.recipeQty * batchCount);

    // Get inventory quantity (0 if non-trackable)
    const { qty: have } = getItemQuantity(
        inventoryLookup,
        node.name,
        node.tier,
        mappings
    );

    // Calculate deficit and contribution
    const deficit = Math.max(0, required - have);
    const contribution = Math.min(have, required);

    // Calculate percentage complete for this node
    const pctComplete = required > 0 ? Math.round((contribution / required) * 100) : 100;

    // Determine status
    let status;
    if (deficit === 0) {
        status = 'complete';
    } else if (have > 0) {
        status = 'partial';
    } else {
        status = 'missing';
    }

    // Children's batch count is proportional to how much we still need to produce
    // If we have inventory covering some requirement, children produce less
    // effectiveBatches = deficit / recipeQty = (batches we need to craft ourselves)
    const effectiveBatches = node.recipeQty > 0
    ? (deficit / node.recipeQty)
    : batchCount;

    // Process children with effective batch count
    const children = (node.children || []).map(child =>
    processNodeCascade(child, inventoryLookup, mappings, effectiveBatches)
    );

    return {
        name: node.name,
        tier: node.tier,
        recipeQty: node.recipeQty,
        idealQty: node.idealQty,
        required,
        have,
        deficit,
        contribution,
        pctComplete,
        status,
        trackable: node.trackable,
        mappingType: node.mappingType,
        children
    };
}

/**
 * Collect all trackable items from a processed tree.
 * Aggregates by item key, summing required/have/deficit.
 *
 * @param {Object} processedCodex - Result from applyCascade
 * @returns {Array} Array of aggregated trackable items
 */
export function collectTrackableItems(processedCodex) {
    const items = new Map();

    function collect(node) {
        if (node.trackable && node.required > 0) {
            const key = createKey(node.name, node.tier);

            if (!items.has(key)) {
                items.set(key, {
                    name: node.name,
                    tier: node.tier,
                    required: 0,
                    have: node.have, // Same across all occurrences
                    deficit: 0,
                    contribution: 0,
                    mappingType: node.mappingType
                });
            }

            const item = items.get(key);
            item.required += node.required;
            item.deficit += node.deficit;
            item.contribution += node.contribution;
        }

        for (const child of node.children || []) {
            collect(child);
        }
    }

    for (const research of processedCodex.researches) {
        collect(research);
    }

    // Calculate percentage and cap contribution at required
    const result = Array.from(items.values()).map(item => ({
        ...item,
        contribution: Math.min(item.contribution, item.required),
                                                           pctComplete: item.required > 0
                                                           ? Math.round((Math.min(item.have, item.required) / item.required) * 100)
                                                           : 100
    }));

    return result.sort((a, b) => b.deficit - a.deficit);
}

/**
 * Collect first trackable items from each branch of processed tree.
 * These represent the immediate next crafting step.
 *
 * @param {Object} processedCodex - Result from applyCascade
 * @returns {Array} Array of first trackable items with their requirements
 */
export function collectFirstTrackable(processedCodex) {
    const items = new Map();

    function findFirst(node, researchName) {
        if (node.trackable) {
            // Found first trackable - aggregate and don't go deeper
            const key = createKey(node.name, node.tier);

            if (!items.has(key)) {
                items.set(key, {
                    name: node.name,
                    tier: node.tier,
                    required: 0,
                    have: node.have,
                    deficit: 0,
                    contribution: 0,
                    mappingType: node.mappingType,
                    sources: new Set()
                });
            }

            const item = items.get(key);
            item.required += node.required;
            item.deficit += node.deficit;
            item.contribution += node.contribution;
            item.sources.add(researchName);

            return; // Don't go deeper - this is "first trackable"
        }

        // Non-trackable - continue to children
        for (const child of node.children || []) {
            findFirst(child, researchName);
        }
    }

    for (const research of processedCodex.researches) {
        for (const child of research.children || []) {
            findFirst(child, research.name);
        }
    }

    // Convert Sets to arrays, calculate pctComplete
    const result = Array.from(items.values()).map(item => ({
        ...item,
        sources: Array.from(item.sources),
                                                           pctComplete: item.required > 0
                                                           ? Math.round((Math.min(item.have, item.required) / item.required) * 100)
                                                           : 100
    }));

    return result.sort((a, b) => b.deficit - a.deficit);
}

/**
 * Get second-level items (direct children of researches).
 * These are the high-level goals like "Refined Fine Brick".
 *
 * @param {Object} processedCodex - Result from applyCascade
 * @returns {Array} Array of second-level items
 */
export function collectSecondLevel(processedCodex) {
    const items = new Map();

    for (const research of processedCodex.researches) {
        for (const child of research.children || []) {
            const key = createKey(child.name, child.tier);

            if (!items.has(key)) {
                items.set(key, {
                    name: child.name,
                    tier: child.tier,
                    required: 0,
                    have: child.have,
                    deficit: 0,
                    trackable: child.trackable,
                    mappingType: child.mappingType
                });
            }

            const item = items.get(key);
            item.required += child.required;
            item.deficit += child.deficit;
        }
    }

    return Array.from(items.values()).sort((a, b) => b.deficit - a.deficit);
}
