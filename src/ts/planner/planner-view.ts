/**
 * Planner View - All planner chrome in one place
 *
 * Owns: tier controls, view tabs, progress, copy buttons,
 *       research tabs, hide-complete toggle.
 * Delegates: dashboard rendering, flowchart viewport rendering.
 */

import {
  calculatePlanProgress,
  generatePlanExportText,
  generateBranchExportText,
} from './lib/progress-calc.js';
import * as PlannerDashboard from './planner-dashboard.js';
import * as Flowchart from './flowchart.js';
import { TIER_REQUIREMENTS } from '../configuration/index.js';
import type { ProcessedNode, PlanItem } from '../types/index.js';
import { applyTabA11y } from '../aria.js';
import { generateTreeCSV } from './lib/tree-csv.js';

// ── Types ─────────────────────────────────────────────────────────

type ViewMode = 'dashboard' | 'flowchart';

/** Everything planner-view needs from planner.ts to render. */
export interface PlannerViewConfig {
  researches: ProcessedNode[];
  planItems: PlanItem[];
  targetTier: number;
  studyJournals: ProcessedNode | null;
  tierOptions: number[];
  currentTier: number;
  codexCount: number;
  codexInfo: string;
  onTierChange: (tier: number, count: number) => void;
}

// ── Module state ──────────────────────────────────────────────────

let currentView: ViewMode = 'dashboard';
let activeResearchIndex = 0;
let hideComplete = false;
let wireAbort: AbortController | null = null;

// Cached from last render() call
let cachedResearches: ProcessedNode[] = [];
let cachedPlanItems: PlanItem[] = [];
let cachedTargetTier = 0;
let cachedStudyJournals: ProcessedNode | null = null;
let cachedOnTierChange: ((tier: number, count: number) => void) | null = null;

// ── Public API ────────────────────────────────────────────────────

/**
 * Render the full planner view: toolbar, research bar, and content area.
 */
export function render(container: HTMLElement, config: PlannerViewConfig): void {
  // fix 25-02-26: set 0 to reset tier-specific view state
  activeResearchIndex = 0;
  currentView = 'dashboard';
  cachedResearches = config.researches;
  cachedPlanItems = config.planItems;
  cachedTargetTier = config.targetTier;
  cachedStudyJournals = config.studyJournals;
  cachedOnTierChange = config.onTierChange;

  if (!config.researches || config.researches.length === 0) {
    container.innerHTML = '<div class="pv-empty">No data</div>';
    return;
  }

  const progress = calculatePlanProgress(config.planItems);

  container.innerHTML = `
    <div class="pv-container">
      <div class="pv-toolbar">
        <div class="pv-toolbar-left">
          <select id="pv-tier" class="pv-select">
            ${config.tierOptions.map((t) => `<option value="${t}" ${t === config.currentTier ? 'selected' : ''}>T${t}</option>`).join('')}
          </select>
          <span class="pv-multiply">×</span>
          <input type="number" id="pv-count" class="pv-count-input"
                 value="${config.codexCount}" min="1" max="100">
          <span class="pv-codex-info">${config.codexInfo}</span>
        </div>
        <div class="pv-toolbar-center">
          <div class="pv-tabs">
            <button class="pv-tab active" data-view="dashboard">Tasks</button>
            <button class="pv-tab" data-view="flowchart">Tree</button>
          </div>
          <div class="pv-progress-inline">
            <span class="pv-pct">${progress.percent}%</span>
            <div class="pv-progress-bar-mini">
              <div class="pv-progress-fill-mini" style="width: ${progress.percent}%"></div>
            </div>
            <span class="pv-stats-mini">${progress.completeCount}/${progress.totalItems}</span>
          </div>
        </div>
        <div class="pv-toolbar-right">
          <button class="pv-copy" id="pv-copy-view" title="Copy current view">&#128203;</button>
          <button class="pv-copy" id="pv-copy-all" title="Copy all">All</button>
          <button class="pv-copy" id="pv-export-csv" title="Export CSV">CSV</button>
        </div>
      </div>

      <div class="pv-research-bar hidden" id="pv-research-bar">
        <div class="pv-research-tabs" id="pv-research-tabs"></div>
        <label class="pv-toggle">
          <input type="checkbox" id="pv-hide-complete" ${hideComplete ? 'checked' : ''}>
          <span>Hide done</span>
        </label>
      </div>

      <div class="pv-content" id="pv-content"></div>
    </div>
  `;

  const contentEl = container.querySelector('#pv-content') as HTMLElement;
  wireEvents(container, contentEl);
  renderResearchTabs(container);
  renderContent(contentEl);
}

export function renderLoading(container: HTMLElement): void {
  container.innerHTML = '<div class="pv-loading">Calculating...</div>';
}

export function renderEmpty(container: HTMLElement): void {
  container.innerHTML = '<div class="pv-empty">Select a target tier</div>';
}

// ── Event wiring ──────────────────────────────────────────────────

function wireEvents(container: HTMLElement, contentEl: HTMLElement): void {
  // Tear down all listeners from previous render
  wireAbort?.abort();
  wireAbort = new AbortController();
  const { signal } = wireAbort;

  // -- Tier select --
  container.querySelector('#pv-tier')?.addEventListener(
    'change',
    (e) => {
      const tier = parseInt((e.target as HTMLSelectElement).value, 10);
      const req = TIER_REQUIREMENTS[tier];
      const count = req?.count || 20;
      const countInput = container.querySelector('#pv-count') as HTMLInputElement;
      if (countInput) countInput.value = String(count);
      updateCodexInfo(container, tier, count);
      cachedOnTierChange?.(tier, count);
    },
    { signal }
  );

  // -- Codex count --
  container.querySelector('#pv-count')?.addEventListener(
    'change',
    (e) => {
      const tier = parseInt(
        (container.querySelector('#pv-tier') as HTMLSelectElement)?.value || '6',
        10
      );
      const count = parseInt((e.target as HTMLInputElement).value, 10) || 1;
      updateCodexInfo(container, tier, count);
      cachedOnTierChange?.(tier, count);
    },
    { signal }
  );

  // -- View tabs --
  container.querySelectorAll<HTMLElement>('.pv-tab').forEach((tab) => {
    tab.addEventListener(
      'click',
      () => {
        const view = tab.dataset.view as ViewMode;
        if (view === currentView) return;

        currentView = view;
        container.querySelectorAll('.pv-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        renderContent(contentEl);
      },
      { signal }
    );
  });

  // -- Copy view (respects current view context) --
  container.querySelector('#pv-copy-view')?.addEventListener(
    'click',
    () => {
      let text: string;

      if (currentView === 'flowchart') {
        const allTabs = [...cachedResearches];
        if (cachedStudyJournals) allTabs.push(cachedStudyJournals);
        const branch = allTabs[activeResearchIndex];
        text = branch
          ? generateBranchExportText(cachedPlanItems, cachedTargetTier, branch)
          : generatePlanExportText(cachedPlanItems, cachedTargetTier);
      } else {
        const dashText = PlannerDashboard.generateDashboardText();
        text = dashText || generatePlanExportText(cachedPlanItems, cachedTargetTier);
      }

      copyWithFeedback(text, container.querySelector('#pv-copy-view') as HTMLElement);
    },
    { signal }
  );

  // -- Copy all (full plan, ignores filters) --
  container.querySelector('#pv-copy-all')?.addEventListener(
    'click',
    () => {
      const text =
        currentView === 'dashboard'
          ? PlannerDashboard.generateFullText() ||
            generatePlanExportText(cachedPlanItems, cachedTargetTier)
          : generatePlanExportText(cachedPlanItems, cachedTargetTier);
      copyWithFeedback(text, container.querySelector('#pv-copy-all') as HTMLElement);
    },
    { signal }
  );

  // -- CSV export (full plan, all items) --
  container.querySelector('#pv-export-csv')?.addEventListener(
    'click',
    () => {
      const csv = generateTreeCSV(cachedResearches, cachedStudyJournals);
      downloadCSV(csv, `planner-t${cachedTargetTier}-requirements.csv`);
    },
    { signal }
  );

  // -- Research tabs (delegated — tabs are rendered dynamically) --
  container.addEventListener(
    'click',
    (e) => {
      const tab = (e.target as HTMLElement).closest('.pv-rtab') as HTMLElement;
      if (!tab) return;
      const index = parseInt(tab.dataset.index || '0', 10);
      if (index === activeResearchIndex) return;

      activeResearchIndex = index;
      container.querySelectorAll('.pv-rtab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      renderContent(contentEl);
    },
    { signal }
  );

  // -- Hide complete toggle --
  container.querySelector('#pv-hide-complete')?.addEventListener(
    'change',
    (e) => {
      hideComplete = (e.target as HTMLInputElement).checked;
      renderContent(contentEl);
    },
    { signal }
  );
}

// ── Content rendering ─────────────────────────────────────────────

function renderContent(container: HTMLElement): void {
  const researchBar = document.getElementById('pv-research-bar');
  if (researchBar) {
    researchBar.classList.toggle('hidden', currentView !== 'flowchart');
  }

  if (currentView === 'dashboard') {
    PlannerDashboard.render(container, cachedPlanItems, cachedTargetTier);
  } else {
    Flowchart.render(container, {
      researches: cachedResearches,
      studyJournals: cachedStudyJournals,
      activeResearchIndex,
      hideComplete,
    });
  }
}

// ── Research tabs ─────────────────────────────────────────────────

function renderResearchTabs(container: HTMLElement): void {
  const tabsEl = container.querySelector('#pv-research-tabs');
  if (!tabsEl || !cachedResearches.length) return;

  const allTabs = [...cachedResearches];
  if (cachedStudyJournals) {
    allTabs.push({ ...cachedStudyJournals, name: 'Study Journals' });
  }

  tabsEl.innerHTML = allTabs
    .map((r, i) => {
      const name = formatTabName(r.name);
      const isJournals = i >= cachedResearches.length;
      return `
      <button class="pv-rtab ${i === activeResearchIndex ? 'active' : ''} ${isJournals ? 'pv-rtab-journals' : ''}"
              data-index="${i}">
        <span class="fc-tab-status ${r.status || ''}"></span>
        ${name}
      </button>
    `;
    })
    .join('');

  const tabContainer = container.querySelector<HTMLElement>('.pv-research-tabs');
  if (tabContainer) applyTabA11y(tabContainer, '.pv-rtab');
}

// ── Helpers ───────────────────────────────────────────────────────

function formatTabName(name: string): string {
  return name
    .replace(' Research', '')
    .replace(' Codex', '')
    .replace(/^(Novice|Apprentice|Journeyman|Expert|Master|Proficient) /, '');
}

function updateCodexInfo(container: HTMLElement, tier: number, count: number): void {
  const infoEl = container.querySelector('.pv-codex-info');
  if (!infoEl) return;
  const req = TIER_REQUIREMENTS[tier];
  if (!req) return;
  const custom = count !== req.count ? ' (custom)' : '';
  infoEl.textContent = `${count}\u00d7 T${req.codexTier} Codex${custom}`;
}

function copyWithFeedback(text: string, btn: HTMLElement): void {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = '&#10003;';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerHTML = original;
      btn.classList.remove('copied');
    }, 1500);
  });
}

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
