/**
 * Planner View - Orchestrates dashboard and flowchart tabs
 * 
 * Simple coordinator: manages tab state and delegates rendering.
 */

import { formatCompact, generateExportText } from './lib/progress-calc.js';
import * as Dashboard from './dashboard.js';
import * as Flowchart from './flowchart.js';
import type { ProcessedNode, ProgressReport } from '../types.js';

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
    const remaining = overall.totalItems - overall.completeCount;

    container.innerHTML = `
        <div class="pv-container">
            <div class="pv-header">
                <div class="pv-summary">
                    <span class="pv-pct">${overall.percent}%</span>
                    <span class="pv-stats">${overall.completeCount}/${overall.totalItems} ready${remaining > 0 ? ` · ${remaining} to go` : ''}</span>
                </div>
                <div class="pv-tabs">
                    <button class="pv-tab ${currentView === 'dashboard' ? 'active' : ''}" data-view="dashboard">Tasks</button>
                    <button class="pv-tab ${currentView === 'flowchart' ? 'active' : ''}" data-view="flowchart">Tree</button>
                </div>
                <button class="pv-copy" id="pv-copy" title="Copy task list">&#128203; Copy</button>
            </div>
            <div class="pv-content" id="pv-content"></div>
        </div>
    `;

    const contentEl = container.querySelector('#pv-content') as HTMLElement;

    // Tab switching
    container.querySelectorAll<HTMLElement>('.pv-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const view = tab.dataset.view as ViewMode;
            if (view === currentView) return;

            currentView = view;
            container.querySelectorAll('.pv-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderContent(contentEl);
        });
    });

    // Copy button
    container.querySelector('#pv-copy')?.addEventListener('click', () => {
        const text = generateExportText(report, report.targetTier);
        const btn = container.querySelector('#pv-copy') as HTMLElement;
        navigator.clipboard.writeText(text).then(() => {
            const original = btn.innerHTML;
            btn.innerHTML = '✓ Copied';
            setTimeout(() => btn.innerHTML = original, 1500);
        });
    });

    renderContent(contentEl);
}

/**
 * Render the active view.
 */
function renderContent(container: HTMLElement): void {
    if (currentView === 'dashboard') {
        Dashboard.render(container, cachedResearches, cachedStudyJournals);
    } else {
        if (cachedReport) {
            Flowchart.render(container, cachedResearches, cachedReport, cachedStudyJournals);
        }
    }
}

export function renderLoading(container: HTMLElement): void {
    container.innerHTML = '<div class="pv-loading">Calculating...</div>';
}

export function renderEmpty(container: HTMLElement): void {
    container.innerHTML = '<div class="pv-empty">Select a target tier</div>';
}