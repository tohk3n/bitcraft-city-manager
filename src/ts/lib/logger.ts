/**
 * Logger utility module
 *
 * Provides leveled logging with timestamps, module namespacing,
 * structured data output, and performance timing.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, none: 4 };
const startTime = performance.now();
let currentLevel = LOG_LEVELS.info;

// ----------------------------------------------------------------------------
// Core
// ----------------------------------------------------------------------------

function timestamp(): string {
  const ms = Math.round(performance.now() - startTime);
  return `+${ms}ms`;
}

function formatPrefix(module: string): string {
  return module ? `[${module}]` : '';
}

export function setLogLevel(level: LogLevel): void {
  currentLevel = LOG_LEVELS[level] ?? LOG_LEVELS.info;
}

export function getLogLevel(): LogLevel | undefined {
  return (Object.keys(LOG_LEVELS) as LogLevel[]).find((k) => LOG_LEVELS[k] === currentLevel);
}

// ----------------------------------------------------------------------------
// Log functions
// ----------------------------------------------------------------------------

export function debug(prefix: string, ...args: unknown[]): void {
  if (currentLevel <= LOG_LEVELS.debug) {
    console.debug(timestamp(), formatPrefix(prefix), ...args);
  }
}

export function info(prefix: string, ...args: unknown[]): void {
  if (currentLevel <= LOG_LEVELS.info) {
    console.info(timestamp(), formatPrefix(prefix), ...args);
  }
}

export function warn(prefix: string, ...args: unknown[]): void {
  if (currentLevel <= LOG_LEVELS.warn) {
    console.warn(timestamp(), formatPrefix(prefix), ...args);
  }
}

export function error(prefix: string, ...args: unknown[]): void {
  if (currentLevel <= LOG_LEVELS.error) {
    console.error(timestamp(), formatPrefix(prefix), ...args);
  }
}

export function data(prefix: string, label: string, obj: unknown): void {
  if (currentLevel <= LOG_LEVELS.debug) {
    console.debug(timestamp(), formatPrefix(prefix), label);
    console.dir(obj, { depth: 3 });
  }
}

// ----------------------------------------------------------------------------
// Factory for namespaced loggers
// ----------------------------------------------------------------------------

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  data: (label: string, obj: unknown) => void;
  time: (label: string) => () => void;
}

export function createLogger(module: string): Logger {
  return {
    debug: (...args: unknown[]) => debug(module, ...args),
    info: (...args: unknown[]) => info(module, ...args),
    warn: (...args: unknown[]) => warn(module, ...args),
    error: (...args: unknown[]) => error(module, ...args),
    data: (label: string, obj: unknown) => data(module, label, obj),
    time: (label: string) => {
      const start = performance.now();
      return () => {
        const ms = (performance.now() - start).toFixed(1);
        debug('PERF', `${module}:${label} ${ms}ms`);
      };
    },
  };
}

// ----------------------------------------------------------------------------
// Auto-init from URL
// ----------------------------------------------------------------------------

const params = new URLSearchParams(window.location.search);
if (params.has('debug')) {
  setLogLevel('debug');
  console.info(timestamp(), '[Logger]', 'Debug mode enabled via URL param');
}
