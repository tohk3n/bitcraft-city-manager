// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDataMatrix } from './data-matrix.js';
import type { MatrixConfig, MatrixColumn } from './data-matrix.js';

// ── Helpers ────────────────────────────────────────────────────

const COLS: MatrixColumn[] = [
  { key: '1', label: 'T1' },
  { key: '2', label: 'T2' },
  { key: '3', label: 'T3' },
];

function makeConfig(overrides: Partial<MatrixConfig> = {}): MatrixConfig {
  return {
    columns: COLS,
    rows: [
      { key: 'wood', label: 'Wood', cells: { '1': 10, '2': 0, '3': 5 } },
      { key: 'metal', label: 'Metal', cells: { '1': 0, '2': 8, '3': 0 } },
    ],
    ...overrides,
  };
}

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
});

// ── Creation ───────────────────────────────────────────────────

describe('createDataMatrix', () => {
  it('renders a table into the container', () => {
    createDataMatrix(container, makeConfig());

    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(table?.classList.contains('dm-table')).toBe(true);
  });

  it('renders correct number of header cells', () => {
    createDataMatrix(container, makeConfig());

    const headers = container.querySelectorAll('thead th');
    // 1 empty corner + 3 columns
    expect(headers).toHaveLength(4);
    expect(headers[1].textContent).toBe('T1');
    expect(headers[3].textContent).toBe('T3');
  });

  it('renders correct number of body rows', () => {
    createDataMatrix(container, makeConfig());

    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
  });

  it('renders row labels', () => {
    createDataMatrix(container, makeConfig());

    const labels = container.querySelectorAll('.dm-row-label');
    expect(labels).toHaveLength(2);
    expect(labels[0].textContent).toBe('Wood');
    expect(labels[1].textContent).toBe('Metal');
  });

  it('renders cell values with default formatter', () => {
    createDataMatrix(container, makeConfig());

    const cells = container.querySelectorAll('.dm-cell');
    // 2 rows × 3 cols = 6 cells
    expect(cells).toHaveLength(6);
    expect(cells[0].textContent).toBe('10');
    expect(cells[1].textContent).toBe('—'); // 0 renders as dash
    expect(cells[2].textContent).toBe('5');
  });

  it('applies optional cssClass to table', () => {
    createDataMatrix(container, makeConfig({ cssClass: 'crafting-matrix' }));

    const table = container.querySelector('table');
    expect(table?.classList.contains('crafting-matrix')).toBe(true);
  });
});

// ── Row Totals ─────────────────────────────────────────────────

describe('row totals', () => {
  it('shows totals column when enabled', () => {
    createDataMatrix(container, makeConfig({ showRowTotals: true }));

    const totalHeaders = container.querySelectorAll('.dm-row-total');
    // 1 header + 2 row totals
    expect(totalHeaders).toHaveLength(3);
  });

  it('calculates default sum correctly', () => {
    createDataMatrix(container, makeConfig({ showRowTotals: true }));

    const totals = container.querySelectorAll('tbody .dm-row-total');
    expect(totals[0].textContent).toBe('15'); // 10 + 0 + 5
    expect(totals[1].textContent).toBe('8'); // 0 + 8 + 0
  });

  it('uses custom totalReducer when provided', () => {
    const reducer = (cells: Record<string, unknown>): string => {
      const count = Object.values(cells).filter((v) => v !== 0).length;
      return `${count} active`;
    };

    createDataMatrix(
      container,
      makeConfig({
        showRowTotals: true,
        totalReducer: reducer,
      })
    );

    const totals = container.querySelectorAll('tbody .dm-row-total');
    expect(totals[0].textContent).toBe('2 active');
  });
});

// ── Custom Rendering ───────────────────────────────────────────

describe('renderCell callback', () => {
  it('uses custom string renderer', () => {
    const renderCell = (value: unknown): string => (value === 0 ? 'EMPTY' : `[${value}]`);

    createDataMatrix(container, makeConfig({ renderCell }));

    const cells = container.querySelectorAll('.dm-cell');
    expect(cells[0].textContent).toBe('[10]');
    expect(cells[1].textContent).toBe('EMPTY');
  });

  it('uses custom element renderer', () => {
    const renderCell = (value: unknown): HTMLElement => {
      const span = document.createElement('span');
      span.className = 'custom-badge';
      span.textContent = String(value);
      return span;
    };

    createDataMatrix(container, makeConfig({ renderCell }));

    const badges = container.querySelectorAll('.custom-badge');
    expect(badges).toHaveLength(6);
  });

  it('receives correct row and column keys', () => {
    const calls: [string, string][] = [];
    const renderCell = (_v: unknown, rowKey: string, colKey: string): string => {
      calls.push([rowKey, colKey]);
      return '';
    };

    createDataMatrix(container, makeConfig({ renderCell }));

    expect(calls).toContainEqual(['wood', '1']);
    expect(calls).toContainEqual(['metal', '3']);
    expect(calls).toHaveLength(6);
  });
});

// ── Click Handling ─────────────────────────────────────────────

describe('onCellClick callback', () => {
  it('fires with correct arguments on click', () => {
    const onClick = vi.fn();

    createDataMatrix(container, makeConfig({ onCellClick: onClick }));

    const firstCell = container.querySelector('.dm-cell') as HTMLElement;
    firstCell.click();

    expect(onClick).toHaveBeenCalledOnce();
    expect(onClick).toHaveBeenCalledWith('wood', '1', 10);
  });

  it('adds clickable class when handler provided', () => {
    createDataMatrix(container, makeConfig({ onCellClick: vi.fn() }));

    const cells = container.querySelectorAll('.dm-clickable');
    expect(cells).toHaveLength(6);
  });

  it('does not add clickable class when no handler', () => {
    createDataMatrix(container, makeConfig());

    const cells = container.querySelectorAll('.dm-clickable');
    expect(cells).toHaveLength(0);
  });
});

// ── Update ─────────────────────────────────────────────────────

describe('update', () => {
  it('replaces content idempotently', () => {
    const matrix = createDataMatrix(container, makeConfig());

    const newConfig = makeConfig({
      rows: [{ key: 'stone', label: 'Stone', cells: { '1': 99, '2': 0, '3': 0 } }],
    });

    matrix.update(newConfig);

    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(1);

    const label = container.querySelector('.dm-row-label');
    expect(label).not.toBeNull();
    expect(label?.textContent).toBe('Stone');
  });

  it('does not leak DOM nodes on repeated updates', () => {
    const matrix = createDataMatrix(container, makeConfig());

    for (let i = 0; i < 10; i++) {
      matrix.update(makeConfig());
    }

    const tables = container.querySelectorAll('table');
    expect(tables).toHaveLength(1);
  });
});

// ── Destroy ────────────────────────────────────────────────────

describe('destroy', () => {
  it('cleans up the container', () => {
    const matrix = createDataMatrix(container, makeConfig());
    matrix.destroy();

    expect(container.innerHTML).toBe('');
  });
});
