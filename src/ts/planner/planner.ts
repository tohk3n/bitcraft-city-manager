/**
 * Planner - Codex Requirement Calculator
 *
 * Orchestrates data loading and the expand → cascade → flatten pipeline.
 * UI rendering delegated to planner-view.ts.
 *
 * Two calculation entry points:
 *   calculateRequirements()   — fetches inventory then calculates
 *   calculateFromInventory()  — skips the fetch, for polling/multi-tier
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
  InventoryLookup,
  ClaimInventoriesResponse,
} from '../types/index.js';
import type { RecipesFile, PackagesFile } from '../data/types.js';
import type { FilterContext } from './player-filter.js';
import type { PlannerViewConfig } from './planner-view.js';

let codexCache: CodexFile | null = null;
let recipesCache: RecipesFile | null = null;
let gatheredCache: Set<string> | null = null;
let packagesCache: PackagesFile | null = null;
let lastPlanItems: PlanItem[] | null = null;
let lastInventoryLookup: InventoryLookup | null = null;

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

// ── Inventory Building ────────────────────────────────────────────

/** Fetch claim inventories and build the lookup. One API call. */
export async function fetchInventoryLookup(claimId: string): Promise<InventoryLookup> {
  const { packages } = await loadData();
  const inventoryData = await API.getClaimInventories(claimId);
  return buildLookupFromResponse(inventoryData, packages);
}

/** Build lookup from an already-fetched response. Pure, no network. */
export function buildLookupFromResponse(
  inventoryData: ClaimInventoriesResponse,
  packages: PackagesFile
): InventoryLookup {
  const { itemMeta, cargoMeta } = buildMetaLookups(inventoryData.items, inventoryData.cargos);
  return buildInventoryLookup(inventoryData.buildings || [], itemMeta, cargoMeta, packages);
}

// ── Calculation ───────────────────────────────────────────────────

/** The pipeline: expand recipes → apply inventory cascade → flatten. */
async function runCalculation(
  inventoryLookup: InventoryLookup,
  targetTier: number,
  options: CalculateOptions = {}
): Promise<PlannerResults> {
  const req = TIER_REQUIREMENTS[targetTier];
  if (!req) throw new Error(`Invalid target tier: ${targetTier}`);

  const codexCount = options.customCount ?? req.count;
  const { codex, recipes, gathered } = await loadData();

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

/** Fetches inventory, then calculates. Original API — callers unchanged. */
export async function calculateRequirements(
  claimId: string,
  targetTier: number,
  options: CalculateOptions = {}
): Promise<PlannerResults> {
  const inventoryLookup = await fetchInventoryLookup(claimId);
  lastInventoryLookup = inventoryLookup;
  return runCalculation(inventoryLookup, targetTier, options);
}

/** Calculate against pre-fetched inventory. For monitor/multi-tier polling. */
export async function calculateFromInventory(
  inventoryLookup: InventoryLookup,
  targetTier: number,
  options: CalculateOptions = {}
): Promise<PlannerResults> {
  return runCalculation(inventoryLookup, targetTier, options);
}

// ── Accessors ─────────────────────────────────────────────────────

export function getTierRequirements(): TierRequirements {
  return TIER_REQUIREMENTS;
}

export function getLastPlanItems(): PlanItem[] | null {
  return lastPlanItems;
}

export function getLastInventoryLookup(): InventoryLookup | null {
  return lastInventoryLookup;
}

// ── UI Rendering ──────────────────────────────────────────────────

export function renderPlannerView(
  container: HTMLElement,
  results: PlannerResults,
  claimId: string,
  cityTier: number,
  playerFilter: FilterContext | null,
  citizens: { entityId: string; userName: string }[] | null,
  activePlayerId: string | null,
  onTierChange: (tier: number, count: number) => void,
  onPlayerChange: (playerId: string | null) => void,
  onRefresh: PlannerViewConfig['onRefresh']
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
    claimId,
    cityTier,
    researches: results.researches,
    planItems: results.planItems,
    targetTier: results.targetTier,
    studyJournals: results.studyJournals,
    tierOptions: tiers,
    currentTier: results.targetTier,
    codexCount: results.codexCount,
    codexInfo: `${results.codexCount}\u00d7 T${req.codexTier} Codex`,
    playerFilter,
    onTierChange,
    citizens,
    activePlayerId,
    onPlayerChange,
    onRefresh,
  });
}

export { stopPolling } from './planner-view.js';

export function renderLoading(container: HTMLElement): void {
  PlannerView.renderLoading(container);
}

export function renderEmpty(container: HTMLElement): void {
  PlannerView.renderEmpty(container);
}

export { formatCompact };
