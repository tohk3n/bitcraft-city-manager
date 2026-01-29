# Planner Internals

So you want to touch the planner code. Godspeed.

## The Pipeline

```text
recipe-expander  →  cascade-calc  →  progress-calc
     ↓                   ↓               ↓
  "raw math"      "subtract your     "percentages
                   hoard"             for Discord"

inventory-matcher (figures out where you put things)
```

Data in, data out. No state. No surprises. Mostly.

## THE THING THAT WILL BITE YOU

Study Journals show up in ALL FIVE research branches. You have 350. You need 1340.

Old broken code: each branch looks at inventory, sees 350, says "I'm good!"
Result: carvings show 0 needed. LIES.

Fixed code: first branch grabs what it can from the pile. Next branch gets leftovers. Sorry branch #5, the cupboard is bare.

This is `cascade-calc.js`. The `consumed` map tracks who took what. Don't remove it or Lomacil will find you.

## Codex Files

The `qty` values are totals, not multipliers.

```javascript
{ name: "Refined Cloth", qty: 1 }  // need 1 per codex
```

If you start multiplying qty × parent qty × grandparent qty you will get numbers in the billions and then you will open an issue and I will point you to this paragraph.

## The Modules

**recipe-expander.js** — Multiplies everything by batch count. That's it. 20 codexes means 20× the berries.

**cascade-calc.js** — The inventory subtraction. Tracks consumption. Does the "if parent has 74% deficit, children only need 74%" thing. This is where the bugs live.

**inventory-matcher.js** — Packages are 100 items. Except flowers (500). Except fiber (1000). Some items don't exist in inventory at all (research goals). This module handles the pain.

**progress-calc.js** — Turns the tree into percentages and categories. Makes the Discord export. Least likely to break.

## UI Modules

**task-list.js** — The card grid with filters. Yes you can filter by tier. Yes you can sort. Yes there's a copy button. You're welcome.

**flowchart.js** — The big draggy tree. Tabs, connectors, collapse toggle. It gets wide. Deal with it.

**planner.js** — Loads data, calls the other modules. The coordinator. Doesn't do much itself anymore.

## File Layout

```bash
planner.js, task-list.js, flowchart.js     # UI
lib/recipe-expander.js                     # math
lib/cascade-calc.js                        # math + inventory
lib/progress-calc.js                       # aggregation  
lib/inventory-matcher.js                   # inventory lookups

/data/t*-codex.json                        # the recipe trees
/data/item-mappings.json                   # name weirdness
```

## Debugging

Numbers too big? You're multiplying through the tree. Stop that. Children get `batchCount`, not `parent.qty × batchCount`.

Numbers not changing when you add inventory? Check `inventory-matcher`. Probably a tier mismatch or the item is marked non-trackable.

Carvings showing 0 when journals show deficit? You broke cascade-calc. The `consumed` map is gone or the branches aren't sharing properly.

## JS Stuff

```javascript
lookup.get(key)              // undefined if missing
options.count ?? default     // only replaces null/undefined, 0 is fine
mappings?.items?.[name]      // won't explode
const { qty: have } = fn()   // rename during destructure
```

If you're from Java, `?.` is your new best friend. No more NPEs.
