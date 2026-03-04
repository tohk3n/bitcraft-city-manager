# Sub-View

Profession sub-view component. You give it inventory data for one profession, it gives you a status bar + tier matrix with inline bottleneck markers.

Same contract as data-matrix: caller owns data, component owns pixels. Call `update()` whenever inventory changes. No leftovers.

## Quick Start

```typescript
import { createSubView } from './components/sub-view/index.js';
import type { SubViewConfig } from './components/sub-view/index.js';

const container = document.getElementById('woodworking-view-inventory')!;

const config: SubViewConfig = {
  title: 'Woodworking',
  cargo: { name: 'trunk', tiers: [456, 0, 0, 69] },
  consumables: [
    { name: 'sandpaper', value: 2707 },
    { name: 'pitch', value: 246 },
    { name: 'buckets', value: 0, hint: '-> provisions' },
  ],
  bottlenecks: [
    { name: 'plank', tier: 4, need: 40, have: 20, deficit: 20 },
    { name: 'timber', tier: 4, need: 32, have: 0, deficit: 32 },
  ],
  sections: [
    {
      label: 'materials',
      rows: [
        { key: 'wood-log', label: 'wood log', tiers: [708, 4, 3, 3424] },
        { key: 'plank', label: 'plank', tiers: [759, 86, 268, 20],
          bottlenecks: { 3: { need: 40, deficit: 20 } } },
        { key: 'timber', label: 'timber', tiers: [0, 4, 2, 0],
          cls: 'output', bottlenecks: { 3: { need: 32, deficit: 32 } } },
      ],
    },
    {
      label: 'from other professions',
      rows: [
        { key: 'masonry-logs', label: '-> masonry logs', tiers: [0, 0, 0, 140], cls: 'cross-domain' },
      ],
    },
  ],
};

const view = createSubView(container, config);

// Data changed? Update.
view.update(newConfig);

// Done? Cleanup.
view.destroy();
```

## What It Do

1. **Status bar** -- bottleneck summary + consumable widgets + copy-to-clipboard button
2. **Cargo row** -- compact inline display of supply cargo (trunks, ore chunks)
3. **Tier matrix** -- auto-hides empty tier columns. If nothing past T4, you see T1-T4.
4. **Bottleneck markers** -- amber = have some need more, red = have zero. Corner triangles on cells, tooltip reveals need/have/deficit on hover.
5. **Copy button** -- generates Discord-friendly markdown of the bottleneck summary.

## Data Shape

`SubViewConfig` is intentionally flat. The caller transforms `ProcessedInventory` into this shape. The component does not know or care where the data came from.

`tiers` arrays are 0-indexed (index 0 = T1, index 9 = T10). Sparse is fine.

`bottlenecks` on a row is a sparse Record keyed by tier index. Only add entries where there is an actual shortage. The cell shows supply; the tooltip shows need/have/deficit.

Row semantics: `'output'` = crafted outputs (amber name), `'cross-domain'` = materials from other professions (purple name), no class = regular material.

## Empty State Behavior

- Empty tier columns: hidden entirely
- Zero-stock, no bottleneck: blank cell
- Zero-stock, IS bottleneck: red "0" with corner triangle
- Empty section (all rows blank, no bottlenecks): hidden entirely
