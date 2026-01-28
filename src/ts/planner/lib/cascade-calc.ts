/**
 * Cascade Calculator
 *
 * Applies inventory to an expanded codex tree, propagating satisfaction down.
 * 
 * Each node gets:
 * - satisfied: true if this item's global need is fully met
 * - scale: fraction of requirement still needed (0 if satisfied)
 * 
 * Children inherit satisfaction from parents - if a parent item is complete,
 * we don't need to gather its ingredients.
 */

import { createKey } from './inventory-matcher.js';
import type {
    ExpandedCodex,
    ExpandedNode,
    ProcessedCodex,
    ProcessedNode,
    NodeStatus,
    InventoryLookup,
    MappingType,
    TrackableItem,
    FirstTrackableItem,
    SecondLevelItem
} from '../../types.js';

const STUDY_JOURNAL_PATTERN = /Study Journal$/;

interface AggregatedItem {
    name: string;
    tier: number;
    required: number;
    have: number;
    deficit: number;
    satisfied: boolean;
    scale: number;
    trackable: boolean;
    mappingType: MappingType;
}

interface FirstTrackableInternal {
    name: string;
    tier: number;
    required: number;
    have: number;
    mappingType: MappingType;
    sources: Set<string>;
}

export function applyCascade(
    expandedCodex: ExpandedCodex,
    inventoryLookup: InventoryLookup
): ProcessedCodex {
    // Pass 1: Aggregate requirements and inventory across all nodes
    const items = new Map<string, AggregatedItem>();
    for (const research of expandedCodex.researches) {
        aggregateNode(research, items, inventoryLookup);
    }

    // Compute satisfaction and scale
    for (const item of items.values()) {
        item.deficit = Math.max(0, item.required - item.have);
        item.satisfied = item.deficit === 0;
        item.scale = item.required > 0 ? item.deficit / item.required : 0;
    }

    // Pass 2: Build processed tree with satisfaction propagation
    const fullResearches = expandedCodex.researches.map(r => 
        buildNode(r, items, false, 1.0)
    );

    // Pass 3: Extract Study Journals into separate aggregated node
    const { researches, studyJournals } = extractStudyJournals(fullResearches);

    return {
        name: expandedCodex.name,
        tier: expandedCodex.tier,
        targetCount: expandedCodex.targetCount,
        researches,
        studyJournals
    };
}

function aggregateNode(
    node: ExpandedNode,
    items: Map<string, AggregatedItem>,
    inventoryLookup: InventoryLookup
): void {
    const key = createKey(node.name, node.tier);

    if (!items.has(key)) {
        const qty = inventoryLookup.get(key) ?? 0;
        items.set(key, {
            name: node.name,
            tier: node.tier,
            required: 0,
            have: qty,
            deficit: 0,
            satisfied: false,
            scale: 0,
            trackable: node.trackable,
            mappingType: node.mappingType
        });
    }

    items.get(key)!.required += node.idealQty;

    for (const child of node.children) {
        aggregateNode(child, items, inventoryLookup);
    }
}

function buildNode(
    node: ExpandedNode,
    items: Map<string, AggregatedItem>,
    parentSatisfied: boolean,
    parentScale: number
): ProcessedNode {
    const key = createKey(node.name, node.tier);
    const item = items.get(key)!;

    const satisfied = parentSatisfied || item.satisfied;
    const required = Math.ceil(node.idealQty * parentScale);
    const deficit = satisfied ? 0 : Math.ceil(required * item.scale);
    const contribution = required - deficit;
    const pctComplete = required > 0 ? Math.round((contribution / required) * 100) : 100;

    const status: NodeStatus = satisfied ? 'complete'
        : contribution > 0 ? 'partial'
        : 'missing';

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
        children: node.children.map(c => buildNode(c, items, satisfied, childScale))
    };
}

interface ExtractResult {
    researches: ProcessedNode[];
    studyJournals: ProcessedNode | null;
}

function extractStudyJournals(researches: ProcessedNode[]): ExtractResult {
    const extracted: ProcessedNode[] = [];
    const pruned: ProcessedNode[] = [];

    for (const research of researches) {
        const journalChild = research.children.find(c => STUDY_JOURNAL_PATTERN.test(c.name));
        const otherChildren = research.children.filter(c => !STUDY_JOURNAL_PATTERN.test(c.name));

        if (journalChild) {
            extracted.push(journalChild);
        }

        pruned.push({ ...research, children: otherChildren });
    }

    if (extracted.length === 0) {
        return { researches, studyJournals: null };
    }

    const multiplier = extracted.length;
    const aggregated = aggregateJournalNode(extracted[0], multiplier);
    aggregated.status = computeOverallStatus(aggregated);

    return { researches: pruned, studyJournals: aggregated };
}

function aggregateJournalNode(node: ProcessedNode, multiplier: number): ProcessedNode {
    const required = node.required * multiplier;
    const contribution = node.contribution * multiplier;
    
    return {
        ...node,
        required,
        deficit: node.deficit * multiplier,
        contribution,
        pctComplete: required > 0 ? Math.round((contribution / required) * 100) : 100,
        children: node.children.map(c => aggregateJournalNode(c, multiplier))
    };
}

function computeOverallStatus(node: ProcessedNode): NodeStatus {
    if (node.status === 'missing') return 'missing';
    if (node.status === 'partial') return 'partial';

    for (const child of node.children) {
        const childStatus = computeOverallStatus(child);
        if (childStatus !== 'complete') return 'partial';
    }

    return node.status;
}

// =============================================================================
// COLLECTION FUNCTIONS
// =============================================================================

export function collectTrackableItems(processedCodex: ProcessedCodex): TrackableItem[] {
    const items = new Map<string, {
        name: string;
        tier: number;
        required: number;
        have: number;
        mappingType: MappingType;
    }>();

    function collect(node: ProcessedNode): void {
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
            items.get(key)!.required += node.required;
        }
        for (const child of node.children) collect(child);
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

export function collectFirstTrackable(processedCodex: ProcessedCodex): FirstTrackableItem[] {
    const items = new Map<string, FirstTrackableInternal>();

    function findFirst(node: ProcessedNode, source: string): void {
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
            items.get(key)!.required += node.required;
            items.get(key)!.sources.add(source);
            return;
        }
        for (const child of node.children) findFirst(child, source);
    }

    for (const research of processedCodex.researches) {
        for (const child of research.children) {
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

export function collectSecondLevel(processedCodex: ProcessedCodex): SecondLevelItem[] {
    const items = new Map<string, {
        name: string;
        tier: number;
        required: number;
        have: number;
        trackable: boolean;
        mappingType: MappingType;
    }>();

    for (const research of processedCodex.researches) {
        for (const child of research.children) {
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
            items.get(key)!.required += child.required;
        }
    }

    return Array.from(items.values())
        .map(item => ({ ...item, deficit: Math.max(0, item.required - item.have) }))
        .sort((a, b) => b.deficit - a.deficit);
}