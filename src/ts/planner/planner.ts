/**
 * Planner - Codex Requirement Calculator
 *
 * Orchestrates data loading and calculation pipeline.
 * UI rendering is delegated to planner-view.js (unified dashboard/flowchart).
 */

import { API } from '../api.js';
import { buildInventoryLookup, buildMetaLookups } from './lib/inventory-matcher.js';
import { expandRecipes } from './lib/recipe-expander.js';
import { applyCascade } from './lib/cascade-calc.js';
import { generateProgressReport, formatCompact } from './lib/progress-calc.js';
import * as PlannerView from './planner-view.js';
import type {
  CodexFile,
  RecipesFile,
  ProcessedNode,
  ProgressReport,
  PlannerResults,
  TierRequirements,
  CalculateOptions,
} from '../types/index.js';

// Tier upgrade requirements: target tier -> { codexTier, count }
const TIER_REQUIREMENTS: TierRequirements = {
  3: { codexTier: 2, count: 10 },
  4: { codexTier: 3, count: 15 },
  5: { codexTier: 4, count: 20 },
  6: { codexTier: 5, count: 25 },
  7: { codexTier: 6, count: 30 },
  8: { codexTier: 7, count: 35 },
  9: { codexTier: 8, count: 40 },
  10: { codexTier: 9, count: 45 },
};

// Data caches
let codexCache: CodexFile | null = null;
let recipesCache: RecipesFile | null = null;
let lastReport: (ProgressReport & { targetTier: number }) | null = null;

async function loadData(): Promise<{ codex: CodexFile; recipes: RecipesFile }> {
  if (!codexCache || !recipesCache) {
    const [codexRes, recipesRes] = await Promise.all([
      fetch('/data/codex.json'),
      fetch('/data/recipes.json'),
    ]);

    if (!codexRes.ok) throw new Error('Failed to load codex.json');
    if (!recipesRes.ok) throw new Error('Failed to load recipes.json');

    codexCache = await codexRes.json();
    recipesCache = await recipesRes.json();
  }

  const codex = codexCache;
  const recipes = recipesCache;

  if (!codex || !recipes) {
    throw new Error('Cache initialization failed');
  }

  return { codex, recipes };
}

export async function calculateRequirements(
  claimId: string,
  targetTier: number,
  options: CalculateOptions = {}
): Promise<PlannerResults> {
  const req = TIER_REQUIREMENTS[targetTier];
  if (!req) throw new Error(`Invalid target tier: ${targetTier}`);

  const codexCount = options.customCount ?? req.count;

  const [{ codex, recipes }, inventoryData] = await Promise.all([
    loadData(),
    API.getClaimInventories(claimId),
  ]);

  const { itemMeta, cargoMeta } = buildMetaLookups(inventoryData.items, inventoryData.cargos);
  const inventoryLookup = buildInventoryLookup(inventoryData.buildings || [], itemMeta, cargoMeta);

  const expanded = expandRecipes(codex, recipes, req.codexTier, codexCount);
  const processed = applyCascade(expanded, inventoryLookup);
  const report = generateProgressReport(processed);

  const codexTier = codex.tiers[String(req.codexTier)];
  const codexName = codexTier?.name || `Tier ${req.codexTier} Codex`;

  lastReport = { ...report, targetTier };

  return {
    targetTier,
    codexTier: req.codexTier,
    codexCount,
    codexName,
    researches: processed.researches,
    studyJournals: processed.studyJournals,
    summary: report.secondLevel,
    report,
  };
}

export function getTierRequirements(): TierRequirements {
  return TIER_REQUIREMENTS;
}

export function getLastReport(): (ProgressReport & { targetTier: number }) | null {
  return lastReport;
}

// --- UI Rendering ---

type OnCalculateCallback = (tier: number, count: number | null) => void;

export function renderControls(
  container: HTMLElement,
  currentTier: number,
  onCalculate: OnCalculateCallback
): void {
  const tiers = Object.keys(TIER_REQUIREMENTS)
    .map(Number)
    .sort((a, b) => a - b);
  const defaultCount = TIER_REQUIREMENTS[currentTier]?.count || 20;

  container.innerHTML = `
        <div class="planner-controls">
            <div class="control-group">
                <label for="target-tier">Target Tier:</label>
                <select id="target-tier">
                    ${tiers.map((t) => `<option value="${t}" ${t === currentTier ? 'selected' : ''}>T${t}</option>`).join('')}
                </select>
            </div>
            <div class="control-group">
                <label for="codex-count">Codex Count:</label>
                <input type="number" id="codex-count" value="${defaultCount}" min="1" max="100">
            </div>
            <div class="planner-info" id="planner-info"></div>
        </div>
    `;

  const tierSelect = container.querySelector('#target-tier') as HTMLSelectElement;
  const countInput = container.querySelector('#codex-count') as HTMLInputElement;
  const infoEl = container.querySelector('#planner-info') as HTMLElement;

  const updateInfo = (tier: number, count: number): void => {
    const req = TIER_REQUIREMENTS[tier];
    if (!req) return;
    const custom = count !== req.count ? ' (custom)' : '';
    infoEl.innerHTML = `Requires: <strong>${count}&times; T${req.codexTier} Codex</strong>${custom}`;
  };

  tierSelect.addEventListener('change', () => {
    const tier = parseInt(tierSelect.value, 10);
    const count = TIER_REQUIREMENTS[tier]?.count || 20;
    countInput.value = String(count);
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
 * Render the unified planner view (dashboard + flowchart tabs)
 */
export function renderPlannerView(
  container: HTMLElement,
  researches: ProcessedNode[],
  studyJournals: ProcessedNode | null = null
): void {
  if (!lastReport) {
    container.innerHTML = '<div class="pv-empty">No data</div>';
    return;
  }
  PlannerView.render(container, researches, lastReport, studyJournals);
}

export function renderLoading(container: HTMLElement): void {
  PlannerView.renderLoading(container);
}

export function renderEmpty(container: HTMLElement): void {
  PlannerView.renderEmpty(container);
}

export { formatCompact };
