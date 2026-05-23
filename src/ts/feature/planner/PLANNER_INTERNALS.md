# Planner Internals

So you want to touch the planner code. Godspeed.

## The Pipeline

```text
recipe-expander  →  cascade-calc  →  progress-calc  →  planner-view
     ↓                   ↓               ↓                 ↓
  "raw math"      "subtract your     "percentages"     "pixels on
                   hoard"                               screen"

inventory-matcher (figures out where you put things)
recipe-graph (knows what makes what)
```

Data in, data out. No state. No surprises. Mostly.

## THE THING THAT WILL BITE YOU

Study Journals show up in ALL FIVE research branches. You have 350. You need 1340.

Old broken code: each branch looks at inventory, sees 350, says "I'm good!"
Result: carvings show 0 needed. LIES.

Fixed code: first branch grabs what it can from the pile. Next branch gets leftovers. Sorry branch #5, the cupboard is bare.

This is `cascade-calc.ts`. The `consumed` map tracks who took what. Don't remove it or Lomacil will find you.

## Data Files

Two files. That's it. THE GREAT DATA DIET succeeded.

**codex.json** — Tier metadata and research entry points. "To get T6, complete these 5 researches."

**recipes.json** — The normalized recipe graph. Every craftable item, what it needs, what it yields. Referenced by `"Name:tier"` keys.

```javascript
// codex.json structure
{
  "tiers": {
    "5": {
      "name": "Advanced Codex",
      "tier": 5,
      "researches": [
        { "id": "Advanced Stone Research", "tier": 5, "inputs": [...] }
      ]
    }
  }
}

// recipes.json structure  
{
  "recipes": {
    "Advanced Brick:5": {
      "name": "Advanced Brick",
      "tier": 5,
      "type": "intermediate",
      "yields": 1,
      "inputs": [
        { "ref": "Unfired Advanced Brick:5", "qty": 1 },
        { "ref": "Advanced Wood Log:5", "qty": 1 }
      ]
    }
  }
}
```

The `qty` values are per-craft, not totals. The expander handles multiplication.

## Package Multipliers

THE SACRED TABLE. Packages contain multiple items. The math must account for this.

| Package Type | Items per Package |
| -------------- | ------------------- |
| Default (wood, metal, etc.) | 100 |
| Pebbles | 500 |
| Flowers | 500 |
| Fibers | 1000 |

Detection is by name/tag containing the keyword. "Package of Fine Pebbles" → pebble → 500×.

If you add a new package type, update `PACKAGE_MULTIPLIERS` in `inventory-matcher.ts` AND this table. Future you will thank past you. THE PACKAGES HAVE DECEIVED BEFORE.

## The Modules

### Data Layer (`lib/`)

**recipe-graph.ts** — Data access utilities. `getCodexTier()`, `isTrackable()`, `toMappingType()`. Knows the shape of the JSON. Doesn't do math.

**recipe-expander.ts** — Expands a codex tier into a full crafting tree. Input: tier + count. Output: tree with `idealQty` on every node. Pure math, no inventory awareness.

**cascade-calc.ts** — The inventory subtraction. Tracks consumption across shared resources. Does the "if parent has 74% deficit, children only need 74%" thing. Extracts Study Journals into their own aggregated node. This is where the bugs live.

**inventory-matcher.ts** — Builds the inventory lookup from API data. Handles package expansion and name normalization. `"fine brick:4"` → quantity.

**progress-calc.ts** — Aggregates the processed tree into progress stats. Groups by activity (Mining, Logging, etc.). Generates Discord export text.

### UI Layer

**planner.ts** — The coordinator. Loads data, wires up controls, calls the pipeline. Caches codex/recipes. Doesn't render anything itself anymore.

**planner-view.ts** — Tab container for dashboard/flowchart. Manages view switching and copy buttons. Delegates actual rendering.

**planner-dashboard.ts** — The task list grouped by activity. Filters, sort, collapse. "Copy View" vs "Copy All". What leaders actually use.

**flowchart.ts** — The big draggy tree. Research tabs, SVG connectors, collapse toggle. It gets wide. Deal with it.

**task-list.ts** — Legacy card grid. Still exists, may be removed. Dashboard is the primary view now.

## File Layout

```bash
planner/
├── planner.ts              # Coordinator, data loading
├── planner-view.ts         # Tab container (dashboard/flowchart)
├── planner-dashboard.ts    # Activity-grouped task list
├── flowchart.ts            # Tree visualization
├── task-list.ts            # Legacy card grid
├── PLANNER_INTERNALS.md    # You are here
└── lib/
    ├── recipe-graph.ts     # Data access utilities
    ├── recipe-expander.ts  # Tree expansion (phase 1)
    ├── cascade-calc.ts     # Inventory application (phase 2)
    ├── inventory-matcher.ts # Inventory lookup builder
    └── progress-calc.ts    # Stats aggregation (phase 3)

/data/
├── codex.json              # Tier metadata + research entry points
└── recipes.json            # Normalized recipe graph
```

## Debugging

**Numbers too big?** You're multiplying through the tree. Stop that. Children get their own `qty`, not `parent.qty × child.qty × grandparent.qty`. The expander handles this.

**Numbers not changing when you add inventory?** Check `inventory-matcher`. Probably a tier mismatch, name normalization issue, or the item is marked non-trackable.

**Carvings showing 0 when journals show deficit?** You broke cascade-calc. The `consumed` map is gone or the branches aren't sharing properly.

**Pebbles showing way less than expected?** Check `getPackageMultiplier()`. Pebbles are 500, not 100.

**Progress stuck at weird percentage?** Study Journals are shared across all 5 researches. They get extracted and aggregated. If that extraction breaks, the math goes sideways.

## TypeScript Stuff

```typescript
lookup.get(key)              // undefined if missing
options.count ?? default     // only replaces null/undefined, 0 is fine
mappings?.items?.[name]      // won't explode (optional chaining)
const { qty: have } = fn()   // rename during destructure
```

If you're from Java, `?.` is your new best friend. No more NPEs.

The types live in `types/codex.ts` and `types/planner.ts`. Key ones:

- `ExpandedNode` — After recipe-expander, before inventory
- `ProcessedNode` — After cascade-calc, has `have`/`deficit`/`status`
- `ProgressReport` — The stats object for UI consumption
- `InventoryLookup` — `Map<string, number>` keyed by `"name:tier"`
