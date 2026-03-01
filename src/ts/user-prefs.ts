/**
 * User Preferences — localStorage-backed settings
 *
 * One module owns all 'bcm-*' keys. Views read on render,
 * CSS custom properties make changes immediate without re-render.
 */

import { createLogger } from './logger.js';

const log = createLogger('Prefs');

export type FontSize = 'sm' | 'md' | 'lg';

const FONT_PX: Record<FontSize, number> = { sm: 11, md: 13, lg: 15 };
const KEYS = { FONT_SIZE: 'bcm-font-size' } as const;

function isValidFontSize(v: string | null): v is FontSize {
  return v === 'sm' || v === 'md' || v === 'lg';
}

export function getFontSize(): FontSize {
  const stored = localStorage.getItem(KEYS.FONT_SIZE);
  return isValidFontSize(stored) ? stored : 'md';
}

export function setFontSize(size: FontSize): void {
  localStorage.setItem(KEYS.FONT_SIZE, size);
  applyFontSize(size);
  log.debug(`Font size: ${size} (${FONT_PX[size]}px)`);
}

function applyFontSize(size: FontSize): void {
  document.documentElement.style.setProperty('--user-font-size', `${FONT_PX[size]}px`);
}

// Apply all stored preferences to the document. Call once on startup.
export function applyAll(): void {
  applyFontSize(getFontSize());
}
