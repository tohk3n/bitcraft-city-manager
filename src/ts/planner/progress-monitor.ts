// Progress Monitor -- heatmap dashboard with drill-down.
//
// Two layers of disclosure:
//   1. Branch x tier heatmap, always fits one screen
//   2. Drill-down panel, click a cell to see individual items
//      for that branch x tier, grouped by concern category.

import { fetchInventoryLookup, calculateFromInventory } from './planner.js';
import { calculatePlanProgress, formatCompact } from './lib/progress-calc.js';
import { createLogger } from '../logger.js';
import { collectItemsFromTree, CONCERN_ORDER, CONCERN_COLORS } from './lib/concern-items.js';
import type { ConcernItem, Concern } from './lib/concern-items.js';
import type { PlanItem, PlanProgressSummary, ProcessedNode } from '../types/index.js';

const log = createLogger('Monitor');

// ── Types ─────────────────────────────────────────────────────────

interface TierSnapshot {
  targetTier: number;
  progress: PlanProgressSummary;
  items: PlanItem[];
  researches: ProcessedNode[];
  studyJournals: ProcessedNode | null;
}

interface HeatCell {
  percent: number;
  completeCount: number;
  totalCount: number;
}

interface BranchRow {
  label: string;
  fullName: string;
  isJournals: boolean;
  byTier: Map<number, HeatCell>;
}

// ── Constants ─────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60_000;
const JITTER_MS = 10_000;
const MIN_POLL_MS = 15_000;

// From $tier-colors in _variables.scss, duplicated here because
// needed them for inline styles on the tier column headers.
const TIER_COLORS: Record<number, string> = {
  1: '#4e5579',
  2: '#9ece6a',
  3: '#7aa2f7',
  4: '#e0af68',
  5: '#f7768e',
  6: '#bb9af7',
  7: '#2ac3de',
  8: '#ff9e64',
  9: '#ff007c',
  10: '#7dcfff',
};

// ── Module State ──────────────────────────────────────────────────

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let isPolling = false;
let lastPollTime = 0;
let pollCount = 0;

let claimId: string | null = null;
let currentPush = 3;
let container: HTMLElement | null = null;
let snapshot: TierSnapshot | null = null;

let renderedStructureKey = '';

let drillBranch: string | null = null;
let drillTier: number | null = null;

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

  renderedStructureKey = '';
  drillBranch = null;
  drillTier = null;

  if (isPolling) return;
  isPolling = true;
  pollCount = 0;

  renderLoading();
  poll();

  document.addEventListener('visibilitychange', onVisibilityChange);
  log.info(`Monitor started: push=T${currentPush}`);
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

// ── Polling ───────────────────────────────────────────────────────

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

    const calc = await calculateFromInventory(lookup, currentPush);
    snapshot = {
      targetTier: currentPush,
      progress: calculatePlanProgress(calc.planItems),
      items: calc.planItems,
      researches: calc.researches,
      studyJournals: calc.studyJournals,
    };

    renderHeatmap();
  } catch (err) {
    const error = err as Error;
    log.error('Poll failed:', error.message);
    renderError(error.message);
  }

  scheduleNext();
}

function onVisibilityChange(): void {
  if (document.hidden) {
    log.debug('Tab hidden -- pausing');
    clearTimer();
    return;
  }
  if (!isPolling) return;

  log.debug('Tab visible -- resuming');
  const elapsed = Date.now() - lastPollTime;
  if (elapsed >= POLL_INTERVAL_MS) {
    poll();
  } else {
    const remaining = POLL_INTERVAL_MS - elapsed;
    clearTimer();
    pollTimer = setTimeout(poll, Math.max(MIN_POLL_MS, remaining));
  }
}

// ── Data ──────────────────────────────────────────────────────────

// "Essential Stone Research" should be "Stone"
function toBranchLabel(name: string): string {
  return name
    .replace(' Research', '')
    .replace(' Codex', '')
    .replace(
      /^(Novice|Apprentice|Journeyman|Expert|Master|Proficient|Essential|Advanced|Comprehensive|Beginner's?) /i,
      ''
    );
}

function getBranchTree(branchLabel: string): ProcessedNode | null {
  if (!snapshot) return null;
  if (branchLabel === 'Journals') return snapshot.studyJournals;
  return snapshot.researches.find((r) => toBranchLabel(r.name) === branchLabel) ?? null;
}

// ── Heatmap Data ──────────────────────────────────────────────────

// Columns = distinct item tiers found across all branch trees.
function buildHeatmapData(): { branches: BranchRow[]; tiers: number[] } {
  if (!snapshot) return { branches: [], tiers: [] };

  const branchDefs: { label: string; fullName: string; isJournals: boolean }[] = [];
  for (const research of snapshot.researches) {
    branchDefs.push({
      label: toBranchLabel(research.name),
      fullName: research.name,
      isJournals: false,
    });
  }
  if (snapshot.studyJournals) {
    branchDefs.push({
      label: 'Journals',
      fullName: snapshot.studyJournals.name,
      isJournals: true,
    });
  }

  // Collect all items per branch, then group by item tier for the cells
  const tierSet = new Set<number>();
  const branches: BranchRow[] = branchDefs.map(({ label, fullName, isJournals }) => {
    const tree = getBranchTree(label);
    const allItems = tree ? collectItemsFromTree(tree) : [];
    const byTier = new Map<number, HeatCell>();

    // Group items by their own tier (T1, T2, T3...) within this branch
    const tierGroups = new Map<number, ConcernItem[]>();
    for (const item of allItems) {
      tierSet.add(item.tier);
      let group = tierGroups.get(item.tier);
      if (!group) {
        group = [];
        tierGroups.set(item.tier, group);
      }
      group.push(item);
    }

    for (const [tier, items] of tierGroups) {
      const totalRequired = items.reduce((s, i) => s + i.required, 0);
      const totalContribution = items.reduce((s, i) => s + Math.min(i.have, i.required), 0);
      byTier.set(tier, {
        percent: totalRequired > 0 ? Math.round((totalContribution / totalRequired) * 100) : 100,
        completeCount: items.filter((i) => i.deficit === 0).length,
        totalCount: items.length,
      });
    }

    return { label, fullName, isJournals, byTier };
  });

  const tiers = Array.from(tierSet).sort((a, b) => a - b);
  return { branches, tiers };
}

// Drill-down items for a branch, optionally filtered to a single item tier.
function getConcernItems(branchLabel: string, tier: number | null): ConcernItem[] {
  const tree = getBranchTree(branchLabel);
  if (!tree) return [];

  const items = collectItemsFromTree(tree);
  const filtered = tier !== null ? items.filter((i) => i.tier === tier) : items;
  return filtered.sort((a, b) => b.deficit - a.deficit);
}

// ── Rendering ─────────────────────────────────────────────────────

function renderLoading(): void {
  if (!container) return;
  container.innerHTML = '<div class="pm-status">Loading monitor...</div>';
}

function renderError(msg: string): void {
  if (!container) return;
  container.innerHTML = `<div class="pm-status pm-error">Poll failed: ${msg}</div>`;
}

function renderHeatmap(): void {
  if (!container || !snapshot) return;

  const { branches, tiers } = buildHeatmapData();
  const structureKey = branches.map((b) => b.label).join(',') + '|' + tiers.join(',');

  if (structureKey !== renderedStructureKey) {
    fullRender(branches, tiers);
    renderedStructureKey = structureKey;
  } else {
    patchHeatmap(branches, tiers);
    patchBar();
  }

  if (drillBranch !== null) {
    renderDrillDown(drillBranch, drillTier);
  }
}

function fullRender(branches: BranchRow[], tiers: number[]): void {
  if (!container) return;

  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const pushPct = snapshot ? snapshot.progress.percent : 0;

  container.innerHTML = `
    <div class="pm-wrap">
      <div class="pm-bar">
        <div class="pm-bar-l">
          <div class="pm-push-pill">
            <b>T${currentPush} push</b>
            <span>${pushPct}%</span>
          </div>
          <div class="pm-goals" id="pm-goals">
            <span class="pm-goals-label">goals</span>
            ${branches.map((b) => renderGoalBadge(b)).join('')}
          </div>
        </div>
        <span class="pm-meta">Updated ${timeStr} - #${pollCount}</span>
      </div>
      <div class="pm-hm">
        <div class="pm-grid" style="grid-template-columns: 80px repeat(${tiers.length}, 1fr)" id="pm-grid">
          <div class="pm-corner"></div>
          ${tiers.map((t) => `<div class="pm-th" style="color:${TIER_COLORS[t] || 'var(--text-muted)'}">T${t}</div>`).join('')}
          ${branches.map((b) => renderBranchRow(b, tiers)).join('')}
        </div>
        <div class="pm-legend">
          <div class="pm-legend-l">
            <span><span class="pm-swatch" style="background:rgba(158,206,106,.35)"></span>&gt;50%</span>
            <span><span class="pm-swatch" style="background:rgba(224,175,104,.35)"></span>25-50%</span>
            <span><span class="pm-swatch" style="background:rgba(247,118,142,.35)"></span>&lt;25%</span>
          </div>
          <span>click to drill down</span>
        </div>
      </div>
      <div id="pm-drill"></div>
    </div>`;

  wireHeatmap();
}

function renderGoalBadge(branch: BranchRow): string {
  const pushCell = branch.byTier.get(currentPush);
  const done = pushCell && pushCell.percent === 100;
  return `<span class="pm-goal ${done ? 'pm-goal-done' : ''}">${branch.label}</span>`;
}

function renderBranchRow(branch: BranchRow, tiers: number[]): string {
  const label = `<div class="pm-label" tabindex="0" data-branch="${branch.label}">${branch.label}</div>`;
  const cells = tiers.map((t) => renderHeatCell(branch, t)).join('');
  return label + cells;
}

function renderHeatCell(branch: BranchRow, tier: number): string {
  const cell = branch.byTier.get(tier);
  if (!cell) {
    return `<div class="pm-hcell pm-hcell-empty" data-branch="${branch.label}" data-tier="${tier}"></div>`;
  }

  return `<div class="pm-hcell" tabindex="0" data-branch="${branch.label}" data-tier="${tier}" style="background:${cellBg(cell.percent)}">
    <span class="pm-hcell-pct" style="color:${cellFg(cell.percent)}">${cell.percent}%</span>
    <span class="pm-hcell-ratio">${cell.completeCount}/${cell.totalCount}</span>
  </div>`;
}

function cellBg(pct: number): string {
  if (pct > 50) return `rgba(158,206,106,${0.08 + (pct / 100) * 0.2})`;
  if (pct >= 25) return `rgba(224,175,104,${0.08 + (pct / 100) * 0.2})`;
  return `rgba(247,118,142,${0.1 + ((100 - pct) / 100) * 0.2})`;
}

function cellFg(pct: number): string {
  if (pct > 50) return 'var(--status-complete)';
  if (pct >= 25) return 'var(--status-partial)';
  return 'var(--status-missing)';
}

function patchHeatmap(branches: BranchRow[], tiers: number[]): void {
  if (!container) return;

  for (const branch of branches) {
    for (const tier of tiers) {
      const el = container.querySelector(
        `.pm-hcell[data-branch="${CSS.escape(branch.label)}"][data-tier="${tier}"]`
      ) as HTMLElement | null;
      if (!el) continue;

      const cell = branch.byTier.get(tier);
      if (!cell) continue;

      el.style.background = cellBg(cell.percent);

      const pctEl = el.querySelector('.pm-hcell-pct') as HTMLElement | null;
      const ratioEl = el.querySelector('.pm-hcell-ratio') as HTMLElement | null;
      if (pctEl) {
        pctEl.textContent = `${cell.percent}%`;
        pctEl.style.color = cellFg(cell.percent);
      }
      if (ratioEl) {
        ratioEl.textContent = `${cell.completeCount}/${cell.totalCount}`;
      }
    }
  }
}

function patchBar(): void {
  if (!container) return;

  const pillSpan = container.querySelector('.pm-push-pill span');
  if (pillSpan && snapshot) {
    pillSpan.textContent = `${snapshot.progress.percent}%`;
  }

  const metaEl = container.querySelector('.pm-meta');
  if (metaEl) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    metaEl.textContent = `Updated ${timeStr} - #${pollCount}`;
  }
}

// ── Drill-Down ────────────────────────────────────────────────────

function renderDrillDown(branchLabel: string, tier: number | null): void {
  const drillEl = container?.querySelector('#pm-drill') as HTMLElement | null;
  if (!drillEl) return;

  const items = getConcernItems(branchLabel, tier);
  if (items.length === 0) {
    drillEl.innerHTML = '';
    return;
  }

  const title = tier !== null ? `${branchLabel} - T${tier}` : branchLabel;

  // group by concern, preserving insertion order
  const groups = new Map<Concern, ConcernItem[]>();
  for (const item of items) {
    let group = groups.get(item.concern);
    if (!group) {
      group = [];
      groups.set(item.concern, group);
    }
    group.push(item);
  }

  const columns = CONCERN_ORDER.filter((c) => groups.has(c))
    .map((concern) => {
      const groupItems = groups.get(concern);
      if (!groupItems || groupItems.length === 0) return '';

      const complete = groupItems.filter((i) => i.deficit === 0).length;
      const pct = Math.round((complete / groupItems.length) * 100);
      const color = CONCERN_COLORS[concern];
      const maxDeficit = groupItems.reduce((max, i) => Math.max(max, i.deficit), 0);

      return `<div class="pm-dc">
        <div class="pm-dc-hdr" style="border-left-color:${color};color:${color}">
          <span>${concern}</span>
          <span>${pct}%</span>
        </div>
        ${groupItems.map((item) => renderConcernItem(item, maxDeficit)).join('')}
      </div>`;
    })
    .join('');

  drillEl.innerHTML = `
    <div class="pm-drill">
      <div class="pm-drill-bar">
        <span class="pm-drill-title">${title}</span>
        <button class="pm-drill-close" id="pm-drill-close">esc</button>
      </div>
      <div class="pm-drill-body">${columns}</div>
    </div>`;

  const closeBtn = drillEl.querySelector('#pm-drill-close');
  if (closeBtn) closeBtn.addEventListener('click', closeDrill);
}

function renderConcernItem(item: ConcernItem, maxDeficit: number): string {
  const status = item.deficit === 0 ? 'd' : item.have === 0 ? 'm' : 'p';
  const barWidth = maxDeficit > 0 ? Math.round((item.deficit / maxDeficit) * 100) : 0;
  const value = item.deficit === 0 ? '\u2713' : `-${formatCompact(item.deficit)}`;
  const frac = `${formatCompact(item.have)}/${formatCompact(item.required)}`;
  const barColor = status === 'm' ? 'var(--status-missing)' : 'var(--status-partial)';

  return `<div class="pm-di pm-di-${status}">
    <div class="pm-di-bar" style="width:${barWidth}%;background:${barColor}"></div>
    <span class="pm-di-name">${item.shortName}</span>
    <span class="pm-di-val">${value} <span class="pm-di-frac">${frac}</span></span>
  </div>`;
}

function closeDrill(): void {
  drillBranch = null;
  drillTier = null;
  const drillEl = container?.querySelector('#pm-drill') as HTMLElement | null;
  if (drillEl) drillEl.innerHTML = '';
}

// ── Event Wiring ──────────────────────────────────────────────────

function activateCell(branch: string, tier: number): void {
  drillBranch = branch;
  drillTier = tier;
  renderDrillDown(branch, tier);
}

function activateLabel(branch: string): void {
  drillBranch = branch;
  drillTier = null;
  renderDrillDown(branch, null);
}

function wireHeatmap(): void {
  if (!container) return;

  // Click handlers for cells and labels
  container.querySelectorAll<HTMLElement>('.pm-hcell:not(.pm-hcell-empty)').forEach((cell) => {
    cell.addEventListener('click', () => {
      const branch = cell.dataset.branch;
      const tierStr = cell.dataset.tier;
      if (!branch || !tierStr) return;
      activateCell(branch, parseInt(tierStr, 10));
    });
  });

  container.querySelectorAll<HTMLElement>('.pm-label').forEach((label) => {
    label.addEventListener('click', () => {
      const branch = label.dataset.branch;
      if (!branch) return;
      activateLabel(branch);
    });
  });

  // Keyboard: arrow navigation on the grid, Enter to activate, Escape to close
  const grid = container.querySelector('#pm-grid');
  if (grid) wireGridKeyboard(grid as HTMLElement);
}

// Arrow keys move focus between focusable grid children (labels + cells).
function wireGridKeyboard(grid: HTMLElement): void {
  grid.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;

    if (e.key === 'Escape' && drillBranch !== null) {
      e.preventDefault();
      closeDrill();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (target.classList.contains('pm-label')) {
        const branch = target.dataset.branch;
        if (branch) activateLabel(branch);
      } else if (
        target.classList.contains('pm-hcell') &&
        !target.classList.contains('pm-hcell-empty')
      ) {
        const branch = target.dataset.branch;
        const tierStr = target.dataset.tier;
        if (branch && tierStr) activateCell(branch, parseInt(tierStr, 10));
      }
      return;
    }

    // Arrow key navigation
    const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (!arrows.includes(e.key)) return;
    e.preventDefault();

    const focusable = Array.from(
      grid.querySelectorAll<HTMLElement>('.pm-label, .pm-hcell:not(.pm-hcell-empty)')
    );
    const idx = focusable.indexOf(target);
    if (idx === -1) return;

    // Figure out column count from the grid style
    const colStyle = grid.style.gridTemplateColumns;
    // Format: "80px repeat(N, 1fr)" -- extract N, add 1 for the label column
    const repeatMatch = colStyle.match(/repeat\((\d+)/);
    const dataCols = repeatMatch ? parseInt(repeatMatch[1], 10) : 1;
    const totalCols = dataCols + 1; // label column + data columns

    // building a position map from data attributes.
    let next = -1;
    if (e.key === 'ArrowRight') next = idx + 1;
    if (e.key === 'ArrowLeft') next = idx - 1;
    if (e.key === 'ArrowDown') next = findVerticalNeighbor(focusable, idx, totalCols, 1);
    if (e.key === 'ArrowUp') next = findVerticalNeighbor(focusable, idx, totalCols, -1);

    if (next >= 0 && next < focusable.length) {
      focusable[next].focus();
    }
  });
}

// Find the focusable element in the same column, one row away.
// Since the focusable list may have gaps (empty cells skipped),
// Couldn't just add a fixed offset. Instead, now find the next element's
// grid column position matches, scanning in the given direction.
function findVerticalNeighbor(
  focusable: HTMLElement[],
  currentIdx: number,
  _totalCols: number,
  direction: 1 | -1
): number {
  const current = focusable[currentIdx];
  const currentCol = getGridCol(current);

  for (let i = currentIdx + direction; i >= 0 && i < focusable.length; i += direction) {
    if (getGridCol(focusable[i]) === currentCol) return i;
  }
  return currentIdx;
}

// Determine which grid column an element occupies based on its data attributes.
// Labels are always column 0, cells are column (tier - minTier + 1).
function getGridCol(el: HTMLElement): number {
  if (el.classList.contains('pm-label')) return 0;
  const tier = parseInt(el.dataset.tier || '0', 10);
  // All cells with the same tier value are in the same column
  return tier;
}
