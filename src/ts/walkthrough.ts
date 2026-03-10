// Walkthrough guide — paginated modal
// First visit: starts at page 0 (welcome), walks through everything.
// Subsequent visits: opens directly to the quick reference page,
// with full navigation available if the user wants to revisit.

const STORAGE_KEY = 'bcm-walkthrough-seen';
const QUICK_REF_PAGE = 3; // last page index — the reference card

// ── DOM refs (lazy, so module can load before DOM is ready) ─────

function getElements() {
  const overlay = document.getElementById('wt-overlay');
  const body = document.getElementById('wt-body');
  const progress = document.getElementById('wt-progress');
  const prevBtn = document.getElementById('wt-prev') as HTMLButtonElement | null;
  const nextBtn = document.getElementById('wt-next') as HTMLButtonElement | null;
  const closeBtn = document.getElementById('wt-close');
  const indicator = document.getElementById('wt-page-indicator');

  if (!overlay || !body || !progress || !prevBtn || !nextBtn || !closeBtn || !indicator) {
    return null;
  }

  const pages = body.querySelectorAll<HTMLElement>('.wt-page');
  return { overlay, body, progress, prevBtn, nextBtn, closeBtn, indicator, pages };
}

// ── State ───────────────────────────────────────────────────────

let current = 0;
let initialized = false;

// ── localStorage ────────────────────────────────────────────────

function hasSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ok */
  }
}

// ── Display ─────────────────────────────────────────────────────

function show(index: number): void {
  const els = getElements();
  if (!els) return;

  const total = els.pages.length;
  current = Math.max(0, Math.min(total - 1, index));

  // Pages
  els.pages.forEach((p) => p.classList.remove('active'));
  els.pages[current].classList.add('active');

  // Progress pips
  const pips = els.progress.querySelectorAll<HTMLElement>('.wt-pip');
  pips.forEach((p, i) => {
    p.className = 'wt-pip';
    if (i < current) p.classList.add('done');
    if (i === current) p.classList.add('active');
  });

  // Nav buttons
  els.prevBtn.disabled = current === 0;

  if (current === total - 1) {
    els.nextBtn.textContent = 'close';
    els.nextBtn.classList.remove('primary');
  } else {
    els.nextBtn.textContent = 'next \u2192';
    els.nextBtn.classList.add('primary');
  }
  els.nextBtn.focus();
  els.indicator.textContent = `${current + 1} / ${total}`;
  els.body.scrollTop = 0;
}

function close(): void {
  const els = getElements();
  if (!els) return;
  els.overlay.style.display = 'none';
  markSeen();
  document.getElementById('guide-btn')?.focus();
}

export function open(startPage?: number): void {
  const els = getElements();
  if (!els) return;
  els.overlay.style.display = 'flex';
  show(startPage ?? 0);
}

export function isOpen(): boolean {
  const overlay = document.getElementById('wt-overlay');
  return overlay?.style.display === 'flex';
}

// ── Init ────────────────────────────────────────────────────────

export function initWalkthrough(): void {
  if (initialized) return;
  initialized = true;

  const els = getElements();
  if (!els) return;

  const modal = els.overlay.querySelector('.wt-modal') as HTMLElement;
  if (modal) {
    modal.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  // Build progress pips
  const total = els.pages.length;
  for (let i = 0; i < total; i++) {
    const pip = document.createElement('div');
    pip.className = 'wt-pip';
    pip.addEventListener('click', () => show(i));
    els.progress.appendChild(pip);
  }

  // Nav buttons
  els.prevBtn.addEventListener('click', () => show(current - 1));

  els.nextBtn.addEventListener('click', () => {
    const pageCount = els.pages.length;
    if (current === pageCount - 1) close();
    else show(current + 1);
  });

  els.closeBtn.addEventListener('click', close);

  // Keyboard: arrows, escape (scoped to overlay)
  els.overlay.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
    if (e.key === 'ArrowRight') show(current + 1);
    if (e.key === 'ArrowLeft') show(current - 1);
  });

  // Backdrop click
  els.overlay.addEventListener('click', (e: Event) => {
    if (e.target === els.overlay) close();
  });

  // Wire the guide button
  document.getElementById('guide-btn')?.addEventListener('click', () => {
    if (isOpen()) {
      close();
      return;
    }
    open(hasSeen() ? QUICK_REF_PAGE : 0);
  });

  // Auto-show on first visit
  if (!hasSeen()) {
    requestAnimationFrame(() => open(0));
  }
}
