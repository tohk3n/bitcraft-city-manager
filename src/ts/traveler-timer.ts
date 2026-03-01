/**
 * Traveler Timer — countdown to next 4-hour task reset
 *
 * Resets happen every 4 hours at UTC :00 — 00:00, 04:00, 08:00, 12:00, 16:00, 20:00.
 * Displays a terminal-style countdown in the status bar.
 * Optional "announce" mode shakes the screen when the timer hits zero.
 *
 * One interval, one DOM element, no external dependencies.
 */

import { createLogger } from './logger.js';

const log = createLogger('Traveler');

// ── Constants ───────────────────────────────────────────────────

const CYCLE_MS = 4 * 60 * 60 * 1000; // 4 hours in ms
const TICK_MS = 1000;
const ANNOUNCE_KEY = 'bcm-traveler-announce';
const SHAKE_DURATION_MS = 600;
const FLASH_DURATION_MS = 3000;

// ── State ───────────────────────────────────────────────────────

let timer: ReturnType<typeof setInterval> | null = null;
let announceEnabled = false;
let el: HTMLElement | null = null;

// ── Time Math ───────────────────────────────────────────────────

/** Ms until the next 4-hour UTC boundary. */
function msUntilReset(): number {
  const now = Date.now();
  const elapsed = now % CYCLE_MS;
  return CYCLE_MS - elapsed;
}

/** Format ms as HH:MM:SS. */
function format(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Announce ────────────────────────────────────────────────────

function loadPref(): boolean {
  try {
    return localStorage.getItem(ANNOUNCE_KEY) === '1';
  } catch {
    return false;
  }
}

function savePref(on: boolean): void {
  try {
    localStorage.setItem(ANNOUNCE_KEY, on ? '1' : '0');
  } catch {
    /* ok */
  }
}

function triggerAnnounce(): void {
  if (!announceEnabled) return;

  // Screen shake
  const root = document.querySelector('.wm-root');
  if (root) {
    root.classList.add('tt-shake');
    setTimeout(() => root.classList.remove('tt-shake'), SHAKE_DURATION_MS);
  }

  // Timer flash
  if (el) {
    el.classList.add('tt-flash');
    setTimeout(() => el?.classList.remove('tt-flash'), FLASH_DURATION_MS);
  }

  log.info('TASKS RESET');
}

// ── Tick ────────────────────────────────────────────────────────

function tick(): void {
  if (!el) return;

  const remaining = msUntilReset();

  // Fire announce when crossing the boundary (under 1 tick away)
  if (remaining > CYCLE_MS - TICK_MS - 100) {
    triggerAnnounce();
  }

  const timeEl = el.querySelector('.tt-time');
  if (timeEl) timeEl.textContent = format(remaining);
}

// ── Toggle ──────────────────────────────────────────────────────

function toggle(): void {
  announceEnabled = !announceEnabled;
  savePref(announceEnabled);
  if (el) {
    el.classList.toggle('tt-armed', announceEnabled);
    el.title = announceEnabled
      ? 'Announce ON — click to disable'
      : 'Announce OFF — click to enable';
  }
  log.debug(`Announce ${announceEnabled ? 'ON' : 'OFF'}`);
}

// ── Public API ──────────────────────────────────────────────────

export function init(): void {
  el = document.getElementById('traveler-timer');
  if (!el) {
    log.warn('Timer element not found');
    return;
  }

  announceEnabled = loadPref();
  el.classList.toggle('tt-armed', announceEnabled);
  el.title = announceEnabled ? 'Announce ON — click to disable' : 'Announce OFF — click to enable';
  el.addEventListener('click', toggle);

  // Initial render + start ticking
  tick();
  timer = setInterval(tick, TICK_MS);

  log.info(`Started (announce: ${announceEnabled ? 'ON' : 'OFF'})`);
}

export function destroy(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  el?.removeEventListener('click', toggle);
  el = null;
}
