/**
 * Logger utility module
 *
 * Provides leveled logging with timestamps, module namespacing,
 * structured data output, and performance timing.
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3, none: 4 };
const startTime = performance.now();
let currentLevel = LOG_LEVELS.info;

// ----------------------------------------------------------------------------
// Core
// ----------------------------------------------------------------------------

function timestamp() {
    const ms = Math.round(performance.now() - startTime);
    return `+${ms}ms`;
}

function formatPrefix(module) {
    return module ? `[${module}]` : '';
}

export function setLogLevel(level) {
    currentLevel = LOG_LEVELS[level] ?? LOG_LEVELS.info;
}

export function getLogLevel() {
    return Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === currentLevel);
}

// ----------------------------------------------------------------------------
// Log functions
// ----------------------------------------------------------------------------

export function debug(prefix, ...args) {
    if (currentLevel <= LOG_LEVELS.debug) {
        console.debug(timestamp(), formatPrefix(prefix), ...args);
    }
}

export function info(prefix, ...args) {
    if (currentLevel <= LOG_LEVELS.info) {
        console.info(timestamp(), formatPrefix(prefix), ...args);
    }
}

export function warn(prefix, ...args) {
    if (currentLevel <= LOG_LEVELS.warn) {
        console.warn(timestamp(), formatPrefix(prefix), ...args);
    }
}

export function error(prefix, ...args) {
    if (currentLevel <= LOG_LEVELS.error) {
        console.error(timestamp(), formatPrefix(prefix), ...args);
    }
}

export function data(prefix, label, obj) {
    if (currentLevel <= LOG_LEVELS.debug) {
        console.debug(timestamp(), formatPrefix(prefix), label);
        console.dir(obj, { depth: 3 });
    }
}

// ----------------------------------------------------------------------------
// Factory for namespaced loggers
// ----------------------------------------------------------------------------

export function createLogger(module) {
    return {
        debug: (...args) => debug(module, ...args),
        info: (...args) => info(module, ...args),
        warn: (...args) => warn(module, ...args),
        error: (...args) => error(module, ...args),
        data: (label, obj) => data(module, label, obj),
        time: (label) => {
            const start = performance.now();
            return () => {
                const ms = (performance.now() - start).toFixed(1);
                debug('PERF', `${module}:${label} ${ms}ms`);
            };
        }
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
