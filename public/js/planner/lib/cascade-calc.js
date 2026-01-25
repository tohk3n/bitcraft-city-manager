import { getItemQuantity, createKey } from './inventory-matcher.js';

/**
 * Cascade Calculator
 *
 * Algorithm:
 * 1. Aggregate total needed for each item (to know total inventory demand)
 * 2. Cascade top-down: compute each node's deficit based on cascaded requirement
 * 3. Track inventory consumption to prevent double-counting across branches
 */

export function applyCascade(expandedCodex, inventoryLookup, mappings = null) {
    // Track inventory consumption across branches
    const consumed = new Map();

    return {
        name: expandedCodex.name,
        tier: expandedCodex.tier,
        targetCount: expandedCodex.targetCount,
        researches: expandedCodex.researches.map(r =>
        cascadeNode(r, inventoryLookup, mappings, consumed, 1.0)
        )
    };
}

/**
 * Process a node, computing deficit based on cascaded requirement.
 *
 * @param parentScale - What fraction of this node's idealQty is actually needed
 */
function cascadeNode(node, inventoryLookup, mappings, consumed, parentScale) {
    const key = createKey(node.name, node.tier);

    // This node's actual requirement after cascade
    const required = Math.ceil(node.idealQty * parentScale);

    // Get inventory and track consumption
    const { qty: totalHave } = getItemQuantity(inventoryLookup, node.name, node.tier, mappings);
    const alreadyConsumed = consumed.get(key) || 0;
    const available = Math.max(0, totalHave - alreadyConsumed);

    // Deficit based on what's actually needed vs what's available
    const contribution = Math.min(available, required);
    const deficit = required - contribution;

    // Mark inventory as consumed
    consumed.set(key, alreadyConsumed + contribution);

    // Stats
    const pctComplete = required > 0 ? Math.round((contribution / required) * 100) : 100;
    const status = deficit === 0 ? 'complete'
    : contribution > 0 ? 'partial'
    : 'missing';

    // Children scale by our deficit ratio
    const childScale = required > 0 ? deficit / required : 0;

    return {
        name: node.name,
        tier: node.tier,
        recipeQty: node.recipeQty,
        idealQty: node.idealQty,
        required,
        have: totalHave,
        deficit,
        contribution,
        pctComplete,
        status,
        trackable: node.trackable,
        mappingType: node.mappingType,
        children: (node.children || []).map(c =>
        cascadeNode(c, inventoryLookup, mappings, consumed, childScale)
        )
    };
}

// --- Collection functions ---

export function collectTrackableItems(processedCodex) {
    const items = new Map();

    function collect(node) {
        if (node.trackable && node.required > 0) {
            const key = createKey(node.name, node.tier);
            if (!items.has(key)) {
                items.set(key, {
                    name: node.name, tier: node.tier,
                    required: 0, have: node.have, deficit: 0, contribution: 0,
                    mappingType: node.mappingType
                });
            }
            const item = items.get(key);
            item.required += node.required;
            item.deficit += node.deficit;
            item.contribution += node.contribution;
        }
        for (const child of node.children || []) collect(child);
    }

    for (const research of processedCodex.researches) collect(research);

    return Array.from(items.values())
    .map(item => ({
        ...item,
        contribution: Math.min(item.contribution, item.required),
                  pctComplete: item.required > 0
                  ? Math.round((Math.min(item.have, item.required) / item.required) * 100)
                  : 100
    }))
    .sort((a, b) => b.deficit - a.deficit);
}

export function collectFirstTrackable(processedCodex) {
    const items = new Map();

    function findFirst(node, source) {
        if (node.trackable) {
            const key = createKey(node.name, node.tier);
            if (!items.has(key)) {
                items.set(key, {
                    name: node.name, tier: node.tier,
                    required: 0, have: node.have, deficit: 0, contribution: 0,
                    mappingType: node.mappingType, sources: new Set()
                });
            }
            const item = items.get(key);
            item.required += node.required;
            item.deficit += node.deficit;
            item.contribution += node.contribution;
            item.sources.add(source);
            return;
        }
        for (const child of node.children || []) findFirst(child, source);
    }

    for (const research of processedCodex.researches) {
        for (const child of research.children || []) {
            findFirst(child, research.name);
        }
    }

    return Array.from(items.values())
    .map(item => ({
        ...item,
        sources: Array.from(item.sources),
                  pctComplete: item.required > 0
                  ? Math.round((Math.min(item.have, item.required) / item.required) * 100)
                  : 100
    }))
    .sort((a, b) => b.deficit - a.deficit);
}

export function collectSecondLevel(processedCodex) {
    const items = new Map();

    for (const research of processedCodex.researches) {
        for (const child of research.children || []) {
            const key = createKey(child.name, child.tier);
            if (!items.has(key)) {
                items.set(key, {
                    name: child.name, tier: child.tier,
                    required: 0, have: child.have, deficit: 0,
                    trackable: child.trackable, mappingType: child.mappingType
                });
            }
            const item = items.get(key);
            item.required += child.required;
            item.deficit += child.deficit;
        }
    }

    return Array.from(items.values()).sort((a, b) => b.deficit - a.deficit);
}
