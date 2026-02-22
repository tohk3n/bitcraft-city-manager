import { KeyboardKey } from './types/index.js';

/**
 * Layer ARIA tab roles + keyboard nav onto a tab group.
 * Doesn't own switching — piggybacks on existing click handlers via .click().
 */
export function applyTabA11y(container: HTMLElement, tabSelector: string): void {
  if (container.dataset.a11y) return; // already wired, skip
  container.dataset.a11y = '1';

  container.setAttribute('role', 'tablist');

  const syncAll = (): void => {
    const tabs = container.querySelectorAll<HTMLElement>(tabSelector);
    tabs.forEach((tab) => {
      tab.setAttribute('role', 'tab');
      const isActive = tab.classList.contains('active');
      tab.setAttribute('aria-selected', String(isActive));
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });
  };

  syncAll();

  // Re-sync after clicks (fires after existing handlers set .active)
  container.addEventListener('click', syncAll);

  // Arrow keys cycle, Home/End jump, Enter/Space handled natively by <button>
  container.addEventListener('keydown', (e: KeyboardEvent) => {
    const tabs = Array.from(container.querySelectorAll<HTMLElement>(tabSelector));
    const current = tabs.findIndex((t) => t.classList.contains('active'));
    if (current === -1) return;

    let target: number | null = null;

    switch (e.key) {
      case KeyboardKey.ArrowRight:
        target = (current + 1) % tabs.length;
        break;
      case KeyboardKey.ArrowLeft:
        target = current === 0 ? tabs.length - 1 : current - 1;
        break;
      case KeyboardKey.Home:
        target = 0;
        break;
      case KeyboardKey.End:
        target = tabs.length - 1;
        break;
      default:
        return; // don't preventDefault on unrelated keys
    }

    e.preventDefault();
    tabs[target].click(); // delegate to existing handler
    tabs[target].focus(); // move focus to new tab
  });
}
