/**
 * Planner - Codex Requirement Calculator
 *
 * Orchestrates data loading and calculation pipeline.
 * UI rendering is delegated to planner-view.ts (unified dashboard/flowchart).
 */

import { API } from '../api.js';
import { loadCoreData } from '../data/loader.js';
import { buildInventoryLookup, buildMetaLookups } from './lib/inventory-matcher.js';
import { expandRecipes } from './lib/recipe-expander.js';
import { applyCascade } from './lib/cascade-calc.js';
import { flattenPlan, formatCompact } from './lib/progress-calc.js';
import * as PlannerView from './planner-view.js';
import { TIER_REQUIREMENTS } from '../configuration/index.js';
import type {
  CodexFile,
  PlanItem,
  PlannerResults,
  TierRequirements,
  CalculateOptions,
} from '../types/index.js';
import type { RecipesFile, PackagesFile } from '../data/types.js';

// Data caches
let codexCache: CodexFile | null = null;
let recipesCache: RecipesFile | null = null;
let gatheredCache: Set<string> | null = null;
let packagesCache: PackagesFile | null = null;
let lastPlanItems: PlanItem[] | null = null;

async function loadData(): Promise<{
  codex: CodexFile;
  recipes: RecipesFile;
  gathered: Set<string>;
  packages: PackagesFile;
}> {
  if (!codexCache) {
    const codexRes = await fetch('/data/codex.json');
    if (!codexRes.ok) throw new Error('Failed to load codex.json');
    codexCache = await codexRes.json();
  }

  if (!recipesCache || !gatheredCache || !packagesCache) {
    const { recipes, gathered, packages } = await loadCoreData();
    recipesCache = recipes;
    gatheredCache = gathered;
    packagesCache = packages;
  }

  const codex = codexCache;
  const recipes = recipesCache;
  const gathered = gatheredCache;
  const packages = packagesCache;

  if (!codex || !recipes || !gathered || !packages) {
    throw new Error('Cache initialization failed');
  }

  return { codex, recipes, gathered, packages };
}

export async function calculateRequirements(
  claimId: string,
  targetTier: number,
  options: CalculateOptions = {}
): Promise<PlannerResults> {
  const req = TIER_REQUIREMENTS[targetTier];
  if (!req) throw new Error(`Invalid target tier: ${targetTier}`);

  const codexCount = options.customCount ?? req.count;

  const [{ codex, recipes, gathered, packages }, inventoryData] = await Promise.all([
    loadData(),
    API.getClaimInventories(claimId),
  ]);

  const { itemMeta, cargoMeta } = buildMetaLookups(inventoryData.items, inventoryData.cargos);
  const inventoryLookup = buildInventoryLookup(
    inventoryData.buildings || [],
    itemMeta,
    cargoMeta,
    packages
  );

  const expanded = expandRecipes(codex, recipes, req.codexTier, codexCount, gathered);
  const processed = applyCascade(expanded, inventoryLookup);
  const planItems = flattenPlan(processed);

  const codexTier = codex.tiers[String(req.codexTier)];
  const codexName = codexTier?.name || `Tier ${req.codexTier} Codex`;

  lastPlanItems = planItems;

  return {
    targetTier,
    codexTier: req.codexTier,
    codexCount,
    codexName,
    researches: processed.researches,
    studyJournals: processed.studyJournals,
    planItems,
  };
}

export function getTierRequirements(): TierRequirements {
  return TIER_REQUIREMENTS;
}

export function getLastPlanItems(): PlanItem[] | null {
  return lastPlanItems;
}

// --- UI Rendering ---

/**
 * Render the unified planner view (dashboard + flowchart tabs).
 * Tier controls are now inside planner-view's toolbar.
 */
export function renderPlannerView(
  container: HTMLElement,
  results: PlannerResults,
  onTierChange: (tier: number, count: number) => void
): void {
  if (!results.planItems || results.planItems.length === 0) {
    container.innerHTML = '<div class="pv-empty">No data</div>';
    return;
  }

  const tiers = Object.keys(TIER_REQUIREMENTS)
    .map(Number)
    .sort((a, b) => a - b);
  const req = TIER_REQUIREMENTS[results.targetTier];

  PlannerView.render(container, {
    researches: results.researches,
    planItems: results.planItems,
    targetTier: results.targetTier,
    studyJournals: results.studyJournals,
    tierOptions: tiers,
    currentTier: results.targetTier,
    codexCount: results.codexCount,
    codexInfo: `${results.codexCount}\u00d7 T${req.codexTier} Codex`,
    onTierChange,
  });
}

export function renderLoading(container: HTMLElement): void {
  PlannerView.renderLoading(container);
}

export function renderEmpty(container: HTMLElement): void {
  PlannerView.renderEmpty(container);
}

export { formatCompact };
