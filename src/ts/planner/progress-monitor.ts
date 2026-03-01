/**
 * Progress Monitor — auto-polling material × tier horizon matrix.
 *
 * Rows = base materials (Plant Fiber, Sand, Brick...), grouped by concern.
 * Cols = target tiers from (cityTier + 1) through the highest configured.
 * Each cell shows deficit and a progress bar gradient (green/yellow/red).
 *
 * Cell states:
 *   Complete:  ✓ with full green bar
 *   Partial:   deficit number, green→yellow→red gradient bar
 *   Missing:   deficit number, full red bar
 *   Empty:     material not needed for this tier
 */

import { fetchInventoryLookup, calculateFromInventory } from './planner.js';
import { calculatePlanProgress, formatCompact } from './lib/progress-calc.js';
import { TIER_REQUIREMENTS } from '../configuration/index.js';
import { createLogger } from '../logger.js';
import type { PlanItem, PlanProgressSummary, MappingType } from '../types/index.js';

const log = createLogger('Monitor');

// ── Types ─────────────────────────────────────────────────────────

interface TierSnapshot {
  targetTier: number;
  progress: PlanProgressSummary;
  items: PlanItem[];
}

interface CellData {
  deficit: number;
  have: number;
  required: number;
  pctComplete: number;
  itemTier: number;
}

interface MaterialRow {
  baseName: string;
  concern: Concern;
  byTargetTier: Map<number, CellData>;
}

type Concern = 'Refined' | 'Gathered' | 'Scholar' | 'Other';

interface ConcernGroup {
  concern: Concern;
  rows: MaterialRow[];
}

// ── Constants ─────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60_000;
const JITTER_MS = 10_000;
const MIN_POLL_MS = 15_000;
const MAX_HORIZON = 10;

const CONCERN_ORDER: Concern[] = ['Refined', 'Gathered', 'Scholar', 'Other'];

const CONCERN_MAP: Record<string, Concern> = {
  intermediate: 'Refined',
  gathered: 'Gathered',
  mob_drop: 'Gathered',
  fish: 'Gathered',
  reagent: 'Scholar',
  study_material: 'Scholar',
  container: 'Other',
  codex: 'Other',
  research: 'Other',
  alias: 'Other',
  likely_api: 'Other',
  unknown: 'Other',
};

const TIER_PREFIXES = [
  'Basic',
  'Simple',
  'Sturdy',
  'Fine',
  'Exquisite',
  'Rough',
  'Novice',
  'Essential',
  'Proficient',
  'Advanced',
  'Infused',
  'Refined',
  'Peerless',
  'Ornate',
  'Pristine',
  'Flawless',
  'Magnificent',
  "Beginner's",
];

// ── Module State ──────────────────────────────────────────────────

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let isPolling = false;
let lastPollTime = 0;
let pollCount = 0;

let claimId: string | null = null;
let startTier = 2;
let endTier = 10;
let currentPush = 3;
let container: HTMLElement | null = null;
let snapshots: TierSnapshot[] = [];

// ── Public API ────────────────────────────────────────────────────

export function start(
  el: HTMLElement,
  claim: string,
  currentCityTier: number,
  targetTier: number
): void {
  container = el;
  claimId = claim;

  currentPush = Math.max(2, targetTier);
  startTier = Math.max(2, currentCityTier + 1);
  const maxConfigured = Math.max(...Object.keys(TIER_REQUIREMENTS).map(Number));
  endTier = Math.min(MAX_HORIZON, maxConfigured);

  if (isPolling) return;
  isPolling = true;
  pollCount = 0;

  renderLoading();
  poll();

  document.addEventListener('visibilitychange', onVisibilityChange);
  log.info(`Monitor started: T${startTier}→T${endTier}, push=T${currentPush}`);
}

export function stop(): void {
  isPolling = false;
  clearTimer();
  document.removeEventListener('visibilitychange', onVisibilityChange);
  log.info('Monitor stopped');
}

export function isActive(): boolean {
  return isPolling;
}

// ── Polling Lifecycle ─────────────────────────────────────────────

function clearTimer(): void {
  if (pollTimer !== null) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function scheduleNext(): void {
  if (!isPolling) return;
  const jitter = Math.round((Math.random() - 0.5) * 2 * JITTER_MS);
  const delay = Math.max(MIN_POLL_MS, POLL_INTERVAL_MS + jitter);
  pollTimer = setTimeout(poll, delay);
  log.debug(`Next poll in ${Math.round(delay / 1000)}s`);
}

async function poll(): Promise<void> {
  if (!isPolling || !claimId || !container) return;

  clearTimer();
  lastPollTime = Date.now();
  pollCount++;

  try {
    const lookup = await fetchInventoryLookup(claimId);
    if (!isPolling) return;

    const tierRange = getTierRange();
    const results: TierSnapshot[] = [];

    for (const tier of tierRange) {
      const calcResult = await calculateFromInventory(lookup, tier);
      const progress = calculatePlanProgress(calcResult.planItems);
      results.push({ targetTier: tier, progress, items: calcResult.planItems });
    }

    snapshots = results;
    renderMatrix();
  } catch (err) {
    const error = err as Error;
    log.error('Poll failed:', error.message);
    renderError(error.message);
  }

  scheduleNext();
}

function onVisibilityChange(): void {
  if (document.hidden) {
    log.debug('Tab hidden — pausing');
    clearTimer();
  } else if (isPolling) {
    log.debug('Tab visible — resuming');
    const elapsed = Date.now() - lastPollTime;
    if (elapsed >= POLL_INTERVAL_MS) {
      poll();
    } else {
      scheduleNext();
    }
  }
}

// ── Data Helpers ──────────────────────────────────────────────────

function getTierRange(): number[] {
  const tiers: number[] = [];
  for (let t = startTier; t <= endTier; t++) {
    if (TIER_REQUIREMENTS[t]) tiers.push(t);
  }
  return tiers;
}

function toConcern(mappingType: MappingType): Concern {
  if (!mappingType) return 'Other';
  return CONCERN_MAP[mappingType] ?? 'Other';
}

function toBaseName(name: string): string {
  for (const prefix of TIER_PREFIXES) {
    if (name.startsWith(prefix + ' ')) return name.slice(prefix.length + 1);
  }
  return name;
}

function buildMatrix(): { rows: MaterialRow[]; tiers: number[] } {
  const tiers = snapshots.map((s) => s.targetTier);
  const rowMap = new Map<string, MaterialRow>();

  for (const snap of snapshots) {
    for (const item of snap.items) {
      if (item.deficit === 0) continue;

      const baseName = toBaseName(item.name);
      let row = rowMap.get(baseName);
      if (!row) {
        row = {
          baseName,
          concern: toConcern(item.mappingType),
          byTargetTier: new Map(),
        };
        rowMap.set(baseName, row);
      }

      const existing = row.byTargetTier.get(snap.targetTier);
      if (!existing || item.deficit > existing.deficit) {
        row.byTargetTier.set(snap.targetTier, {
          deficit: item.deficit,
          have: item.have,
          required: item.required,
          pctComplete: item.pctComplete,
          itemTier: item.tier,
        });
      }
    }
  }

  const rows = Array.from(rowMap.values()).sort((a, b) => {
    const ca = CONCERN_ORDER.indexOf(a.concern);
    const cb = CONCERN_ORDER.indexOf(b.concern);
    if (ca !== cb) return ca - cb;
    return sumDeficit(b) - sumDeficit(a);
  });

  return { rows, tiers };
}

function sumDeficit(row: MaterialRow): number {
  let total = 0;
  for (const cell of row.byTargetTier.values()) total += cell.deficit;
  return total;
}

function groupByConcern(rows: MaterialRow[]): ConcernGroup[] {
  const map = new Map<Concern, MaterialRow[]>();

  for (const row of rows) {
    let group = map.get(row.concern);
    if (!group) {
      group = [];
      map.set(row.concern, group);
    }
    group.push(row);
  }

  return CONCERN_ORDER.flatMap((concern) => {
    const items = map.get(concern);
    return items && items.length > 0 ? [{ concern, rows: items }] : [];
  });
}

// ── Rendering ─────────────────────────────────────────────────────

function renderLoading(): void {
  if (!container) return;
  container.innerHTML = '<div class="pm-status">Loading monitor…</div>';
}

function renderError(msg: string): void {
  if (!container) return;
  container.innerHTML = `<div class="pm-status pm-error">Poll failed: ${msg}</div>`;
}

function renderMatrix(): void {
  if (!container || snapshots.length === 0) return;

  const { rows, tiers } = buildMatrix();
  const grouped = groupByConcern(rows);
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  container.innerHTML = `
    <div class="pm-wrap">
      <div class="pm-bar">
        <div class="pm-pills">
          ${snapshots.map((s) => renderPill(s)).join('')}
        </div>
        <span class="pm-meta">Updated ${timeStr} · #${pollCount}</span>
      </div>
      <div class="pm-scroll">
        <table class="pm-table">
          <thead>
            <tr>
              <th class="pm-h-group"></th>
              <th class="pm-h-name">Material</th>
              ${tiers
                .map((t) => {
                  const cls = tierColumnClass(t);
                  return `<th class="pm-h-col ${cls}">T${t}</th>`;
                })
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${grouped.map((g) => renderConcernGroup(g, tiers)).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function tierColumnClass(targetTier: number): string {
  if (targetTier === currentPush) return 'pm-col-push';
  if (targetTier === currentPush + 1) return 'pm-col-next';
  if (targetTier < currentPush) return '';
  return 'pm-col-distant';
}

// ── Tier Pills ────────────────────────────────────────────────────

function renderPill(snap: TierSnapshot): string {
  const p = snap.progress;
  let cls: string;
  if (snap.targetTier === currentPush) {
    cls = p.percent === 100 ? 'complete' : p.percent >= 50 ? 'partial' : 'push';
  } else if (snap.targetTier === currentPush + 1) {
    cls = 'next';
  } else {
    cls = 'distant';
  }

  return `
    <div class="pm-pill pm-pill-${cls}">
      <span class="pm-pill-t">T${snap.targetTier}</span>
      <span class="pm-pill-p">${p.percent}%</span>
    </div>
  `;
}

// ── Concern Groups ────────────────────────────────────────────────

function renderConcernGroup(group: ConcernGroup, tiers: number[]): string {
  const slug = group.concern.toLowerCase();
  const count = group.rows.length;
  const firstRow = group.rows[0];
  const restRows = group.rows.slice(1);

  return `
    <tr class="pm-row pm-concern-${slug}">
      <td class="pm-label pm-label-${slug}" rowspan="${count}">
        <span class="pm-label-text">${group.concern}</span>
      </td>
      ${renderRowCells(firstRow, tiers)}
    </tr>
    ${restRows
      .map(
        (row) => `
      <tr class="pm-row pm-concern-${slug}">
        ${renderRowCells(row, tiers)}
      </tr>
    `
      )
      .join('')}
  `;
}

function renderRowCells(row: MaterialRow, tiers: number[]): string {
  return `
    <td class="pm-name">${row.baseName}</td>
    ${tiers.map((t) => renderCell(row.byTargetTier.get(t) ?? null, t)).join('')}
  `;
}

// ── Cell Rendering ────────────────────────────────────────────────

/**
 * Mini-card cell with bottom progress bar.
 *
 * Three visual states:
 *   Complete (have >= required):
 *     ✓ with full green bar
 *   Partial (have > 0 but < required):
 *     "have/required" text, green+red gradient bar
 *   Missing (have === 0):
 *     deficit text, full red bar
 *
 * The bar is a CSS linear-gradient on a 3px strip:
 *   green portion = (have / required) * 100%
 *   red portion = remainder
 */
function renderCell(cell: CellData | null, targetTier: number): string {
  const distant = targetTier > currentPush + 1 ? ' pm-distant' : '';

  if (!cell) {
    return `<td class="pm-cell pm-empty${distant}"></td>`;
  }

  if (cell.deficit === 0) {
    return `
      <td class="pm-cell pm-complete${distant}">
        <div class="pm-cell-body">✓</div>
        <div class="pm-bar-full pm-bar-green"></div>
      </td>
    `;
  }

  const pct = cell.required > 0 ? Math.round((cell.have / cell.required) * 100) : 0;

  if (cell.have === 0) {
    // Nothing gathered — full red bar
    return `
      <td class="pm-cell${distant}">
        <div class="pm-cell-body">
          <span class="pm-deficit">${formatCompact(cell.deficit)}</span>
        </div>
        <div class="pm-bar-full pm-bar-red"></div>
      </td>
    `;
  }

  // Partial — show have/required with gradient bar
  return `
    <td class="pm-cell${distant}">
      <div class="pm-cell-body">
        <span class="pm-frac">${formatCompact(cell.have)}/${formatCompact(cell.required)}</span>
      </div>
      <div class="pm-bar-grad" style="--pm-pct: ${pct}%"></div>
    </td>
  `;
}
