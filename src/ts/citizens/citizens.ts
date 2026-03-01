// Citizens orchestrator, state, paint loop, public API.
//
// This is the hub. It owns the view state and data, calls the right
// renderer based on current view, wires events after each paint, and
// exposes the public interface that main.ts consumes.
//
// Everything else in citizens/ is a leaf: renderers produce HTML strings,
// data functions transform data, wiring attaches event handlers. None of
// them import this file. Dependency flows one direction: orchestrator → leaves.

import { createLogger } from '../logger.js';
import { fetchCitizens, loadGear } from './data.js';
import { renderRoster } from './roster.js';
import { renderMatrix } from './matrix.js';
import { renderDetail } from './detail.js';
import { wireRoster, wireMatrix, wireDetail } from './wiring.js';
import { VIEW_DEFAULTS } from '../types/citizens.js';
import type { ViewState, CitizensData } from '../types/citizens.js';

const log = createLogger('Citizens');

// --- State ---
// Module-level. Reset on claim switch. One view state, one data blob.

const viewState: ViewState = { ...VIEW_DEFAULTS };
let data: CitizensData | null = null;

// --- Paint ---
// Full repaint on every state change. For 60-100 members this was fast.
// If it ever matters, profile first, but don't optimize on vibes, Auric.

function paint(el: HTMLElement): void {
  if (viewState.view === 'detail' && viewState.selectedId) {
    const record = data?.records.find((r) => r.entityId === viewState.selectedId);
    if (record && data) {
      el.innerHTML = renderDetail(record, data);
      wireDetail(el, viewState, () => paint(el));

      // Kick off gear loading if not cached
      if (!record.gear && !record.gearLoading) {
        loadGear(record, () => {
          if (viewState.selectedId === record.entityId) paint(el);
        });
      }
      return;
    }
    // Record not found, fall back to list
    viewState.view = viewState.previousListView;
    viewState.selectedId = null;
  }

  if (viewState.view === 'matrix') {
    el.innerHTML = renderMatrix(viewState, data);
    wireMatrix(el, viewState, () => paint(el));
  } else {
    el.innerHTML = renderRoster(viewState, data);
    wireRoster(el, viewState, () => paint(el));
  }
}

// --- Public API ---

export const CitizensUI = {
  async loadAndRender(claimId: string, cached?: CitizensData): Promise<CitizensData | null> {
    const el = document.getElementById('citizens-grid');
    if (!el) return null;

    // Always reset, prevents stale data from previous claim
    data = null;
    Object.assign(viewState, VIEW_DEFAULTS);

    if (cached) {
      data = cached;
      paint(el);
      return data;
    }

    el.innerHTML = '<p class="cz-loading">Loading members...</p>';

    try {
      data = await fetchCitizens(claimId);
      paint(el);
      return data;
    } catch (err) {
      const error = err as Error;
      log.error('Failed to load citizens:', error.message);
      el.innerHTML = `<p class="empty-state">Failed to load members: ${error.message}</p>`;
      return null;
    }
  },

  reset(): void {
    data = null;
    Object.assign(viewState, VIEW_DEFAULTS);
  },
};
