// Core UI - combines base utilities with view-specific modules
import { CONFIG } from './configuration/config.js';
import { MAP_LINK } from './maplink.js';
import { DashboardUI } from './dashboard.js';
import { IdsUI } from './ids.js';
import { createLogger } from './logger.js';
import { KeyboardKey } from './types/index.js';

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

  clearError(): void {
    this.hide('error');
  },

  setClaimName(name: string): void {
    const el = document.getElementById('claim-name');
    if (el) el.textContent = name;
    this.show('claim-info');
  },

  // ClaimInfo shape from API
  renderClaimHeader(claimInfo: {
    claim?: {
      name?: string;
      tier?: number;
      regionName?: string;
      supplies?: number;
      suppliesPurchaseThreshold?: number;
      suppliesRunOut?: string;
      treasury?: string | number;
      numTiles?: number;
      upkeepCost?: number;
    };
  }): void {
    const container = document.getElementById('claim-header');
    if (!container || !claimInfo || !claimInfo.claim) {
      return;
    }

    const c = claimInfo.claim;

    // Calculate supplies percentage and time remaining
    const suppliesPercent =
      c.suppliesPurchaseThreshold && c.suppliesPurchaseThreshold > 0
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
    <div class="claim-stat">
    <div class="stat-label">Citizens</div>
    <div class="stat-value" id="ch-citizens">&mdash;</div>
    </div>
    <div class="claim-stat">
    <div class="stat-label">Buildings</div>
    <div class="stat-value" id="ch-buildings">&mdash;</div>
    </div>
    </div>
    </div>
    `;

    container.innerHTML = html;
    log.debug(html);
    this.show('claim-header');
  },

  updateHeaderCitizens(count: number): void {
    const el = document.getElementById('ch-citizens');
    if (el) el.textContent = count.toLocaleString();
  },

  updateHeaderBuildings(count: number): void {
    const el = document.getElementById('ch-buildings');
    if (el) el.textContent = count.toLocaleString();
  },

  setLoading(isLoading: boolean): void {
    const btn = document.getElementById('load-btn') as HTMLButtonElement | null;
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Loading...' : 'Load';
  },

  showTabs(): void {
    this.show('view-tabs');
    // default to overview (home) tab
    document.querySelectorAll('#view-tabs .tab-btn').forEach((t) => t.classList.remove('active'));
    document.querySelector('#view-tabs .tab-btn[data-view="overview"]')?.classList.add('active');
    document.querySelectorAll('.view-section').forEach((s) => s.classList.add('hidden'));
    document.getElementById('view-overview')?.classList.remove('hidden');
  },

  showCitizensLoading(show: boolean): void {
    if (show) {
      this.show('citizens-loading');
    } else {
      this.hide('citizens-loading');
    }
  },

  copyToClipboard(text: string, btn: HTMLElement): void {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1500);
      })
      .catch((err) => {
        console.error('Copy failed:', err);
      });
  },

  renderMapLinkComposer(): void {
    const checkboxContainer: HTMLElement | null = document.getElementById('checkbox-row');
    if (!checkboxContainer) {
      return;
    }
    if (checkboxContainer.querySelectorAll('input[type="checkbox"]').length > 0) {
      return;
    }

    // Generate label and checkbox for region selection
    const cols = 5;
    const rows = Math.ceil(CONFIG.REGION_COUNT / cols);
    let html = '';
    let firstEnabled = true;
    for (let row = rows - 1; row >= 0; row--) {
      for (let col = 0; col < cols; col++) {
        const region = row * cols + col + 1;
        if (region > CONFIG.REGION_COUNT) {
          html += '<span class="rgn-spacer"></span>';
        } else {
          const disabled = !CONFIG.ENABLED_REGIONS.has(region);
          if (disabled) {
            html += `<label class="rgn-disabled"><input type="checkbox" value="${region}" tabindex="-1" disabled> ${region}</label>`;
          } else {
            const ti = firstEnabled ? '0' : '-1';
            firstEnabled = false;
            html += `<label tabindex="${ti}" data-region="${region}"><input type="checkbox" value="${region}" tabindex="-1"> ${region}</label>`;
          }
        }
      }
    }

    checkboxContainer.innerHTML = '<div class="rgn-header">Region Select</div>' + html;

    // Keyboard grid navigation for region selector
    wireRegionGridKeys(checkboxContainer);

    // Add link generation to check boxes
    const checkboxes =
      checkboxContainer.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');

    checkboxes.forEach((cb) => {
      cb.addEventListener('change', () => {
        MAP_LINK.generateLinkEvent();
      });
    });

    // Add input validation for resource and player IDs
    MAP_LINK.addCommaNumberValidation('res-ids');
    MAP_LINK.addCommaNumberValidation('player-ids');
    MAP_LINK.addCommaNumberValidation('enemy-ids');

    const btn: HTMLElement | null = document.getElementById('lnk-gen-btn');
    if (!btn) return;
    const matrixWrapper: HTMLElement | null = document.getElementById('id-matrix');
    if (!matrixWrapper) return;

    MAP_LINK.renderResourceMatrix();
    MAP_LINK.renderEnemyMatrix();

    btn?.addEventListener('click', (): void => MAP_LINK.generateLinkEvent());
  },
};

function wireRegionGridKeys(container: HTMLElement): void {
  // Enabled regions form a 3x3 interior grid
  const NAV_COLS = 3;

  container.addEventListener('keydown', (e: KeyboardEvent) => {
    const current = e.target as HTMLElement;
    if (!current.matches('label[tabindex]')) return;

    const labels = Array.from(container.querySelectorAll<HTMLElement>('label[tabindex]'));
    const idx = labels.indexOf(current);
    if (idx === -1) return;

    let next: number | null = null;

    switch (e.key) {
      case KeyboardKey.ArrowRight:
        if ((idx + 1) % NAV_COLS !== 0) next = idx + 1;
        break;
      case KeyboardKey.ArrowLeft:
        if (idx % NAV_COLS !== 0) next = idx - 1;
        break;
      case KeyboardKey.ArrowDown:
        next = idx + NAV_COLS;
        break;
      case KeyboardKey.ArrowUp:
        next = idx - NAV_COLS;
        break;
      case KeyboardKey.Enter:
      case ' ': {
        e.preventDefault();
        const input = current.querySelector('input') as HTMLInputElement | null;
        if (input && !input.disabled) {
          input.checked = !input.checked;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }
      default:
        return;
    }

    e.preventDefault();
    if (next === null || next < 0 || next >= labels.length) return;

    current.setAttribute('tabindex', '-1');
    labels[next].setAttribute('tabindex', '0');
    labels[next].focus();
  });
}

// Combine all UI modules into single export
export const UI = Object.assign({}, BaseUI, DashboardUI, IdsUI);
