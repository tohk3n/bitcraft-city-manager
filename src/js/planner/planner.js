/**
 * Planner - Codex Requirement Calculator
 *
 * Orchestrates data loading and calculation pipeline.
 * UI rendering is delegated to task-list.js and flowchart.js.
 */

import { API } from '../api.js';
import { buildInventoryLookup, buildMetaLookups } from './lib/inventory-matcher.js';
import { expandRecipes } from './lib/recipe-expander.js';
import { applyCascade } from './lib/cascade-calc.js';
import { generateProgressReport, formatCompact } from './lib/progress-calc.js';
import * as TaskList from './task-list.js';
import * as Flowchart from './flowchart.js';
import { CONFIG } from '../config.js';

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

// Caches
const codexCache = {};
let mappingsCache = null;
let lastReport = null;

/**
 * Load codex JSON for a tier.
 */
async function loadCodex(tier) {
    if (!codexCache[tier]) {
        const response = await fetch(`/data/codex/t${tier}-codex.json`);
        if (!response.ok) throw new Error(`Failed to load codex for tier ${tier}`);
        codexCache[tier] = await response.json();
    }
    return codexCache[tier];
}

/**
 * Load item mappings.
 */
async function loadMappings() {
    if (!mappingsCache) {
        const response = await fetch('/data/item-mappings.json');
        mappingsCache = response.ok ? await response.json() : { mappings: {} };
    }
    return mappingsCache;
}

/**
 * Calculate requirements for a tier upgrade.
 */
export async function calculateRequirements(claimId, targetTier, options = {}) {
    const req = TIER_REQUIREMENTS[targetTier];
    if (!req) throw new Error(`Invalid target tier: ${targetTier}`);

    const codexCount = options.customCount ?? req.count;

    const [codex, mappings, inventoryData] = await Promise.all([
        loadCodex(req.codexTier),
                                                               loadMappings(),
                                                               API.getClaimInventories(claimId)
    ]);

    const { itemMeta, cargoMeta } = buildMetaLookups(inventoryData.items, inventoryData.cargos);
    const inventoryLookup = buildInventoryLookup(inventoryData.buildings || [], itemMeta, cargoMeta);

    const expanded = expandRecipes(codex, codexCount, mappings);
    const processed = applyCascade(expanded, inventoryLookup, mappings);
    const report = generateProgressReport(processed);

    lastReport = { ...report, targetTier };

    return {
        targetTier,
        codexTier: req.codexTier,
        codexCount,
        codexName: codex.name,
        researches: processed.researches,
        studyJournals: processed.studyJournals,
        summary: report.secondLevel,
        report
    };
}

/**
 * Get tier requirements info.
 */
export function getTierRequirements() {
    return TIER_REQUIREMENTS;
}

/**
 * Get last calculated report.
 */
export function getLastReport() {
    return lastReport;
}

// --- UI Rendering ---

/**
 * Render tier selector controls.
 */
export function renderControls(container, currentTier, onCalculate) {
    const tiers = Object.keys(TIER_REQUIREMENTS).map(Number).sort((a, b) => a - b);
    const defaultCount = TIER_REQUIREMENTS[currentTier]?.count || 20;

    container.innerHTML = `
    <div class="planner-controls">
    <div class="control-group">
    <label for="target-tier">Target Tier:</label>
    <select id="target-tier">
    ${tiers.map(t => `<option value="${t}" ${t === currentTier ? 'selected' : ''}>T${t}</option>`).join('')}
    </select>
    </div>
    <div class="control-group">
    <label for="codex-count">Codex Count:</label>
    <input type="number" id="codex-count" value="${defaultCount}" min="1" max="100">
    </div>
    <div class="planner-info" id="planner-info"></div>
    </div>
    `;

    const tierSelect = container.querySelector('#target-tier');
    const countInput = container.querySelector('#codex-count');
    const infoEl = container.querySelector('#planner-info');

    const updateInfo = (tier, count) => {
        const req = TIER_REQUIREMENTS[tier];
        const custom = count !== req.count ? ' (custom)' : '';
        infoEl.innerHTML = `Requires: <strong>${count}× T${req.codexTier} Codex</strong>${custom}`;
    };

    tierSelect.addEventListener('change', () => {
        const tier = parseInt(tierSelect.value, 10);
        const count = TIER_REQUIREMENTS[tier]?.count || 20;
        countInput.value = count;
        updateInfo(tier, count);
        onCalculate(tier, count);
    });

    countInput.addEventListener('change', () => {
        const tier = parseInt(tierSelect.value, 10);
        const count = parseInt(countInput.value, 10) || 1;
        updateInfo(tier, count);
        onCalculate(tier, count);
    });

    updateInfo(currentTier, defaultCount);
}

/**
 * Render the task list (deficit summary).
 */
export function renderDeficitSummary(container, summary) {
    if (!lastReport) {
        container.innerHTML = '<div class="task-empty">No data</div>';
        return;
    }
    TaskList.render(container, lastReport.firstTrackable);
}

/**
 * Render the research tree (flowchart).
 */
export function renderResearchTree(container, researches, studyJournals = null) {
    if (!lastReport) {
        container.innerHTML = '<div class="fc-empty">No data</div>';
        return;
    }
    Flowchart.render(container, researches, lastReport, studyJournals);
}

/**
 * Render loading state.
 */
export function renderLoading(container) {
    container.innerHTML = '<div class="planner-loading">Calculating requirements</div>';
}

/**
 * Render empty state.
 */
export function renderEmpty(container) {
    container.innerHTML = '<div class="planner-empty">Load a claim and select a target tier to see codex requirements</div>';
}

// Re-export for backward compatibility
export { formatCompact };
