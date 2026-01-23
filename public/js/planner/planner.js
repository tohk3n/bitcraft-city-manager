/**
 * Planner - Codex Requirement Calculator
 *
 * Main orchestrator module that coordinates the calculation pipeline
 * and renders the UI. Maintains backward compatibility with existing
 * main.js interface.
 */

import { API } from '../api.js';
import {
    buildInventoryLookup,
    buildMetaLookups,
    isTrackable,
    normalizeName,
    createKey
} from './lib/inventory-matcher.js';
import { expandRecipes, findFirstTrackable } from './lib/recipe-expander.js';
import { applyCascade, collectFirstTrackable, collectSecondLevel } from './lib/cascade-calc.js';
import {
    calculateProgress,
    generateProgressReport,
    generateExportText,
    formatCompact,
        groupByActivity
} from './lib/progress-calc.js';

// ============================================================================
// Configuration
// ============================================================================

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

// ============================================================================
// Caches
// ============================================================================

const codexCache = {};
let mappingsCache = null;
let lastReport = null;  // Store for export functionality

// ============================================================================
// Data Loading
// ============================================================================

/**
 * Load codex JSON for a tier (lazy-loaded, cached)
 */
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

/**
 * Load item mappings (lazy-loaded, cached)
 */
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

// ============================================================================
// Main Calculation
// ============================================================================

/**
 * Calculate requirements for a tier upgrade.
 * Main entry point - coordinates the full calculation pipeline.
 *
 * @param {string} claimId - Claim ID to check inventory
 * @param {number} targetTier - Target tier (3-10)
 * @param {Object} options - { customCount: number } for outpost overrides
 * @returns {Object} Full calculation results with progress report
 */
export async function calculateRequirements(claimId, targetTier, options = {}) {
    const req = TIER_REQUIREMENTS[targetTier];
    if (!req) {
        throw new Error(`Invalid target tier: ${targetTier}`);
    }

    // Determine codex count (allow custom override for outposts)
    const codexCount = options.customCount ?? req.count;

    // Load all data in parallel
    const [codex, mappings, inventoryData] = await Promise.all([
        loadCodex(req.codexTier),
                                                               loadMappings(),
                                                               API.getClaimInventories(claimId)
    ]);

    // Build inventory lookup
    const { itemMeta, cargoMeta } = buildMetaLookups(
        inventoryData.items,
        inventoryData.cargos
    );

    const inventoryLookup = buildInventoryLookup(
        inventoryData.buildings || [],
        itemMeta,
        cargoMeta
    );

    // Phase 1: Expand recipes
    const expanded = expandRecipes(codex, codexCount, mappings);

    // Phase 2: Apply cascade with inventory
    const processed = applyCascade(expanded, inventoryLookup, mappings);

    // Generate progress report
    const report = generateProgressReport(processed);

    // Store for export
    lastReport = { ...report, targetTier };

    // Return in format compatible with existing UI
    return {
        targetTier,
        codexTier: req.codexTier,
        codexCount,
        codexName: codex.name,
        researches: processed.researches,
        summary: report.secondLevel,
        report,
        // Expose for debugging
        inventoryLookup,
        expanded,
        processed
    };
}

/**
 * Get tier requirements info.
 */
export function getTierRequirements() {
    return TIER_REQUIREMENTS;
}

// ============================================================================
// UI Rendering
// ============================================================================

/**
 * Render the tier selector controls.
 */
export function renderControls(container, currentTier, onCalculate) {
    const tiers = Object.keys(TIER_REQUIREMENTS).map(Number).sort((a, b) => a - b);
    const defaultCount = TIER_REQUIREMENTS[currentTier]?.count || 20;

    container.innerHTML = `
    <div class="planner-controls">
    <div class="control-group">
    <label for="target-tier">Target Tier:</label>
    <select id="target-tier">
    ${tiers.map(t => `
        <option value="${t}" ${t === currentTier ? 'selected' : ''}>
        T${t}
        </option>
        `).join('')}
        </select>
        </div>
        <div class="control-group">
        <label for="codex-count">Codex Count:</label>
        <input type="number" id="codex-count" value="${defaultCount}" min="1" max="100">
        </div>
        <div class="planner-requirement" id="planner-req-info"></div>
        </div>
        `;

        const select = container.querySelector('#target-tier');
        const countInput = container.querySelector('#codex-count');

        // Update default count when tier changes
        select.addEventListener('change', () => {
            const newTier = parseInt(select.value, 10);
            const newDefault = TIER_REQUIREMENTS[newTier]?.count || 20;
            countInput.value = newDefault;
            updateRequirementInfo(newTier, newDefault);
            onCalculate(newTier, newDefault);
        });

        // Trigger recalc when count changes (on blur or enter)
        countInput.addEventListener('change', () => {
            const tier = parseInt(select.value, 10);
            const count = parseInt(countInput.value, 10) || 1;
            updateRequirementInfo(tier, count);
            onCalculate(tier, count);
        });

        updateRequirementInfo(currentTier, defaultCount);
}

/**
 * Update the requirement info display.
 */
function updateRequirementInfo(targetTier, count) {
    const info = document.getElementById('planner-req-info');
    if (!info) return;

    const req = TIER_REQUIREMENTS[targetTier];
    if (req) {
        const isCustom = count !== req.count;
        const customLabel = isCustom ? ' (custom)' : '';
        info.innerHTML = `Requires: <strong>${count}x T${req.codexTier} Codex</strong>${customLabel}`;
    }
}

/**
 * Render the deficit summary cards.
 * Shows first trackable items - the immediate crafting goals.
 */
export function renderDeficitSummary(container, summary) {
    if (!lastReport) {
        container.innerHTML = '<div class="summary-empty">No data</div>';
        return;
    }

    const items = lastReport.firstTrackable;

    if (!items || items.length === 0) {
        container.innerHTML = '<div class="summary-empty">All requirements met</div>';
        return;
    }

    // Show items with deficits, sorted by deficit
    const itemsWithDeficit = items.filter(item => item.deficit > 0);

    if (itemsWithDeficit.length === 0) {
        container.innerHTML = '<div class="summary-complete">All materials in stock!</div>';
        return;
    }

    container.innerHTML = itemsWithDeficit.map(item => {
        const pct = item.required > 0
        ? Math.round((Math.min(item.have, item.required) / item.required) * 100)
        : 100;

        return `
        <div class="deficit-card has-deficit" title="${item.required.toLocaleString()} required, ${item.have.toLocaleString()} in stock">
        <div class="item-name">${item.name}</div>
        <div class="item-tier">T${item.tier}</div>
        <div class="item-progress">
        <div class="progress-bar-small">
        <div class="progress-fill-small" style="width: ${pct}%"></div>
        </div>
        </div>
        <div class="item-counts">
        <span class="have">${formatCompact(item.have)}</span>
        <span class="sep">/</span>
        <span class="required">${formatCompact(item.required)}</span>
        </div>
        <div class="item-deficit">-${formatCompact(item.deficit)}</div>
        </div>
        `;
    }).join('');
}

/**
 * Render the flowchart view with tabs for each research branch.
 */
export function renderResearchTree(container, researches) {
    if (!lastReport) {
        container.innerHTML = '<div class="planner-empty">No data</div>';
        return;
    }

    const { overall } = lastReport;

    container.innerHTML = `
    <div class="progress-overview">
    <div class="progress-stats">
    <div class="progress-main">
    <div class="progress-bar-large">
    <div class="progress-fill-large" style="width: ${overall.percent}%"></div>
    </div>
    <span class="progress-pct">${overall.percent}%</span>
    </div>
    <div class="progress-detail">${overall.completeCount}/${overall.totalItems} materials ready</div>
    </div>
    <button id="copy-tasks" class="export-btn" title="Copy task list to clipboard">Copy Task List</button>
    </div>
    <div class="flowchart-tabs" id="flowchart-tabs">
    ${researches.map((r, i) => `
        <button class="flowchart-tab ${i === 0 ? 'active' : ''}" data-index="${i}">
        <span class="flowchart-tab-status ${r.status}"></span>
        ${formatResearchName(r.name)}
        </button>
        `).join('')}
        </div>
        <div class="flowchart-container" id="flowchart-container">
        <div class="flowchart-tree" id="flowchart-tree">
        <svg class="flowchart-svg" id="flowchart-svg"></svg>
        <div class="flowchart-content" id="flowchart-content"></div>
        </div>
        </div>
        <div class="flowchart-legend">
        <div class="legend-item">
        <div class="legend-color complete"></div>
        <span>Complete</span>
        </div>
        <div class="legend-item">
        <div class="legend-color partial"></div>
        <span>Partial</span>
        </div>
        <div class="legend-item">
        <div class="legend-color missing"></div>
        <span>Missing</span>
        </div>
        <div class="legend-item legend-spacer">
        <span class="legend-dashed"></span>
        <span>Non-trackable</span>
        </div>
        </div>
        `;

        // Store researches for tab switching
        let activeIndex = 0;
        const contentEl = container.querySelector('#flowchart-content');

        // Render initial tree
        renderFlowchartTree(contentEl, researches[0]);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => drawFlowchartConnections(container));
        });

        // Wire up tab switching
        container.querySelectorAll('.flowchart-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const index = parseInt(tab.dataset.index, 10);
                if (index === activeIndex) return;

                activeIndex = index;
                container.querySelectorAll('.flowchart-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                renderFlowchartTree(contentEl, researches[index]);
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => drawFlowchartConnections(container));
                });
            });
        });

        // Wire up export button
        container.querySelector('#copy-tasks').addEventListener('click', () => {
            if (!lastReport) return;
            const text = generateExportText(lastReport, lastReport.targetTier);
            navigator.clipboard.writeText(text).then(() => {
                const btn = container.querySelector('#copy-tasks');
                const orig = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = orig, 2000);
            });
        });

        // Redraw connections on resize
        const resizeHandler = () => drawFlowchartConnections(container);
        window.addEventListener('resize', resizeHandler);

        // Click-and-drag panning
        const flowchartContainer = container.querySelector('#flowchart-container');
        setupDragPan(flowchartContainer);

        // Clean up on next render (store handler for potential cleanup)
        container._resizeHandler = resizeHandler;
}

/**
 * Setup click-and-drag panning for a scrollable container.
 */
function setupDragPan(element) {
    let isDragging = false;
    let startX, startY, scrollLeft, scrollTop;

    element.addEventListener('mousedown', (e) => {
        // Only pan with left mouse button, ignore if clicking on interactive elements
        if (e.button !== 0 || e.target.closest('button, a, input')) return;

        isDragging = true;
        element.classList.add('dragging');
        startX = e.pageX - element.offsetLeft;
        startY = e.pageY - element.offsetTop;
        scrollLeft = element.scrollLeft;
        scrollTop = element.scrollTop;
        e.preventDefault();
    });

    element.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const x = e.pageX - element.offsetLeft;
        const y = e.pageY - element.offsetTop;
        const walkX = (x - startX) * 1.5; // Multiplier for faster panning
        const walkY = (y - startY) * 1.5;

        element.scrollLeft = scrollLeft - walkX;
        element.scrollTop = scrollTop - walkY;
    });

    element.addEventListener('mouseup', () => {
        isDragging = false;
        element.classList.remove('dragging');
    });

    element.addEventListener('mouseleave', () => {
        isDragging = false;
        element.classList.remove('dragging');
    });
}

/**
 * Format research name for tab display.
 */
function formatResearchName(name) {
    return name
    .replace(' Research', '')
    .replace(' Codex', '')
    .replace('Novice ', '')
    .replace('Apprentice ', '')
    .replace('Journeyman ', '')
    .replace('Expert ', '')
    .replace('Master ', '');
}

/**
 * Render a single research tree into the flowchart.
 */
function renderFlowchartTree(container, research) {
    container.innerHTML = renderFlowchartNode(research, true);
}

/**
 * Render a flowchart node recursively.
 */
function renderFlowchartNode(node, isGoal = false) {
    const hasChildren = node.children && node.children.length > 0;
    const pct = node.required > 0
    ? Math.round((Math.min(node.have, node.required) / node.required) * 100)
    : 100;
    const deficit = Math.max(0, node.required - node.have);

    const nodeHtml = `
    <div class="fc-node ${node.status} ${isGoal ? 'goal' : ''} ${!node.trackable ? 'non-trackable' : ''}"
    data-name="${node.name}">
    ${deficit > 0 ? `<div class="fc-node-deficit">-${formatCompact(deficit)}</div>` : ''}
    <div class="fc-node-name">${node.name}</div>
    <div class="fc-node-meta">
    <span class="fc-node-tier">T${node.tier}</span>
    <span class="fc-node-qty">
    <span class="have">${formatCompact(node.have)}</span>
    <span class="required">/ ${formatCompact(node.required)}</span>
    </span>
    </div>
    <div class="fc-node-progress">
    <div class="fc-node-progress-fill" style="width: ${pct}%"></div>
    </div>
    </div>
    `;

    if (!hasChildren) {
        return nodeHtml;
    }

    return `
    <div class="fc-node-group">
    ${nodeHtml}
    <div class="fc-node-children">
    ${node.children.map(child => renderFlowchartNode(child, false)).join('')}
    </div>
    </div>
    `;
}

/**
 * Draw SVG connection lines between nodes.
 */
function drawFlowchartConnections(container) {
    const svg = container.querySelector('#flowchart-svg');
    const tree = container.querySelector('#flowchart-tree');
    if (!svg || !tree) return;

    svg.innerHTML = '';
    const treeRect = tree.getBoundingClientRect();

    // Find all node-groups and draw lines from parent to children
    container.querySelectorAll('.fc-node-group').forEach(group => {
        const parentNode = group.querySelector(':scope > .fc-node');
        const childrenContainer = group.querySelector(':scope > .fc-node-children');

        if (!parentNode || !childrenContainer) return;

        const childNodes = childrenContainer.querySelectorAll(':scope > .fc-node, :scope > .fc-node-group > .fc-node');
        if (childNodes.length === 0) return;

        const parentRect = parentNode.getBoundingClientRect();
        const parentX = parentRect.left + parentRect.width / 2 - treeRect.left;
        const parentY = parentRect.bottom - treeRect.top;

        childNodes.forEach(child => {
            const childRect = child.getBoundingClientRect();
            const childX = childRect.left + childRect.width / 2 - treeRect.left;
            const childY = childRect.top - treeRect.top;

            // Determine line class based on child status
            const statusClass = child.classList.contains('complete') ? 'complete' :
            child.classList.contains('partial') ? 'partial' : '';

            // Draw curved path
            const midY = (parentY + childY) / 2;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${parentX} ${parentY} C ${parentX} ${midY}, ${childX} ${midY}, ${childX} ${childY}`);
            path.classList.add('fc-connector');
            if (statusClass) path.classList.add(statusClass);
            svg.appendChild(path);
        });
    });
}

/**
 * Render loading state.
 */
export function renderLoading(container) {
    container.innerHTML = `
    <div class="planner-loading">
    Calculating requirements
    </div>
    `;
}

/**
 * Render empty/initial state.
 */
export function renderEmpty(container) {
    container.innerHTML = `
    <div class="planner-empty">
    Load a claim and select a target tier to see codex requirements
    </div>
    `;
}

// ============================================================================
// Exports for testing
// ============================================================================

export { normalizeName, buildInventoryLookup, formatCompact };
