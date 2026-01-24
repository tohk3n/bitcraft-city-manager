# Planner Internals

How the calculation pipeline works. Read this before touching the planner modules.

## Architecture Overview

Four modules, each does one thing:

```
recipe-expander.js   →   cascade-calc.js   →   progress-calc.js
     │                        │                      │
     ▼                        ▼                      ▼
 "ideal totals"      "adjusted for           "statistics &
  assuming empty      inventory"              grouping"
  inventory"

inventory-matcher.js (utility - used by cascade-calc)
```

All pure functions. No side effects. Data flows in, transformed data flows out.

## The Data Model

### Input: Codex JSON

The `qty` on each node is the **total needed for one codex completion**. The tree structure shows dependencies, not multiplication factors.

```javascript
// Example: t4-codex.json structure
{
  name: "Proficient Codex",
  tier: 4,
  researches: [
    {
      name: "Proficient Cloth Research",
      qty: 1,
      children: [
        { name: "Refined Fine Cloth", qty: 1, children: [...] }
      ]
    }
  ]
}
```

### Output: Processed Tree

Each node gets enriched with:
```javascript
{
  name: "Basic Berry",
  tier: 1,
  recipeQty: 200,        // from codex
  idealQty: 4000,        // recipeQty × batchCount
  required: 4000,        // what we actually need (may be reduced by parent inventory)
  have: 1500,            // from inventory lookup
  deficit: 2500,         // Math.max(0, required - have)
  status: "partial",     // "complete" | "partial" | "missing"
  trackable: true,       // exists in inventory system
  children: []
}
```

## Module Details

### recipe-expander.js

Expands the codex for N completions.

```javascript
// Key function signature
function expandNode(node, batchCount, mappings) → expandedNode
```

**Critical:** Children receive `batchCount`, not the parent's `idealQty`. This is what keeps quantities sane.

```javascript
// Inside expandNode:
const idealQty = recipeQty * batchCount;

// Children get the same batchCount
children: node.children.map(child => 
    expandNode(child, batchCount, mappings)  // ✓ batchCount
)
```

### cascade-calc.js

Applies inventory. If you have materials at any level, children need to produce less.

```javascript
function processNodeCascade(node, inventoryLookup, mappings, batchCount) → processedNode
```

The cascade math:
```javascript
const required = recipeQty * batchCount;
const deficit = Math.max(0, required - have);

// Key insight: children only need to cover the deficit
const effectiveBatches = recipeQty > 0 
    ? (deficit / recipeQty)  // reduced batch count for children
    : batchCount;
```

Example walkthrough:
- Rough Cloth: `recipeQty=40`, `batchCount=20`, `required=800`, `have=200`
- `deficit = 600`
- `effectiveBatches = 600 / 40 = 15`
- Children now calculate for 15 batches instead of 20

### inventory-matcher.js

Handles inventory lookups with some edge cases:

```javascript
// Build lookup from API response
buildInventoryLookup(buildings, itemMeta, cargoMeta) → Map<string, number>

// Query with fallbacks
getItemQuantity(lookup, name, tier, mappings) → { qty, trackable }
```

**Package handling:** API returns packages (100 items per package, 500 for flowers, 1000 for fiber). The lookup multiplies these out.

**Tier fallbacks:** Some items are tierless. If exact tier not found, tries tier 0 and tier -1.

**Trackable flag:** Some codex items don't exist in inventory (research goals). Marked `trackable: false` in item-mappings.json. These always return `qty: 0`.

### progress-calc.js

Aggregation and formatting. Less critical to understand, but:

- `collectFirstTrackable()` - Finds the "crafting frontier" (first trackable item in each branch)
- `groupByActivity()` - Categorizes by Mining/Logging/Farming/etc based on item names
- `generateExportText()` - Discord markdown output

## JavaScript Patterns Used

**Map for lookups:**
```javascript
const lookup = new Map();
lookup.set(key, value);
lookup.get(key);  // returns undefined if not found, not null
lookup.has(key);  // boolean check
```

**Nullish coalescing (`??`):**
```javascript
const count = options.customCount ?? defaultCount;
// Uses defaultCount only if customCount is null/undefined
// Different from || which treats 0 and "" as falsy
```

**Optional chaining (`?.`):**
```javascript
const mapping = mappings?.mappings?.[name];
// Returns undefined if any part of chain is null/undefined
// No NPE equivalent - just gracefully returns undefined
```

**Destructuring with defaults:**
```javascript
const { qty: have } = getItemQuantity(...);
// Extracts qty property, renames to 'have'
```

**Array methods (functional style):**
```javascript
// map: transform each element
nodes.map(n => processNode(n))

// filter: keep elements matching predicate  
items.filter(i => i.deficit > 0)

// reduce: accumulate to single value
items.reduce((sum, i) => sum + i.qty, 0)
```

## File Locations

```
/js/planner/
  planner.js           # UI rendering, orchestration

/js/planner/lib/
      recipe-expander.js   # Phase 1: expand for N completions
      cascade-calc.js      # Phase 2: apply inventory
      progress-calc.js     # Phase 3: aggregate stats
      inventory-matcher.js # Utility: inventory lookups

/data/
  t1-codex.json ... t9-codex.json   # Recipe trees
  item-mappings.json                 # Name mappings, trackable flags
```

## Testing Sanity Check

If quantities look wrong:
1. Find a leaf node's `qty` in the codex JSON
2. Multiply by your batch count
3. That's the expected `required` (with empty inventory)

If you're seeing numbers orders of magnitude larger, something is multiplying through the tree incorrectly.
