// Planner - Codex requirement calculator
import { API } from './api.js';
import { CONFIG } from './config.js';

// Tier upgrade requirements: target tier -> { codexTier, count }
const TIER_REQUIREMENTS = {
    3:  { codexTier: 2, count: 10 },
    4:  { codexTier: 3, count: 15 },
    5:  { codexTier: 4, count: 20 },
    6:  { codexTier: 5, count: 25 },
    7:  { codexTier: 6, count: 30 },
    8:  { codexTier: 7, count: 35 },
    9:  { codexTier: 8, count: 40 },
    10: { codexTier: 9, count: 45 }
};

// Package multipliers
const PACKAGE_MULTIPLIERS = {
    default: 100,
        flower: 500,
        fiber: 1000
};

// Caches
const codexCache = {};
let mappingsCache = null;

// Load item mappings (lazy-loaded, cached)
async function loadMappings() {
    if (mappingsCache) {
        return mappingsCache;
    }

    const response = await fetch('/data/item-mappings.json');
    if (!response.ok) {
        console.warn('Failed to load item mappings, continuing without');
        mappingsCache = { mappings: {} };
        return mappingsCache;
    }

    mappingsCache = await response.json();
    return mappingsCache;
}

// Normalize item name for matching
function normalizeName(name) {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Determine package multiplier based on item name/tag
function getPackageMultiplier(name, tag) {
    const lowerName = normalizeName(name);
    const lowerTag = (tag || '').toLowerCase();

    if (lowerName.includes('flower') || lowerTag.includes('flower')) {
        return PACKAGE_MULTIPLIERS.flower;
    }
    if (lowerName.includes('fiber') || lowerTag.includes('fiber')) {
        return PACKAGE_MULTIPLIERS.fiber;
    }
    return PACKAGE_MULTIPLIERS.default;
}

// Load codex JSON for a tier (lazy-loaded, cached)
async function loadCodex(tier) {
    if (codexCache[tier]) {
        return codexCache[tier];
    }

    const response = await fetch(`/data/codex/t${tier}-codex.json`);
    if (!response.ok) {
        throw new Error(`Failed to load codex for tier ${tier}`);
    }

    const codex = await response.json();
    codexCache[tier] = codex;
    return codex;
}

// Build inventory lookup from API data
// Returns: Map<normalizedName:tier, quantity>
function buildInventoryLookup(buildings, itemMeta, cargoMeta) {
    const lookup = new Map();

    for (const building of buildings) {
        for (const slot of building.inventory || []) {
            const contents = slot.contents;
            if (!contents) continue;

            const id = contents.item_id;
            const qty = contents.quantity;
            const isItem = contents.item_type === 'item';

            const meta = isItem ? itemMeta[id] : cargoMeta[id];
            if (!meta) continue;

            const name = meta.name;
            const tier = meta.tier || 0;
            const tag = meta.tag || '';

            // Check if this is a package
            const isPackage = tag.toLowerCase().includes('package') ||
            name.toLowerCase().includes('package');

            let effectiveQty = qty;
            let effectiveName = name;

            if (isPackage) {
                // Extract base item name (remove "Package of" prefix, etc.)
                effectiveName = name
                .replace(/package\s+of\s+/i, '')
                .replace(/\s+package$/i, '')
                .trim();
                effectiveQty = qty * getPackageMultiplier(name, tag);
            }

            const key = `${normalizeName(effectiveName)}:${tier}`;
            lookup.set(key, (lookup.get(key) || 0) + effectiveQty);
        }
    }

    return lookup;
}

// Get quantity from inventory for a codex item
// Returns: { qty, mapping } where mapping contains type info if applicable
function getInventoryQty(lookup, mappings, name, tier) {
    const mapping = mappings.mappings?.[name];

    // Non-trackable items always return 0
    if (mapping && !mapping.trackable) {
        return { qty: 0, mapping };
    }

    // Check for API equivalent name
    const searchName = mapping?.apiEquivalent || name;

    // Try exact tier match first
    const key = `${normalizeName(searchName)}:${tier}`;
    if (lookup.has(key)) {
        return { qty: lookup.get(key), mapping };
    }

    // Try tier -1 (tierless items like Water Bucket, Pitch)
    const keyNeg = `${normalizeName(searchName)}:-1`;
    if (lookup.has(keyNeg)) {
        return { qty: lookup.get(keyNeg), mapping };
    }

    // Try tier 0
    const key0 = `${normalizeName(searchName)}:0`;
    if (lookup.has(key0)) {
        return { qty: lookup.get(key0), mapping };
    }

    return { qty: 0, mapping };
}

// Process a single codex tree node, computing requirements vs inventory
// multiplier: accumulated quantity multiplier from parent nodes
function processNode(node, lookup, mappings, multiplier = 1) {
    const required = node.qty * multiplier;
    const { qty: have, mapping } = getInventoryQty(lookup, mappings, node.name, node.tier);
    const deficit = Math.max(0, required - have);

    // Determine status
    let status;
    if (have >= required) {
        status = 'complete';
    } else if (have > 0) {
        status = 'partial';
    } else {
        status = 'missing';
    }

    // Process children with updated multiplier
    // Children's multiplier = this node's required qty (not what we have)
    const children = (node.children || []).map(child =>
    processNode(child, lookup, mappings, required)
    );

    // Aggregate child deficits for summary
    const childDeficit = children.reduce((sum, c) => sum + c.totalDeficit, 0);

    return {
        name: node.name,
        tier: node.tier,
        required,
        have,
        deficit,
        status,
        children,
        totalDeficit: deficit + childDeficit,
        // Include mapping info for UI hints
        mappingType: mapping?.type || null,
        trackable: mapping?.trackable !== false
    };
}

// Main calculation: compute full requirement tree for a tier upgrade
export async function calculateRequirements(claimId, targetTier) {
    const req = TIER_REQUIREMENTS[targetTier];
    if (!req) {
        throw new Error(`Invalid target tier: ${targetTier}`);
    }

    // Load codex, mappings, and inventory in parallel
    const [codex, mappings, inventoryData] = await Promise.all([
        loadCodex(req.codexTier),
                                                               loadMappings(),
                                                               API.getClaimInventories(claimId)
    ]);

    // Build lookup tables
    const itemMeta = {};
    for (const item of inventoryData.items || []) {
        itemMeta[item.id] = item;
    }
    const cargoMeta = {};
    for (const cargo of inventoryData.cargos || []) {
        cargoMeta[cargo.id] = cargo;
    }

    const lookup = buildInventoryLookup(
        inventoryData.buildings || [],
        itemMeta,
        cargoMeta
    );

    // Process each research branch
    const researches = codex.researches.map(research =>
    processNode(research, lookup, mappings, req.count)
    );

    // Compute summary by category
    const summary = computeSummary(researches);

    return {
        targetTier,
        codexTier: req.codexTier,
        codexCount: req.count,
        codexName: codex.name,
        researches,
        summary,
        inventoryLookup: lookup // expose for debugging
    };
}

// Compute deficit summary grouped by material category
function computeSummary(researches) {
    const totals = {};

    function walkTree(node) {
        if (node.deficit > 0) {
            // Categorize by tier and name patterns
            const category = categorizeItem(node.name, node.tier);
            if (!totals[category]) {
                totals[category] = { items: {}, total: 0 };
            }

            const key = `${node.name} (T${node.tier})`;
            if (!totals[category].items[key]) {
                totals[category].items[key] = 0;
            }
            totals[category].items[key] += node.deficit;
            totals[category].total += node.deficit;
        }

        for (const child of node.children || []) {
            walkTree(child);
        }
    }

    for (const research of researches) {
        walkTree(research);
    }

    return totals;
}

// Simple categorization based on item name patterns
function categorizeItem(name, tier) {
    const lower = name.toLowerCase();

    if (lower.includes('wood') || lower.includes('plank') || lower.includes('trunk') || lower.includes('bark') || lower.includes('log')) {
        return 'Wood';
    }
    if (lower.includes('ingot') || lower.includes('ore') || lower.includes('metal') || lower.includes('ferralith') || lower.includes('molten')) {
        return 'Metal';
    }
    if (lower.includes('brick') || lower.includes('stone') || lower.includes('pebble') || lower.includes('clay') || lower.includes('sand') || lower.includes('glass') || lower.includes('gypsite')) {
        return 'Stone';
    }
    if (lower.includes('cloth') || lower.includes('thread') || lower.includes('fiber') || lower.includes('filament') || lower.includes('textile')) {
        return 'Cloth';
    }
    if (lower.includes('leather') || lower.includes('pelt') || lower.includes('tannin') || lower.includes('hide')) {
        return 'Leather';
    }
    if (lower.includes('fish') || lower.includes('bait') || lower.includes('shell') || lower.includes('crawdad') || lower.includes('crayfish')) {
        return 'Fishing';
    }
    if (lower.includes('seed') || lower.includes('plant') || lower.includes('berry') || lower.includes('flower') || lower.includes('fertilizer') || lower.includes('grain') || lower.includes('crop')) {
        return 'Farming';
    }
    if (lower.includes('parchment') || lower.includes('journal') || lower.includes('ink') || lower.includes('pigment') || lower.includes('carving') || lower.includes('research')) {
        return 'Scholar';
    }

    return 'Other';
}

// Get tier requirements info
export function getTierRequirements() {
    return TIER_REQUIREMENTS;
}

// Export for testing
export { normalizeName, buildInventoryLookup, processNode };

// ============================================================================
// UI Rendering
// ============================================================================

// Render the tier selector controls
export function renderControls(container, currentTier, onTierChange) {
    const tiers = Object.keys(TIER_REQUIREMENTS).map(Number).sort((a, b) => a - b);

    container.innerHTML = `
    <div class="planner-controls">
    <div>
    <label for="target-tier">Target Tier:</label>
    <select id="target-tier">
    ${tiers.map(t => `
        <option value="${t}" ${t === currentTier ? 'selected' : ''}>
        T${t}
        </option>
        `).join('')}
        </select>
        </div>
        <div class="planner-requirement" id="planner-req-info">
        Select a target tier to see requirements
        </div>
        </div>
        `;

        const select = container.querySelector('#target-tier');
        select.addEventListener('change', () => {
            onTierChange(parseInt(select.value, 10));
        });

        updateRequirementInfo(currentTier);
}

function updateRequirementInfo(targetTier) {
    const info = document.getElementById('planner-req-info');
    if (!info) return;

    const req = TIER_REQUIREMENTS[targetTier];
    if (req) {
        info.innerHTML = `Requires: <strong>${req.count}× T${req.codexTier} Codex</strong>`;
    }
}

// Render the deficit summary cards
export function renderDeficitSummary(container, summary) {
    const categories = ['Wood', 'Metal', 'Stone', 'Cloth', 'Leather', 'Farming', 'Fishing', 'Scholar', 'Other'];

    container.innerHTML = categories.map(cat => {
        const data = summary[cat];
        const total = data ? data.total : 0;
        const isComplete = total === 0;

        return `
        <div class="deficit-card ${isComplete ? 'complete' : 'has-deficit'}">
        <div class="category">${cat}</div>
        <div class="value">${isComplete ? '✓' : total.toLocaleString()}</div>
        </div>
        `;
    }).join('');
}

// Render the full research tree
export function renderResearchTree(container, researches) {
    container.innerHTML = `
    <div class="tree-controls">
    <button id="expand-all">Expand All</button>
    <button id="collapse-all">Collapse All</button>
    </div>
    <div class="research-tree">
    ${researches.map(research => renderBranch(research)).join('')}
    </div>
    `;

    // Wire up expand/collapse buttons
    container.querySelector('#expand-all').addEventListener('click', () => {
        container.querySelectorAll('.research-branch, .tree-node').forEach(el => {
            el.classList.add('expanded');
        });
    });

    container.querySelector('#collapse-all').addEventListener('click', () => {
        container.querySelectorAll('.research-branch, .tree-node').forEach(el => {
            el.classList.remove('expanded');
        });
    });

    // Wire up branch toggles
    container.querySelectorAll('.branch-header').forEach(header => {
        header.addEventListener('click', () => {
            header.closest('.research-branch').classList.toggle('expanded');
        });
    });

    // Wire up node toggles
    container.querySelectorAll('.node-toggle:not(.empty)').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggle.closest('.tree-node').classList.toggle('expanded');
        });
    });
}

function renderBranch(research) {
    const statusClass = research.status;
    const hasDeficit = research.deficit > 0;

    return `
    <div class="research-branch ${hasDeficit ? '' : 'expanded'}">
    <div class="branch-header">
    <div class="branch-toggle">▶</div>
    <div class="branch-name">${research.name}</div>
    <div class="branch-status">
    <span class="branch-progress">
    ${research.have}/${research.required}
    </span>
    <div class="status-indicator ${statusClass}"></div>
    </div>
    </div>
    <div class="branch-body">
    ${renderNodeChildren(research.children)}
    </div>
    </div>
    `;
}

function renderNode(node, depth = 0) {
    const hasChildren = node.children && node.children.length > 0;
    const deficitClass = node.deficit > 0 ? 'positive' : 'zero';

    // Mapping type indicator for non-trackable items
    const typeIndicator = !node.trackable ? getMappingIndicator(node.mappingType) : '';

    return `
    <div class="tree-node ${node.status === 'complete' ? 'expanded' : ''} ${!node.trackable ? 'non-trackable' : ''}">
    <div class="node-content">
    <div class="node-toggle ${hasChildren ? '' : 'empty'}">
    ${hasChildren ? '▶' : ''}
    </div>
    <span class="node-name">${node.name}</span>
    ${node.tier > 0 ? `<span class="node-tier">T${node.tier}</span>` : ''}
    ${typeIndicator}
    <div class="node-quantities">
    <span class="node-have">${node.have.toLocaleString()}</span>
    <span class="node-required">/ ${node.required.toLocaleString()}</span>
    <span class="node-deficit ${deficitClass}">
    ${node.deficit > 0 ? `-${node.deficit.toLocaleString()}` : '✓'}
    </span>
    </div>
    <div class="node-status ${node.status}"></div>
    </div>
    ${hasChildren ? `
        <div class="node-children">
        ${renderNodeChildren(node.children)}
        </div>
        ` : ''}
        </div>
        `;
}

// Get visual indicator for mapping type
function getMappingIndicator(type) {
    const indicators = {
        gathered: '<span class="mapping-type" title="Gathered resource">⛏</span>',
        intermediate: '<span class="mapping-type" title="Crafted intermediate">⚙</span>',
        reagent: '<span class="mapping-type" title="Process reagent">🧪</span>',
        mob_drop: '<span class="mapping-type" title="Mob drop">🗡</span>',
        research: '<span class="mapping-type" title="Research goal">📜</span>',
        codex: '<span class="mapping-type" title="Codex">📖</span>'
    };
    return indicators[type] || '';
}

function renderNodeChildren(children) {
    if (!children || children.length === 0) return '';
    return children.map(child => renderNode(child)).join('');
}

// Render loading state
export function renderLoading(container) {
    container.innerHTML = `
    <div class="planner-loading">
    Calculating requirements
    </div>
    `;
}

// Render empty/initial state
export function renderEmpty(container) {
    container.innerHTML = `
    <div class="planner-empty">
    Load a claim and select a target tier to see codex requirements
    </div>
    `;
}
