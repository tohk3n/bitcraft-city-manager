// Core UI - combines base utilities with view-specific modules
import {CELL_TYPE, CONFIG} from './configuration/config.js';
import { MAP_LINK } from './maplink.js';
import { DashboardUI } from './dashboard.js';
import { CitizensUI } from './citizens.js';
import { IdsUI } from './ids.js';
import type { ResourceIdMatrix } from './types.js';
import {createLogger} from "./logger.js";

const log = createLogger('UI');
// Base UI utilities
const BaseUI = {
  show(id: string): void {
    document.getElementById(id)?.classList.remove('hidden');
  },

  hide(id: string): void {
    document.getElementById(id)?.classList.add('hidden');
  },

  showError(message: string): void {
    const el = document.getElementById('error-message') as HTMLElement | null;
    if (el) el.textContent = message;
    this.show('error');
  },

  clearError():void {
    this.hide('error');
  },

  setClaimName(name: string): void {
    const el = document.getElementById('claim-name');
    if (el) el.textContent = name;
    this.show('claim-info');
  },

  // ClaimInfo shape from API
  renderClaimHeader(claimInfo: { claim?: {
    name?: string;
    tier?: number;
    regionName?: string;
    supplies?: number;
    suppliesPurchaseThreshold?: number;
    suppliesRunOut?: string;
    treasury?: string | number;
    numTiles?: number;
    upkeepCost?: number;
  }}): void {
    const container = document.getElementById('claim-header');
    if (!container || !claimInfo || !claimInfo.claim) {
      return;
    }

    const c = claimInfo.claim;

    // Calculate supplies percentage and time remaining
    const suppliesPercent = c.suppliesPurchaseThreshold && c.suppliesPurchaseThreshold > 0
    ? Math.min(100, ((c.supplies || 0) / c.suppliesPurchaseThreshold) * 100)
    : 0;

    let suppliesTimeStr = '';
    if (c.suppliesRunOut) {
      const runOutDate = new Date(c.suppliesRunOut);
      const now = new Date();
      const diffMs = runOutDate.getTime() - now.getTime();

      if (diffMs > 0) {
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days > 0) {
          suppliesTimeStr = `${days}d ${hours}h remaining`;
        } else {
          suppliesTimeStr = `${hours}h remaining`;
        }
      } else {
        suppliesTimeStr = 'Depleted';
      }
    }

    // Supplies bar color based on percentage
    let suppliesColor = 'var(--success)';
    if (suppliesPercent < 25) {
      suppliesColor = '#f85149';
    } else if (suppliesPercent < 50) {
      suppliesColor = 'var(--warning)';
    }

    const html = `
    <div class="claim-header-content">
    <div class="claim-title">
    <h2>${c.name || 'Unknown Settlement'}</h2>
    <span class="tier-badge tier-${c.tier || 1}">T${c.tier || 1}</span>
    <span class="region-badge">${c.regionName || 'Unknown'}</span>
    </div>
    <div class="claim-stats">
    <div class="claim-stat">
    <div class="stat-label">Supplies</div>
    <div class="stat-value">${(c.supplies || 0).toLocaleString()}</div>
    <div class="supplies-bar">
    <div class="supplies-fill" style="width: ${suppliesPercent}%; background: ${suppliesColor};"></div>
    </div>
    <div class="stat-sub">${suppliesTimeStr}</div>
    </div>
    <div class="claim-stat">
    <div class="stat-label">Treasury</div>
    <div class="stat-value">${parseInt(String(c.treasury || 0)).toLocaleString()}</div>
    </div>
    <div class="claim-stat">
    <div class="stat-label">Tiles</div>
    <div class="stat-value">${(c.numTiles || 0).toLocaleString()}</div>
    </div>
    <div class="claim-stat">
    <div class="stat-label">Upkeep</div>
    <div class="stat-value">${(c.upkeepCost || 0).toFixed(1)}/h</div>
    </div>
    </div>
    </div>
    `;

    container.innerHTML = html;
    log.debug(html);
    this.show('claim-header');
  },

  setLoading(isLoading: boolean): void {
    const btn = document.getElementById('load-btn') as HTMLButtonElement | null;
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Loading...' : 'Load';
  },

  showTabs(): void {
    this.show('view-tabs');
    // Reset to inventory view
    document.querySelectorAll('#view-tabs .tab-btn').forEach(t => t.classList.remove('active'));
    document.querySelector('#view-tabs .tab-btn[data-view="inventory"]')?.classList.add('active');
    document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
    document.getElementById('view-inventory')?.classList.remove('hidden');
  },

  showCitizensLoading(show: boolean): void {
    if (show) {
      this.show('citizens-loading');
    } else {
      this.hide('citizens-loading');
    }
  },

  copyToClipboard(text: string, btn: HTMLElement): void {
    navigator.clipboard.writeText(text).then(() => {
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 1500);
    }).catch(err => {
      console.error('Copy failed:', err);
    });
  },

  renderMapLinkComposer(): void {
    const checkboxContainer:HTMLElement|null = document.getElementById("checkbox-row");
    if (!checkboxContainer) {
      return;
    }
    if (checkboxContainer.querySelectorAll('input[type="checkbox"]').length > 0) {
      return;
    }

    // Generate label and checkbox for region selection
    let html:string = '';
    for (let i:number = 1; i <= CONFIG.REGION_COUNT; i++) {
      html += `<label><input type="checkbox" value="${i}"> R${i}</label>`;
    }
    checkboxContainer.innerHTML = html;

    // Add input validation for resource and player IDs
    MAP_LINK.addCommaNumberValidation('res-ids');
    MAP_LINK.addCommaNumberValidation('player-ids');

    const btn:HTMLElement|null = document.getElementById("lnk-gen-btn");
    if(!btn)return;
    const matrixBtn:HTMLElement|null = document.getElementById("id-matrix-btn");
    if(!matrixBtn)return;
    const matrixWrapper:HTMLElement|null = document.getElementById('id-matrix');
    if(!matrixWrapper)return;
    this.renderResourceMatrix('id-matrix', CONFIG.RESOURCE_ID_MATRIX);

    btn?.addEventListener("click", ():void => MAP_LINK.generateLinkEvent());

    matrixBtn?.addEventListener("click", ():void => {
      matrixWrapper?.classList.toggle('hidden');
    });

    const resInputField = document.getElementById('res-ids') as HTMLInputElement|null;
    resInputField?.addEventListener("blur", ():void => {
      MAP_LINK.syncMatrixState(resInputField.value);
    });
  },

  // Generates table with clickable fields to add to input field for resource selection
  renderResourceMatrix(containerId: string, resourceMatrix: ResourceIdMatrix): void {
    const table:HTMLElement|null = document.getElementById(containerId);
    if (!table) return;

    table.innerHTML = '';

    /* ---------- Header ---------- */
    const head = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Empty top-left cell
    const emptyTh = document.createElement('th');
    headerRow.appendChild(emptyTh);

    // T1 - T10
    for (let t = 1; t <= CONFIG.MAX_TIER; t++) {
      const th = document.createElement('th');
      th.textContent = `T${t}`;
      headerRow.appendChild(th);
    }

    head.appendChild(headerRow);
    table.appendChild(head);

    /* ---------- Body ---------- */
    const body = document.createElement('tbody') as HTMLTableSectionElement;
    const rowNames = Object.keys(resourceMatrix) as (keyof ResourceIdMatrix)[];
    rowNames.forEach(rowName => {
      const tr = document.createElement('tr') as HTMLTableRowElement;

      // Row label (not clickable)
      const nameCell = document.createElement('td') as HTMLTableCellElement;
      nameCell.textContent = rowName;
      nameCell.classList.add('row-label');
      tr.appendChild(nameCell);

      // T1 - T10 cells
      for (let t:number = 1; t <= CONFIG.MAX_TIER; t++) {
        const td = document.createElement('td') as HTMLTableCellElement;
        td.classList.add('matrix-cell');

          // clickable area
          const cellArea = document.createElement('div') as HTMLDivElement;
          cellArea.classList.add('matrix-cell-inner');
          // Needed for state of matrix
          cellArea.classList.add(CELL_TYPE.NONE);
          // data attributes for later logic
          cellArea.dataset.row = rowName;
          cellArea.dataset.tier = String(t);
          const currentIndex:number = t-1;
          const idValues:number[] = CONFIG.RESOURCE_ID_MATRIX?.[rowName]?.[currentIndex] ?? [];
          if(idValues.length > 0){
            const cellButton = document.createElement('button') as HTMLButtonElement;
            cellButton.textContent = '';
            cellButton.classList.add('matrix-cell-btn');

            cellButton.addEventListener('click', ():void => {
              MAP_LINK.cellButtonEvent(rowName,t);
            });

          cellArea.appendChild(cellButton);
        }else{
          cellArea.classList.add('empty');
        }

          td.appendChild(cellArea);
          tr.appendChild(td);
        }

      body.appendChild(tr);
    });

    table.appendChild(body);
  }
};

// Combine all UI modules into single export
export const UI = Object.assign(
  {},
  BaseUI,
  DashboardUI,
  CitizensUI,
  IdsUI
);
