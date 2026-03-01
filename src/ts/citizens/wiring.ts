// Event wiring, connects DOM events to state changes and repaints.
//
// Each wire function handles one view. They share a pattern: find elements,
// attach listeners, call paint() on state change. The paint callback is
// injected so wiring doesn't import the orchestrator (avoids circular deps).

import type { ViewState, ActivityThreshold, SortField } from '../types/citizens.js';

type PaintFn = () => void;

// --- Roster wiring ---

export function wireRoster(el: HTMLElement, viewState: ViewState, paint: PaintFn): void {
  wireSearch(el, viewState, paint);
  wireFilters(el, viewState, paint);
  wireViewToggle(el, viewState, 'matrix', paint);
  wireRowClicks(el, viewState, 'roster', paint);
}

// --- Matrix wiring ---

export function wireMatrix(el: HTMLElement, viewState: ViewState, paint: PaintFn): void {
  wireSearch(el, viewState, paint);
  wireFilters(el, viewState, paint);
  wireViewToggle(el, viewState, 'roster', paint);
  wireColumnSort(el, viewState, paint);
  wireRowClicks(el, viewState, 'matrix', paint);
}

// --- Detail wiring ---

export function wireDetail(el: HTMLElement, viewState: ViewState, paint: PaintFn): void {
  el.querySelector<HTMLButtonElement>('#cz-back')?.addEventListener('click', () => {
    viewState.view = viewState.previousListView;
    viewState.selectedId = null;
    paint();
  });

  el.querySelectorAll<HTMLButtonElement>('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id || '';
      navigator.clipboard.writeText(id).then(() => {
        const original = btn.textContent;
        btn.textContent = '✔';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1500);
      });
    });
  });
}

// --- Shared pieces ---

function wireSearch(el: HTMLElement, viewState: ViewState, paint: PaintFn): void {
  const search = el.querySelector<HTMLInputElement>('#cz-search');
  if (!search) return;
  search.addEventListener('input', () => {
    viewState.search = search.value;
    paint();
  });
  search.focus();
}

function wireFilters(el: HTMLElement, viewState: ViewState, paint: PaintFn): void {
  el.querySelector<HTMLSelectElement>('#cz-activity')?.addEventListener('change', (e) => {
    viewState.activityDays = parseInt(
      (e.target as HTMLSelectElement).value,
      10
    ) as ActivityThreshold;
    paint();
  });

  el.querySelector<HTMLSelectElement>('#cz-sort')?.addEventListener('change', (e) => {
    viewState.sortBy = (e.target as HTMLSelectElement).value as SortField;
    viewState.matrixSortSkill = null; // reset column sort when changing base sort
    paint();
  });
}

function wireViewToggle(
  el: HTMLElement,
  viewState: ViewState,
  targetView: 'roster' | 'matrix',
  paint: PaintFn
): void {
  el.querySelector('#cz-view-toggle')?.addEventListener('click', () => {
    viewState.view = targetView;
    viewState.matrixSortSkill = null;
    paint();
  });
}

function wireColumnSort(el: HTMLElement, viewState: ViewState, paint: PaintFn): void {
  el.querySelectorAll<HTMLElement>('.mx-th-skill').forEach((th) => {
    th.addEventListener('click', () => {
      const skillId = parseInt(th.dataset.skill || '0', 10);
      if (viewState.matrixSortSkill === skillId) {
        viewState.matrixSortDir = viewState.matrixSortDir === 'desc' ? 'asc' : 'desc';
      } else {
        viewState.matrixSortSkill = skillId;
        viewState.matrixSortDir = 'desc';
      }
      paint();
    });
  });
}

function wireRowClicks(
  el: HTMLElement,
  viewState: ViewState,
  sourceView: 'roster' | 'matrix',
  paint: PaintFn
): void {
  const selector = sourceView === 'matrix' ? '.mx-row' : '.cz-member-row';
  el.querySelectorAll<HTMLElement>(selector).forEach((row) => {
    row.addEventListener('click', () => {
      viewState.selectedId = row.dataset.id || null;
      viewState.previousListView = sourceView;
      viewState.view = 'detail';
      paint();
    });
  });
}
