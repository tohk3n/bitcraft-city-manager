/**
 * Font Size Control — S / M / L toggle for planner content
 *
 * Renders a button group, wires click handlers.
 * Uses term-btn from _common.scss so it looks native.
 */

import { getFontSize, setFontSize, type FontSize } from './user-prefs.js';

const SIZES: { key: FontSize; label: string }[] = [
  { key: 'sm', label: 'S' },
  { key: 'md', label: 'M' },
  { key: 'lg', label: 'L' },
];

export function renderFontSizeControl(): string {
  const current = getFontSize();
  return `
    <div class="pv-font-size" role="radiogroup" aria-label="Font size">
      ${SIZES.map(
        ({ key, label }) =>
          `<button class="term-btn pv-font-btn${key === current ? ' active' : ''}"
                  data-font-size="${key}"
                  role="radio"
                  aria-checked="${key === current}"
          >${label}</button>`
      ).join('')}
    </div>`;
}

export function wireFontSizeControl(container: HTMLElement): void {
  container.querySelectorAll<HTMLButtonElement>('.pv-font-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const size = btn.dataset.fontSize as FontSize;
      if (!size) return;

      setFontSize(size);

      // Update active state across the group
      container.querySelectorAll<HTMLButtonElement>('.pv-font-btn').forEach((b) => {
        const isActive = b.dataset.fontSize === size;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-checked', String(isActive));
      });
    });
  });
}
