/**
 * Planner View - Orchestrates dashboard and flowchart tabs
 *
 * Simple coordinator: manages tab state and delegates rendering.
 * Provides both filtered and full copy options.
 */

import { generateExportText, generateCSV } from './lib/progress-calc.js';
import * as PlannerDashboard from './planner-dashboard.js';
import * as Flowchart from './flowchart.js';
import type { ProcessedNode, ProgressReport } from '../types/index.js';

type ViewMode = 'dashboard' | 'flowchart';

// Module state
let currentView: ViewMode = 'dashboard';
let cachedResearches: ProcessedNode[] = [];
let cachedReport: (ProgressReport & { targetTier: number }) | null = null;
let cachedStudyJournals: ProcessedNode | null = null;

/**
 * Render the planner view with tab switching.
 */
export function render(
  container: HTMLElement,
  researches: ProcessedNode[],
  report: ProgressReport & { targetTier: number },
  studyJournals: ProcessedNode | null = null
): void {
  cachedResearches = researches;
  cachedReport = report;
  cachedStudyJournals = studyJournals;

  if (!researches || researches.length === 0) {
    container.innerHTML = '<div class="pv-empty">No data</div>';
    return;
  }

  const { overall } = report;

  container.innerHTML = `
        <div class="pv-container">
            <div class="pv-toolbar">
                <div class="pv-toolbar-left">
                    <div class="pv-tabs">
                        <button class="pv-tab ${currentView === 'dashboard' ? 'active' : ''}" data-view="dashboard">Tasks</button>
                        <button class="pv-tab ${currentView === 'flowchart' ? 'active' : ''}" data-view="flowchart">Tree</button>
                    </div>
                    <div class="pv-progress-inline">
                        <span class="pv-pct">${overall.percent}%</span>
                        <div class="pv-progress-bar-mini">
                            <div class="pv-progress-fill-mini" style="width: ${overall.percent}%"></div>
                        </div>
                        <span class="pv-stats-mini">${overall.completeCount}/${overall.totalItems}</span>
                    </div>
                </div>
                <div class="pv-toolbar-right">
                    <button class="pv-copy" id="pv-copy-view" title="Copy current view">📋</button>
                    <button class="pv-copy" id="pv-copy-all" title="Copy all">All</button>
                    <button class="pv-copy" id="pv-export-csv" title="Export CSV">CSV</button>
                </div>
            </div>
            <div class="pv-content" id="pv-content"></div>
        </div>
    `;

  const contentEl = container.querySelector('#pv-content') as HTMLElement;
  wireEvents(container, contentEl, report);
  renderContent(contentEl);
}

/**
 * Wire up all event handlers.
 */
function wireEvents(
  container: HTMLElement,
  contentEl: HTMLElement,
  report: ProgressReport & { targetTier: number }
): void {
  // Tab switching
  container.querySelectorAll<HTMLElement>('.pv-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view as ViewMode;
      if (view === currentView) return;

      currentView = view;
      container.querySelectorAll('.pv-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      renderContent(contentEl);
    });
  });

  // Copy View - respects current filters
  container.querySelector('#pv-copy-view')?.addEventListener('click', () => {
    const text =
      currentView === 'dashboard'
        ? PlannerDashboard.generateDashboardText()
        : generateExportText(report, report.targetTier);
    copyWithFeedback(text, container.querySelector('#pv-copy-view') as HTMLElement);
  });

  // Copy All - ignores filters
  container.querySelector('#pv-copy-all')?.addEventListener('click', () => {
    const text =
      currentView === 'dashboard'
        ? PlannerDashboard.generateFullText()
        : generateExportText(report, report.targetTier);
    copyWithFeedback(text, container.querySelector('#pv-copy-all') as HTMLElement);
  });

  // CSV Export
  container.querySelector('#pv-export-csv')?.addEventListener('click', () => {
    const csv = generateCSV(report, report.targetTier);
    downloadCSV(csv, `planner-t${report.targetTier}-requirements.csv`);
  });
}

/**
 * Render the active view.
 */
function renderContent(container: HTMLElement): void {
  if (!cachedReport) return;

  if (currentView === 'dashboard') {
    PlannerDashboard.render(container, cachedReport);
  } else {
    Flowchart.render(container, cachedResearches, cachedReport, cachedStudyJournals);
  }
}

/**
 * Copy text and show feedback.
 */
function copyWithFeedback(text: string, btn: HTMLElement): void {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = '✓';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerHTML = original;
      btn.classList.remove('copied');
    }, 1500);
  });
}

/**
 * Trigger CSV file download.
 */
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

export function renderLoading(container: HTMLElement): void {
  container.innerHTML = '<div class="pv-loading">Calculating...</div>';
}

export function renderEmpty(container: HTMLElement): void {
  container.innerHTML = '<div class="pv-empty">Select a target tier</div>';
}
