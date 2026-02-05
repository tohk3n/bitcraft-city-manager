# Data Matrix

A rows × columns grid component. You give data, you get table. MAGIC. Like Star Trek!

State lives in memory. Rendering is idempotent. Call `update()` fifty times, get one table.

## The Shape

```text
             col-1   col-2   col-3   Total
row-A      [value] [value] [value]  [sum]
row-B      [value] [value] [value]  [sum]
```

## Quick Start

```typescript
import { createDataMatrix } from './components/data-matrix/data-matrix.js';

const container = document.getElementById('my-grid')!;

const matrix = createDataMatrix(container, {
  columns: [
    { key: '1', label: 'T1' },
    { key: '2', label: 'T2' },
    { key: '3', label: 'T3' },
  ],
  rows: [
    { key: 'wood', label: 'Wood', cells: { '1': 40, '2': 12, '3': 0 } },
    { key: 'metal', label: 'Metal', cells: { '1': 0, '2': 8, '3': 25 } },
  ],
  showRowTotals: true,
});
```

Done.

## The Config

```typescript
interface MatrixConfig {
  columns: MatrixColumn[];    // What goes across the top
  rows: MatrixRow[];          // What goes down the side
  renderCell?: (value, rowKey, colKey) => string | HTMLElement;  // Custom cell content
  onCellClick?: (rowKey, colKey, value) => void;                 // Click handler
  showRowTotals?: boolean;    // Add a Total column on the right
  totalReducer?: (cells) => string | number;  // Custom total logic
  cssClass?: string;          // Extra class on the <table>
}
```

Everything except `columns` and `rows` is optional. Sensible defaults handle the rest.

### MatrixColumn

```typescript
{ key: '1', label: 'T1' }
```

`key` is the lookup into each row's `cells` map. `label` is what the header displays.

### MatrixRow

```typescript
{ key: 'wood', label: 'Wood', cells: { '1': 40, '2': 12, '3': 0 } }
```

`key` identifies the row (passed to callbacks). `label` displays in the row header. `cells` maps column keys to values.

## The Handle

`createDataMatrix` returns a handle with two methods:

```typescript
const matrix = createDataMatrix(container, config);

// New data? NO! Yes...Update in place
matrix.update(newConfig);

// Done? (YES!) Clean up. (no...)
matrix.destroy();
```
