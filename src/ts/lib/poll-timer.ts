/**
 * Poll Timer — reusable scheduling with jitter and visibility awareness.
 *
 * Owns: interval timing, ±jitter, min-poll floor, browser visibility
 *       pause/resume, stale-on-activate immediate poll.
 * Does NOT own: what gets fetched, what gets rendered, which view is active.
 *
 * Each consumer creates its own handle and calls start()/stop() when
 * their view gains or loses focus. No shared state between instances.
 */

// ── Types ─────────────────────────────────────────────────────────

export interface PollTimerConfig {
  /** Base interval between polls in ms (e.g. 60_000) */
  intervalMs: number;
  /** Random ± jitter added to each interval (e.g. 10_000) */
  jitterMs: number;
  /** Hard floor — polls closer together than this are rejected (e.g. 15_000) */
  minMs: number;
  /** On start(), poll immediately if last poll was older than this (e.g. 30_000) */
  staleAfterMs: number;
  /** The work. Errors are the caller's problem — timer keeps scheduling regardless. */
  onPoll: () => Promise<void>;
}

export interface PollTimerHandle {
  /** Begin polling. If data is stale, fires immediately; otherwise schedules next. */
  start: () => void;
  /** Stop polling, clear pending timer. Idempotent. */
  stop: () => void;
  /** True if currently in an active polling cycle. */
  isActive: () => boolean;
  /** Force immediate poll. Returns false if rejected by minMs guard. */
  pollNow: () => boolean;
}

// ── Factory ───────────────────────────────────────────────────────

export function createPollTimer(config: PollTimerConfig): PollTimerHandle {
  const { intervalMs, jitterMs, minMs, staleAfterMs, onPoll } = config;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = false;
  let lastPollTime = 0;
  let polling = false; // guard against overlapping polls

  // ── Internals ─────────────────────────────────────────────────

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function jitteredDelay(): number {
    const jitter = Math.round((Math.random() - 0.5) * 2 * jitterMs);
    return Math.max(minMs, intervalMs + jitter);
  }

  function scheduleNext(): void {
    if (!active) return;
    clearTimer();
    timer = setTimeout(doPoll, jitteredDelay());
  }

  async function doPoll(): Promise<void> {
    if (!active || polling) return;

    polling = true;
    lastPollTime = Date.now();

    try {
      await onPoll();
    } catch {
      // Caller's problem. Timer keeps going.
    } finally {
      polling = false;
      scheduleNext();
    }
  }

  function onVisibilityChange(): void {
    if (document.hidden) {
      clearTimer();
    } else if (active) {
      const elapsed = Date.now() - lastPollTime;
      if (elapsed >= intervalMs) {
        doPoll();
      } else {
        // Schedule the remaining time, not a full interval
        const remaining = intervalMs - elapsed;
        clearTimer();
        timer = setTimeout(doPoll, Math.max(minMs, remaining));
      }
    }
  }

  // ── Public API ────────────────────────────────────────────────

  function start(): void {
    if (active) return;
    active = true;

    document.addEventListener('visibilitychange', onVisibilityChange);

    const elapsed = Date.now() - lastPollTime;

    if (lastPollTime === 0 || elapsed >= staleAfterMs) {
      // Never polled, or data is stale — fire now
      doPoll();
    } else if (elapsed >= intervalMs) {
      // Past due but not stale — fire now
      doPoll();
    } else {
      // Still fresh — schedule the remainder
      const remaining = intervalMs - elapsed;
      clearTimer();
      timer = setTimeout(doPoll, Math.max(minMs, remaining));
    }
  }

  function stop(): void {
    active = false;
    clearTimer();
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }

  function isActive(): boolean {
    return active;
  }

  function pollNow(): boolean {
    if (!active) return false;

    const elapsed = Date.now() - lastPollTime;
    if (elapsed < minMs) return false;

    clearTimer();
    doPoll();
    return true;
  }

  return { start, stop, isActive, pollNow };
}
