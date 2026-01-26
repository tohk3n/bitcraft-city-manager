# Logger

Something broke. Was it the API? The cascade math? The inventory lookup? 

**GOOD LUCK FINDING OUT** with `console.log` confetti.

This fixes that.

## The Using Of It

```javascript
import { createLogger } from './logger.js';

const log = createLogger('MyModule');

log.debug('the verbose stuff');
log.info('notable things');
log.warn('probably fine but suspicious');
log.error('not fine');
```

Output has timestamps and namespaces so you can actually trace what happened:

```
+125ms [API] Fetching /claims/123/inventories
+187ms [PERF] API:fetch 62.0ms
+190ms [Planner] Calculating T6 requirements
+226ms [PERF] Planner:calculateRequirements 36.0ms
```

## Debug Mode

Add `?debug` to the URL. That's it.

```
https://yoursite.com/?claim=123&debug
```

Now you see everything. API responses, internal state, the works.

Normal users see only `info`, `warn`, and `error`. The noise stays hidden until you need it.

## The Functions

### The Basics

```javascript
const log = createLogger('Citizens');

log.debug('Processing', citizen.id);   // verbose, debug-only
log.info('Loaded 42 citizens');        // normal operations  
log.warn('Missing equipment data');    // weird but survivable
log.error('Everything is on fire');    // actual problems
```

### `log.data()` - For JSON Inspection

When you need to see what the API actually returned:

```javascript
log.data('inventory response', data);
// +123ms [API] inventory response
// ▶ { items: Array(847), buildings: Array(12) }  ← expandable in devtools
```

Only shows in debug mode. Won't spam production.

### `log.time()` - For Performance

```javascript
const done = log.time('cascadeCalc');
doCascadeCalculation();
done();
// +456ms [PERF] MyModule:cascadeCalc 23.4ms
```

Returns a function. Call it when you're done. Simple.

### Manual Level Control

```javascript
import { setLogLevel } from './logger.js';

setLogLevel('debug');  // firehose
setLogLevel('warn');   // only problems
setLogLevel('none');   // silence
```

## Filtering in DevTools

The browser console has filters. Use them.

- Type `[API]` to see only API logs
- Type `[Planner]` for planner stuff  
- Use the level buttons (Verbose/Info/Warnings/Errors)

## Adding to a Module

```javascript
// mymodule.js
import { createLogger } from './logger.js';

const log = createLogger('MyModule');

export function doThing() {
    log.debug('Starting');
    const done = log.time('doThing');
    
    try {
        // ... work ...
        log.info('Done');
    } catch (err) {
        log.error('Failed:', err.message);
        throw err;
    } finally {
        done();
    }
}
```

## Don't

```javascript
console.log('something');  // No. Use the logger.

log.debug('token:', secret);  // No. Don't log secrets.

items.forEach(i => log.debug(i));  // No. 10,000 log lines helps nobody.

log.error('Item not found');  // No. Expected conditions aren't errors.
```

## Log Levels

From noisy to quiet: `debug` → `info` → `warn` → `error` → `none`

| Level | When |
|-------|------|
| `debug` | Troubleshooting. API payloads. Internal state. The stuff you need once a month. |
| `info` | Operations completed. Counts loaded. Things worth knowing. |
| `warn` | Degraded but functional. Missing optional data. Fallbacks triggered. |
| `error` | Broken. Failed requests. Catch blocks. |
| `none` | Silence. For when you've given up. |

Default is `info`. Debug mode via URL switches to `debug`.
