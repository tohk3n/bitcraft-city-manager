// Profession sub-view component.
//
// Renders: status bar (bottlenecks + consumables + copy) -> cargo -> tier matrix.
// Same contract as data-matrix: you give config, you get DOM.
// Auto-hides empty tier columns. If nothing past T4, you only see T1-T4.

import type {
  SubViewConfig,
  SubViewHandle,
  SubViewRow,
  SubViewSection,
  CargoData,
  BottleneckSummary,
  ConsumableStatus,
} from './sub-view.types.js';

// Mount a sub-view into a container element.
export function createSubView(container: HTMLElement, config: SubViewConfig): SubViewHandle {
  let currentConfig = config;
  let tooltipEl: HTMLElement | null = null;

  function render(): void {
    container.innerHTML = '';
    const tierCount = findMaxPopulatedTier(currentConfig);
    container.appendChild(buildStatusBar(currentConfig));
    if (currentConfig.cargo) {
      container.appendChild(buildCargo(currentConfig.cargo, tierCount));
    }
    container.appendChild(buildMatrix(currentConfig.sections, tierCount));
    wireTooltips(container);
    wireCopyButton(container, currentConfig);
  }

  render();

  return {
    update(newConfig: SubViewConfig): void {
      currentConfig = newConfig;
      render();
    },
    destroy(): void {
      removeTooltip();
      container.innerHTML = '';
    },
  };

  // Tooltip lifecycle -- scoped to this instance so multiple
  // sub-views on the same page don't fight over a shared element.

  function wireTooltips(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>('[data-tt]').forEach((cell) => {
      cell.addEventListener('mouseenter', onTooltipEnter);
      cell.addEventListener('mouseleave', removeTooltip);
      cell.addEventListener('mousemove', onTooltipMove);
    });
  }

  function onTooltipEnter(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const raw = target.dataset.tt;
    if (!raw) return;

    tooltipEl = document.createElement('div');
    tooltipEl.className = 'sv-tooltip';
    tooltipEl.innerHTML = formatTooltip(raw);
    document.body.appendChild(tooltipEl);
    positionTooltip(e);
  }

  function onTooltipMove(e: MouseEvent): void {
    positionTooltip(e);
  }

  function removeTooltip(): void {
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
  }

  function positionTooltip(e: MouseEvent): void {
    if (!tooltipEl) return;
    tooltipEl.style.left = `${e.clientX + 12}px`;
    tooltipEl.style.top = `${e.clientY - 8}px`;
  }
}

// Scan all data to find the highest tier with any value.
// Returns at least 1 -- even an empty profession shows T1.
function findMaxPopulatedTier(config: SubViewConfig): number {
  let max = 0;

  const scan = (tiers: number[]): void => {
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (tiers[i] > 0 && i + 1 > max) {
        max = i + 1;
        return;
      }
    }
  };

  if (config.cargo) scan(config.cargo.tiers);

  for (const section of config.sections) {
    for (const row of section.rows) {
      scan(row.tiers);
      // Bottleneck-zero cells count too -- T4 showing "0 needed"
      // means T4 should be visible even if supply is zero
      if (row.bottlenecks) {
        for (const tierIdx of Object.keys(row.bottlenecks).map(Number)) {
          if (tierIdx + 1 > max) max = tierIdx + 1;
        }
      }
    }
  }

  return Math.max(max, 1);
}

// -- Status bar: bottlenecks + consumables + copy button --

function buildStatusBar(config: SubViewConfig): HTMLElement {
  const bar = el('div', 'sv-status-bar');

  const bnSeg = el('div', 'sv-status-segment');
  bnSeg.appendChild(statusLabel('bottlenecks:'));

  if (config.bottlenecks.length === 0) {
    const clear = el('span', 'sv-bn-clear');
    clear.textContent = 'none';
    bnSeg.appendChild(clear);
  } else {
    config.bottlenecks.forEach((b, i) => {
      bnSeg.appendChild(buildBottleneckChip(b));
      if (i < config.bottlenecks.length - 1) {
        bnSeg.appendChild(dot());
      }
    });
  }
  bar.appendChild(bnSeg);

  if (config.consumables.length > 0) {
    bar.appendChild(separator());
    const conSeg = el('div', 'sv-status-segment');
    config.consumables.forEach((c, i) => {
      conSeg.appendChild(buildConsumableChip(c));
      if (i < config.consumables.length - 1) {
        conSeg.appendChild(dot());
      }
    });
    bar.appendChild(conSeg);
  }

  const copyBtn = el('button', 'sv-copy-btn');
  copyBtn.textContent = 'copy';
  copyBtn.title = 'Copy bottleneck summary to clipboard';
  bar.appendChild(copyBtn);

  return bar;
}

function buildBottleneckChip(b: BottleneckSummary): HTMLElement {
  const chip = el('span', 'sv-bn-item');
  const qty = el('span', 'sv-bn-qty');
  qty.textContent = String(b.deficit);
  qty.classList.add(b.have === 0 ? 'crit' : 'warn');

  const tier = el('span', 'sv-bn-tier');
  tier.textContent = ` T${b.tier} `;

  chip.appendChild(qty);
  chip.appendChild(tier);
  chip.appendChild(document.createTextNode(b.name));
  return chip;
}

function buildConsumableChip(c: ConsumableStatus): HTMLElement {
  const chip = el('span', 'sv-con-item');

  const name = el('span', 'sv-con-name');
  name.textContent = `${c.name}: `;

  const val = el('span', 'sv-con-val');
  val.textContent = c.value.toLocaleString();
  if (c.value === 0) val.classList.add('zero');

  chip.appendChild(name);
  chip.appendChild(val);

  if (c.hint) {
    const hint = el('span', 'sv-con-hint');
    hint.textContent = ` ${c.hint}`;
    chip.appendChild(hint);
  }

  return chip;
}

// -- Cargo: compact inline summary above the matrix --

function buildCargo(cargo: CargoData, tierCount: number): HTMLElement {
  const row = el('div', 'sv-cargo');

  const name = el('span', 'sv-cargo-name');
  name.textContent = cargo.name;
  row.appendChild(name);

  const entries: { tier: number; val: number }[] = [];
  for (let i = 0; i < tierCount; i++) {
    const v = cargo.tiers[i] || 0;
    if (v > 0) entries.push({ tier: i + 1, val: v });
  }

  if (entries.length === 0) {
    const empty = el('span', 'sv-cargo-empty');
    empty.textContent = 'none in stock';
    row.appendChild(empty);
  } else {
    entries.forEach((entry, i) => {
      const tier = el('span', 'sv-cargo-tier');
      tier.textContent = `T${entry.tier}`;
      const val = el('span', 'sv-cargo-val');
      val.textContent = entry.val.toLocaleString();
      row.appendChild(tier);
      row.appendChild(val);
      if (i < entries.length - 1) {
        const d = el('span', 'sv-cargo-dot');
        d.textContent = '\u00b7';
        row.appendChild(d);
      }
    });
  }

  return row;
}

// -- Matrix: the tier grid --

function buildMatrix(sections: SubViewSection[], tierCount: number): HTMLTableElement {
  const table = document.createElement('table');
  table.classList.add('sv-matrix');

  const cg = document.createElement('colgroup');
  const nameCol = document.createElement('col');
  nameCol.classList.add('sv-col-name');
  cg.appendChild(nameCol);
  for (let i = 0; i < tierCount; i++) {
    const tierCol = document.createElement('col');
    tierCol.classList.add('sv-col-tier');
    cg.appendChild(tierCol);
  }
  table.appendChild(cg);
  table.appendChild(buildThead(tierCount));

  const tbody = document.createElement('tbody');
  let isFirst = true;
  for (const section of sections) {
    if (isSectionEmpty(section)) continue;

    const labelRow = document.createElement('tr');
    labelRow.classList.add('sv-section-row');
    if (isFirst) labelRow.classList.add('sv-section-first');
    const labelCell = document.createElement('td');
    labelCell.colSpan = tierCount + 1;
    labelCell.textContent = section.label;
    labelRow.appendChild(labelCell);
    tbody.appendChild(labelRow);

    for (const row of section.rows) {
      tbody.appendChild(buildDataRow(row, tierCount));
    }
    isFirst = false;
  }
  table.appendChild(tbody);

  return table;
}

function buildThead(tierCount: number): HTMLTableSectionElement {
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  tr.appendChild(document.createElement('th'));
  for (let i = 1; i <= tierCount; i++) {
    const th = document.createElement('th');
    th.textContent = `T${i}`;
    tr.appendChild(th);
  }
  thead.appendChild(tr);
  return thead;
}

function buildDataRow(row: SubViewRow, tierCount: number): HTMLTableRowElement {
  const tr = document.createElement('tr');
  if (row.cls === 'output') tr.classList.add('sv-row-output');
  if (row.cls === 'cross-domain') tr.classList.add('sv-row-xdomain');

  const nameCell = document.createElement('td');
  nameCell.textContent = row.label;
  tr.appendChild(nameCell);

  for (let i = 0; i < tierCount; i++) {
    tr.appendChild(buildCell(row, i));
  }

  return tr;
}

// Four cell states:
// 1. Bottleneck with stock  -> amber, tooltip shows need/deficit
// 2. Bottleneck with zero   -> red "0", tooltip shows need/deficit
// 3. Has stock, no issue    -> normal highlight
// 4. Empty                  -> blank (not a dash, not a zero)
function buildCell(row: SubViewRow, tierIndex: number): HTMLTableCellElement {
  const td = document.createElement('td');
  const val = row.tiers[tierIndex] || 0;
  const bn = row.bottlenecks?.[tierIndex];

  if (bn) {
    td.dataset.tt = `need ${bn.need} \u00b7 have ${val} \u00b7 short ${bn.deficit}`;
    if (val > 0) {
      td.classList.add('has', 'sv-bottleneck');
      td.textContent = val.toLocaleString();
    } else {
      td.classList.add('sv-bottleneck-zero');
      td.textContent = '0';
    }
  } else if (val > 0) {
    td.classList.add('has');
    td.textContent = val.toLocaleString();
  }

  return td;
}

// -- Tooltip formatting --

// Parses "need X . have Y . short Z" into colored spans.
function formatTooltip(raw: string): string {
  return raw
    .split('\u00b7')
    .map((part) => {
      const s = part.trim();
      if (s.startsWith('need')) return `<span class="sv-tt-need">${s}</span>`;
      if (s.startsWith('have')) return `<span class="sv-tt-have">${s}</span>`;
      if (s.startsWith('short')) return `<span class="sv-tt-deficit">${s}</span>`;
      return s;
    })
    .join(' <span class="sv-tt-sep">\u00b7</span> ');
}

// -- Copy: Discord-friendly markdown --

function wireCopyButton(root: HTMLElement, config: SubViewConfig): void {
  const btn = root.querySelector<HTMLButtonElement>('.sv-copy-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const text = buildCopyText(config);
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = 'copied';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'copy';
        btn.classList.remove('copied');
      }, 1500);
    });
  });
}

function buildCopyText(config: SubViewConfig): string {
  if (config.bottlenecks.length === 0) {
    return `${config.title}: no bottlenecks`;
  }
  const lines = [`**${config.title} Bottlenecks**`];
  for (const b of config.bottlenecks) {
    lines.push(`- ${b.deficit}x T${b.tier} ${b.name} (have ${b.have})`);
  }
  return lines.join('\n');
}

// -- Helpers --

function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}

function statusLabel(text: string): HTMLElement {
  const lbl = el('span', 'sv-status-label');
  lbl.textContent = text;
  return lbl;
}

function dot(): HTMLElement {
  const d = el('span', 'sv-bn-dot');
  d.textContent = '\u00b7';
  return d;
}

function separator(): HTMLElement {
  const s = el('span', 'sv-status-sep');
  s.textContent = '\u2502';
  return s;
}

// True if every row has zero stock and no bottlenecks.
function isSectionEmpty(section: SubViewSection): boolean {
  return section.rows.every((row) => {
    const hasStock = row.tiers.some((v) => v > 0);
    const hasBn = row.bottlenecks && Object.keys(row.bottlenecks).length > 0;
    return !hasStock && !hasBn;
  });
}
