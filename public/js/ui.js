// Core UI - combines base utilities with view-specific modules
import { CONFIG } from './config.js';
import { MAP_LINK } from './maplink.js';
import { DashboardUI } from './dashboard.js';
import { CitizensUI } from './citizens.js';
import { IdsUI } from './ids.js';

// Base UI utilities
const BaseUI = {
  show(id) {
    document.getElementById(id)?.classList.remove('hidden');
  },

  hide(id) {
    document.getElementById(id)?.classList.add('hidden');
  },

  showError(message) {
    document.getElementById('error-message').textContent = message;
    this.show('error');
  },

  clearError() {
    this.hide('error');
  },

  setClaimName(name) {
    document.getElementById('claim-name').textContent = name;
    this.show('claim-info');
  },

  renderClaimHeader(claimInfo) {
    const container = document.getElementById('claim-header');
    if (!container || !claimInfo || !claimInfo.claim) {
      return;
    }

    const c = claimInfo.claim;

    // Calculate supplies percentage and time remaining
    const suppliesPercent = c.suppliesPurchaseThreshold > 0
    ? Math.min(100, (c.supplies / c.suppliesPurchaseThreshold) * 100)
    : 0;

    let suppliesTimeStr = '';
    if (c.suppliesRunOut) {
      const runOutDate = new Date(c.suppliesRunOut);
      const now = new Date();
      const diffMs = runOutDate - now;

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
    <div class="stat-value">${parseInt(c.treasury || 0).toLocaleString()}</div>
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
    this.show('claim-header');
  },

  setLoading(isLoading) {
    const btn = document.getElementById('load-btn');
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Loading...' : 'Load';
  },

  showTabs() {
    this.show('view-tabs');
    // Reset to inventory view
    document.querySelectorAll('#view-tabs .tab-btn').forEach(t => t.classList.remove('active'));
    document.querySelector('#view-tabs .tab-btn[data-view="inventory"]').classList.add('active');
    document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
    document.getElementById('view-inventory').classList.remove('hidden');
  },

  showCitizensLoading(show) {
    if (show) {
      this.show('citizens-loading');
    } else {
      this.hide('citizens-loading');
    }
  },

  copyToClipboard(text, btn) {
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

  renderMapLinkComposer() {
    const checkboxContainer = document.getElementById("checkbox-row");
    if (!checkboxContainer) {
      return;
    }
    if (checkboxContainer.querySelectorAll('input[type="checkbox"]').length > 0) {
      return;
    }

    // Generate label and checkbox for region selection
    let html = '';
    for (let i = 1; i <= CONFIG.REGION_COUNT; i++) {
      html += `<label><input type="checkbox" value="${i}"> R${i}</label>`;
    }
    checkboxContainer.innerHTML = html;

    // Add input validation for resource and player IDs
    MAP_LINK.addCommaNumberValidation('res-ids');
    MAP_LINK.addCommaNumberValidation('player-ids');

    const btn = document.getElementById("lnk-gen-btn");
    btn.addEventListener("click", () => MAP_LINK.generateLinkEvent());

    const matrixBtn = document.getElementById("id-matrix-btn");
    const matrixWrapper = document.getElementById('id-matrix');
    this.renderResourceMatrix('id-matrix',CONFIG.RESOURCE_ID_MATRIX);
    matrixBtn.addEventListener("click", () => {
      matrixWrapper.classList.toggle('hidden');
    });
  },

  // Generates table with clickable fields to add to input field for resource selection
  renderResourceMatrix(containerId, resourceMatrix) {
    const table = document.getElementById(containerId);
      if (!table) return;

      table.innerHTML = '';

      /* ---------- Header ---------- */
      const head = document.createElement('thead');
      const headerRow = document.createElement('tr');

      // Empty top-left cell
      const emptyTh = document.createElement('th');
      headerRow.appendChild(emptyTh);

      // T1–T10
      for (let t = 1; t <= CONFIG.MAX_TIER; t++) {
        const th = document.createElement('th');
        th.textContent = `T${t}`;
        headerRow.appendChild(th);
      }

      head.appendChild(headerRow);
      table.appendChild(head);

      /* ---------- Body ---------- */
      const body = document.createElement('tbody');
      const rowNames = Object.keys(resourceMatrix);
      rowNames.forEach(rowName => {
        const tr = document.createElement('tr');

        // Row label (not clickable)
        const nameCell = document.createElement('td');
        nameCell.textContent = rowName;
        nameCell.classList.add('row-label');
        tr.appendChild(nameCell);

        // T1–T10 cells
        for (let t = 1; t <= CONFIG.MAX_TIER; t++) {
          const td = document.createElement('td');
          td.classList.add('matrix-cell');

          // clickable area
          const cellArea = document.createElement('div');
          cellArea.classList.add('matrix-cell-inner');

          // data attributes for later logic
          cellArea.dataset.row = rowName;
          cellArea.dataset.tier = t;
          const currentIndex = t-1;
          const idValues = CONFIG.RESOURCE_ID_MATRIX?.[rowName]?.[currentIndex] ?? [];
          if(idValues.length > 0){
            const cellButton = document.createElement('button');
            cellButton.textContent = '';
            cellButton.classList.add('matrix-cell-btn');

            cellButton.addEventListener('click', () => {
              MAP_LINK.cellButtonEvent(cellArea);
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
