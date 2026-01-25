/**
 * Cascade Calculator
 *
 * Each node has:
 * - satisfied: boolean, true if this item's global need is fully met
 * - scale: 0-1, what fraction of this node's requirement is still needed
 *
 * If satisfied, scale = 0 and children inherit satisfied = true.
 * If not satisfied, scale = globalDeficit / globalRequired, children use this scale.
 */

import { getItemQuantity, createKey } from './inventory-matcher.js';

export function applyCascade(expandedCodex, inventoryLookup, mappings = null) {
    // Pass 1: Aggregate and compute satisfaction
    const items = new Map();
    for (const research of expandedCodex.researches) {
        aggregateNode(research, items, inventoryLookup, mappings);
    }

    // Compute satisfaction and scale for each item
    for (const item of items.values()) {
        item.deficit = Math.max(0, item.required - item.have);
        item.satisfied = item.deficit === 0;
        item.scale = item.required > 0 ? item.deficit / item.required : 0;
    }

    // Pass 2: Build tree
    return {
        name: expandedCodex.name,
        tier: expandedCodex.tier,
        targetCount: expandedCodex.targetCount,
        researches: expandedCodex.researches.map(r => buildNode(r, items, false, 1.0))
    };
}

function aggregateNode(node, items, inventoryLookup, mappings) {
    const key = createKey(node.name, node.tier);

    if (!items.has(key)) {
        const { qty } = getItemQuantity(inventoryLookup, node.name, node.tier, mappings);
        items.set(key, {
            name: node.name,
            tier: node.tier,
            required: 0,
            have: qty,
            trackable: node.trackable,
            mappingType: node.mappingType
        });
    }

    items.get(key).required += node.idealQty;

    for (const child of node.children || []) {
        aggregateNode(child, items, inventoryLookup, mappings);
    }
}

function buildNode(node, items, parentSatisfied, parentScale) {
    const key = createKey(node.name, node.tier);
    const item = items.get(key);

    // If parent is satisfied, we're satisfied too (don't need to gather)
    const satisfied = parentSatisfied || item.satisfied;

    // Effective requirement after parent's scale
    const required = Math.ceil(node.idealQty * parentScale);

    // Our deficit: if satisfied, 0. Otherwise, apply our scale to required.
    const deficit = satisfied ? 0 : Math.ceil(required * item.scale);
    const contribution = required - deficit;
    const pctComplete = required > 0 ? Math.round((contribution / required) * 100) : 100;

    const status = satisfied ? 'complete'
    : contribution > 0 ? 'partial'
    : 'missing';

    // Children's scale: if we're satisfied, 0. Otherwise, our scale.
    const childScale = satisfied ? 0 : item.scale * parentScale;

    return {
        name: node.name,
        tier: node.tier,
        recipeQty: node.recipeQty,
        idealQty: node.idealQty,
        required,
        have: item.have,
        deficit,
        contribution,
        pctComplete,
        status,
        satisfied,
        satisfiedByParent: parentSatisfied,
        trackable: node.trackable,
        mappingType: node.mappingType,
        children: (node.children || []).map(c => buildNode(c, items, satisfied, childScale))
    };
}

// --- Collection functions ---

export function collectTrackableItems(processedCodex) {
    const items = new Map();

    function collect(node) {
        if (node.trackable && node.required > 0 && !node.satisfiedByParent) {
            const key = createKey(node.name, node.tier);
            if (!items.has(key)) {
                items.set(key, {
                    name: node.name,
                    tier: node.tier,
                    required: 0,
                    have: node.have,
                    mappingType: node.mappingType
                });
            }
            items.get(key).required += node.required;
        }
        for (const child of node.children || []) collect(child);
    }

    for (const research of processedCodex.researches) collect(research);

    return Array.from(items.values())
    .map(item => ({
        ...item,
        deficit: Math.max(0, item.required - item.have),
                  pctComplete: item.required > 0
                  ? Math.round((Math.min(item.have, item.required) / item.required) * 100)
                  : 100
    }))
    .sort((a, b) => b.deficit - a.deficit);
}

export function collectFirstTrackable(processedCodex) {
    const items = new Map();

    function findFirst(node, source) {
        if (node.satisfiedByParent) return;

        if (node.trackable) {
            const key = createKey(node.name, node.tier);
            if (!items.has(key)) {
                items.set(key, {
                    name: node.name,
                    tier: node.tier,
                    required: 0,
                    have: node.have,
                    mappingType: node.mappingType,
                    sources: new Set()
                });
            }
            items.get(key).required += node.required;
            items.get(key).sources.add(source);
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
                  deficit: Math.max(0, item.required - item.have),
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
            if (child.satisfiedByParent) continue;

            const key = createKey(child.name, child.tier);
            if (!items.has(key)) {
                items.set(key, {
                    name: child.name,
                    tier: child.tier,
                    required: 0,
                    have: child.have,
                    trackable: child.trackable,
                    mappingType: child.mappingType
                });
            }
            items.get(key).required += child.required;
        }
    }

    return Array.from(items.values())
    .map(item => ({
        ...item,
        deficit: Math.max(0, item.required - item.have)
    }))
    .sort((a, b) => b.deficit - a.deficit);
}
