/**
 * Data Matrix — a configurable rows × columns grid component.
 *
 * State should live here, not in the DOM.
 * Rendering is driven by config.
 * The caller owns the data. The matrix owns the pixels.
 */
import { KeyboardKey } from '../../types/index.js';

// ── Types ──────────────────────────────────────────────────────

export interface MatrixColumn {
  key: string; // internal identifier (e.g. '1', '2', 'T5')
  label: string; // display text in header
}

export interface MatrixRow {
  key: string; // internal identifier
  label: string; // display text in row header
  cells: Record<string, unknown>; // column key → value
}

export interface MatrixConfig {
  columns: MatrixColumn[];
  rows: MatrixRow[];
  renderCell?: (value: unknown, rowKey: string, colKey: string) => string | HTMLElement;
  onCellClick?: (rowKey: string, colKey: string, value: unknown) => void;
  showRowTotals?: boolean;
  totalReducer?: (cells: Record<string, unknown>) => string | number;
  cssClass?: string; // optional root class for scoping
}

// ── Callback ──────────────────────────────────────────────────────

export interface DataMatrixHandle {
  update: (config: MatrixConfig) => void;
  destroy: () => void;
}

// ── Factory ────────────────────────────────────────────────────

export function createDataMatrix(container: HTMLElement, config: MatrixConfig): DataMatrixHandle {
  let currentConfig = config;

  function render(): void {
    container.innerHTML = '';
    const table = document.createElement('table');
    table.classList.add('dm-table');
    if (currentConfig.cssClass) table.classList.add(currentConfig.cssClass);
    table.appendChild(buildHead(currentConfig));
    table.appendChild(buildBody(currentConfig));
    container.appendChild(table);
  }

  render();

  return {
    update(newConfig: MatrixConfig): void {
      currentConfig = newConfig;
      render();
    },
    destroy(): void {
      container.innerHTML = '';
    },
  };
}

// ── Building Blocks ───────────────────────────────────────────

function buildHead(config: MatrixConfig): HTMLTableSectionElement {
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');

  // Empty corner cell
  tr.appendChild(document.createElement('th'));

  for (const col of config.columns) {
    const th = document.createElement('th');
    th.textContent = col.label;
    tr.appendChild(th);
  }

  if (config.showRowTotals) {
    const th = document.createElement('th');
    th.textContent = 'Total';
    th.classList.add('dm-row-total');
    tr.appendChild(th);
  }

  thead.appendChild(tr);
  return thead;
}

function buildBody(config: MatrixConfig): HTMLTableSectionElement {
  const tbody = document.createElement('tbody');
  let firstClickable = true;

  for (const row of config.rows) {
    const tr = document.createElement('tr');

    // Row label
    const labelCell = document.createElement('td');
    labelCell.textContent = row.label;
    labelCell.classList.add('dm-row-label');
    tr.appendChild(labelCell);

    // Data cells
    for (const col of config.columns) {
      const td = document.createElement('td');
      td.classList.add('dm-cell');

      const value = row.cells[col.key];
      const content = config.renderCell
        ? config.renderCell(value, row.key, col.key)
        : defaultRenderCell(value);

      if (typeof content === 'string') {
        td.textContent = content;
      } else {
        td.appendChild(content);
      }

      if (config.onCellClick) {
        td.classList.add('dm-clickable');
        td.setAttribute('tabindex', firstClickable ? '0' : '-1');
        firstClickable = false;
        td.addEventListener('click', () => {
          config.onCellClick?.(row.key, col.key, value);
        });
      }

      tr.appendChild(td);
    }

    // Total (optional)
    if (config.showRowTotals) {
      const totalCell = document.createElement('td');
      totalCell.classList.add('dm-row-total');
      totalCell.textContent = config.totalReducer
        ? String(config.totalReducer(row.cells))
        : String(defaultTotal(row.cells));
      tr.appendChild(totalCell);
    }

    tbody.appendChild(tr);
  }

  // Keyboard nav for clickable grids
  if (config.onCellClick) {
    wireGridKeys(tbody, config.columns.length);
  }

  return tbody;
}

// ── Wire Keyboard Nav ───────────────────────────────────────────

function wireGridKeys(tbody: HTMLTableSectionElement, colCount: number): void {
  tbody.addEventListener('keydown', (e: KeyboardEvent) => {
    const current = e.target as HTMLElement;
    if (!current.matches('.dm-clickable[tabindex]')) return;

    const cells = Array.from(tbody.querySelectorAll<HTMLElement>('.dm-clickable[tabindex]'));
    const idx = cells.indexOf(current);
    if (idx === -1) return;

    let next: number | null = null;

    switch (e.key) {
      case KeyboardKey.ArrowRight:
        // Don't wrap to next row
        if ((idx + 1) % colCount !== 0) next = idx + 1;
        break;
      case KeyboardKey.ArrowLeft:
        // Don't wrap to previous row
        if (idx % colCount !== 0) next = idx - 1;
        break;
      case KeyboardKey.ArrowDown:
        next = idx + colCount;
        break;
      case KeyboardKey.ArrowUp:
        next = idx - colCount;
        break;
      case KeyboardKey.Enter:
      case ' ':
        e.preventDefault();
        current.click();
        return;
      default:
        return;
    }

    e.preventDefault();
    if (next === null || next < 0 || next >= cells.length) return;

    current.setAttribute('tabindex', '-1');
    cells[next].setAttribute('tabindex', '0');
    cells[next].focus();
  });
}

// ── Defaults ───────────────────────────────────────────────────

function defaultRenderCell(value: unknown): string {
  if (value == null || value === 0) return '—';
  return String(value);
}

function defaultTotal(cells: Record<string, unknown>): number {
  let sum = 0;
  for (const v of Object.values(cells)) {
    if (typeof v === 'number') sum += v;
  }
  return sum;
}
