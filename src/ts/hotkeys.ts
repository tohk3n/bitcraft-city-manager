// Global keyboard shortcuts — maps .hk underlined letters to tab clicks.
// Also: Escape to blur/close, / to focus search, scoped planner keys.
// One handler, one map per scope, no state beyond the init guard.

// ── Global tab hotkeys ──────────────────────────────────────────

const TAB_HOTKEYS: Record<string, string> = {
  i: 'inventory',
  p: 'planner',
  c: 'citizens',
  d: 'ids',
  m: 'mapLinkComposer',
  a: 'calculator',
  r: 'resourceCalculator',
};

// ── Planner scoped: t/f/o switch between Tasks, Flowchart, Monitor ──────

const PLANNER_HOTKEYS: Record<string, string> = {
  t: 'dashboard',
  f: 'flowchart',
  o: 'monitor',
};

// ── Per-view search targets for / key ───────────────────────────

const VIEW_SEARCH_TARGETS: Record<string, string> = {
  ids: 'ids-filter',
  citizens: 'cz-search',
  calculator: 'calc-item-search',
};

const HEADER_SEARCH = 'claim-input-field';

// ── Helpers ─────────────────────────────────────────────────────

function activeView(): string | null {
  return document.querySelector('#view-tabs .tab-btn.active')?.getAttribute('data-view') ?? null;
}

function isInInput(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.matches('input, textarea, select');
}

// ── Core handler ────────────────────────────────────────────────

function handleKeydown(e: KeyboardEvent): void {
  const key = e.key;

  // Escape: blur inputs or close modals — works even from inside inputs
  if (key === 'Escape') {
    if (isInInput(e.target)) {
      (e.target as HTMLElement).blur();
      e.preventDefault();
      return;
    }
    return;
  }

  // Everything below is suppressed when typing in an input
  if (isInInput(e.target)) return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  const lower = key.toLowerCase();

  // / — focus the contextual search input
  if (key === '/') {
    e.preventDefault();
    const view = activeView();
    const targetId = (view && VIEW_SEARCH_TARGETS[view]) || HEADER_SEARCH;
    const input = document.getElementById(targetId) as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.select();
    }
    return;
  }

  // Tab switching
  const view = TAB_HOTKEYS[lower];
  if (view) {
    e.preventDefault();
    document.querySelector<HTMLElement>(`#view-tabs .tab-btn[data-view="${view}"]`)?.click();
    return;
  }

  // Planner scoped: t/f switch between Tasks and Tree
  if (lower in PLANNER_HOTKEYS && activeView() === 'planner') {
    e.preventDefault();
    const pvView = PLANNER_HOTKEYS[lower];
    document.querySelector<HTMLElement>(`.pv-tab[data-view="${pvView}"]`)?.click();
    return;
  }

  // ? — guide
  if (key === '?') {
    e.preventDefault();
    document.getElementById('guide-btn')?.click();
  }
}

// ── Init / teardown ─────────────────────────────────────────────

let initialized = false;

export function initHotkeys(): void {
  if (initialized) return;
  initialized = true;
  document.addEventListener('keydown', handleKeydown);
}

/** Remove listener and reset — for tests only */
export function destroyHotkeys(): void {
  document.removeEventListener('keydown', handleKeydown);
  initialized = false;
}
