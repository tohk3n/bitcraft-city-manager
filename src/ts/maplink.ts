// Map link composer functionality
import { CONFIG } from './config.js';
import type { ResourceRowName } from './types.js';

interface LinkDataMap {
  regionId?: string;
  resourceId?: string;
  playerId?: string;
}

export const MAP_LINK = {
  // Gets values from checkboxes and input fields to generate link
  generateLinkEvent(): void {
    const checkboxes = Array
    .from(document.querySelectorAll<HTMLInputElement>('#checkbox-row input[type="checkbox"]:checked'))
    .map(cb => cb.value);

    const resIdsEl = document.getElementById("res-ids") as HTMLInputElement | null;
    const playerIdsEl = document.getElementById("player-ids") as HTMLInputElement | null;

    let resourceIdInput = resIdsEl?.value || '';
    let playerIdInput = playerIdsEl?.value || '';

    // Remove possible trailing comma
    resourceIdInput = MAP_LINK.finalizeCommaNumberInput(resourceIdInput);
    playerIdInput = MAP_LINK.finalizeCommaNumberInput(playerIdInput);

    // Build the link
    const generatedLink = MAP_LINK.generateLink(checkboxes, resourceIdInput, playerIdInput);
    const displayLink = MAP_LINK.generateDisplayLink(checkboxes, resourceIdInput, playerIdInput);

    // Show link in UI
    const linkEl = document.getElementById("map-link") as HTMLAnchorElement | null;
    if (linkEl) {
      linkEl.href = generatedLink.toString();
      linkEl.textContent = displayLink;
    }
  },

  // ONLY for display, its not a correct link (so it might not work)
  generateDisplayLink(regions: string[], resourceIds: string, playerIds: string): string {
    const dataMap: LinkDataMap = {};

    if (regions.length > 0) {
      dataMap.regionId = regions.join(',');
    }
    if (resourceIds !== '') {
      dataMap.resourceId = resourceIds;
    }
    if (playerIds !== '') {
      dataMap.playerId = playerIds;
    }

    let displayUrl = CONFIG.MAP_BASE_URL;
    let first = true;

    // First value has ? prefix, subsequent use &
    for (const [key, value] of Object.entries(dataMap)) {
      const prefix = first ? '?' : '&';
      displayUrl += `${prefix}${key}=${value}`;
      first = false;
    }
    return displayUrl;
  },

  // Generate link to bitcraft map from provided data
  generateLink(regions: string[], resourceIds: string, playerIds: string): URL {
    const url = new URL(CONFIG.MAP_BASE_URL);
    if (regions.length > 0) {
      url.searchParams.set("regionId", regions.join(','));
    }
    if (resourceIds !== '') {
      url.searchParams.set("resourceId", resourceIds);
    }
    if (playerIds !== '') {
      url.searchParams.set("playerId", playerIds);
    }

    return url;
  },

  // Add input validation for comma-separated number fields
  addCommaNumberValidation(inputId: string): void {
    const field = document.getElementById(inputId) as HTMLInputElement | null;
    if (!field) return;

    field.addEventListener('input', () => {
      let value = field.value;

      value = value
      .replace(/[^0-9,]/g, '')  // only numbers and commas
      .replace(/^,+/, '')       // no leading commas
      .replace(/\s*,\s*/g, ',') // no spaces around commas
      .replace(/,{2,}/g, ',');  // no duplicate commas

      field.value = value;
    });
  },

  // Clean up trailing commas from input
  finalizeCommaNumberInput(value: string): string {
    return value.replace(/,+$/, '');
  },

  // Add or remove new value to input field, separates by comma, leaves the rest intact
  syncInputValue(value: string | number, activated: boolean): void {
    const strValue = String(value);
    const inputField = document.getElementById('res-ids') as HTMLInputElement | null;
    if (!inputField) return;

    const resultValue = inputField.value.trim();
    const values: Set<string> = resultValue
    ? new Set(resultValue.split(',').map(v => v.trim()))
    : new Set();

    if (activated) {
      values.add(strValue);
    } else {
      values.delete(strValue);
    }
    inputField.value = Array.from(values).join(',');
  },

  cellButtonEvent(cellArea: HTMLElement | null): void {
    if (!cellArea) return;
    if (!cellArea.dataset.row || !cellArea.dataset.tier) return;

    const isActive = cellArea.classList.contains('active');

    const rowName = cellArea.dataset.row as ResourceRowName;
    const tier = parseInt(cellArea.dataset.tier, 10);
    const index = tier - 1;

    const matrix = CONFIG.RESOURCE_ID_MATRIX;
    if (!matrix[rowName]) return;
    if (!matrix[rowName][index]) return;

    // Get corresponding ids for this row/tier
    const idValues = matrix[rowName][index];

    // Update input field
    idValues.forEach(id => this.syncInputValue(id, !isActive));

    // Update state
    if (!isActive) {
      cellArea.classList.add('active');
    } else {
      cellArea.classList.remove('active');
    }
  }
};
