// Map link composer functionality
import { CONFIG } from './config.js';

export const MAP_LINK = {
  // Gets values from checkboxes and input fields to generate link
  generateLinkEvent() {
    const checkboxes = Array
    .from(document.querySelectorAll('#checkbox-row input[type="checkbox"]:checked'))
    .map(cb => cb.value);

    let resourceIdInput = document.getElementById("res-ids")?.value || '';
    let playerIdInput = document.getElementById("player-ids")?.value || '';

    // Remove possible trailing comma
    resourceIdInput = MAP_LINK.finalizeCommaNumberInput(resourceIdInput);
    playerIdInput = MAP_LINK.finalizeCommaNumberInput(playerIdInput);

    // Build the link
    const generatedLink = this.generateLink(checkboxes, resourceIdInput, playerIdInput);
    const displayLink = this.generateDisplayLink(checkboxes, resourceIdInput, playerIdInput);
    // Show link in UI
    const linkEl = document.getElementById("map-link");
    linkEl.href = generatedLink;
    linkEl.textContent = displayLink;
  },

  // ONLY for display, its not a correct link (so it might not work)
  generateDisplayLink(regions, resourceIds, playerIds) {
    const dataMap = {};

    if(regions.length > 0){
      dataMap.regionId = regions.join(',');
    }
    if (resourceIds !== '') {
      dataMap.resourceId = encodeURIComponent(resourceIds);
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
  }
  // Generate link to bitcraft map from provided data
  generateLink(regions, resourceIds, playerIds) {
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
  addCommaNumberValidation(inputId) {
    const field = document.getElementById(inputId);
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
  finalizeCommaNumberInput(value) {
    return value.replace(/,+$/, '');
  },

  // Add or remove new value to input field, separates by comma, leaves the rest intact
  syncInputValue(value, activated){
    value = String(value)
    const inputField = document.getElementById('res-ids');
    if(!inputField) return;

    const resultValue = inputField.value.trim();
    const values = resultValue
      ? new Set(resultValue.split(',').map(v => v.trim()))
      : new Set();

    if (activated) {
      values.add(value);
    } else {
      values.delete(value);
    }
    inputField.value = Array.from(values).join(',');
  },

  cellButtonEvent(cellArea){
    if (!cellArea) return;
    if (!cellArea?.dataset.row || !cellArea?.dataset.tier) return;

    const isActive = cellArea.classList.contains('active');

    const rowName = cellArea.dataset.row;
    const tier = cellArea.dataset.tier;
    const index = tier - 1;

    if(!CONFIG.RESOURCE_ID_MATRIX[rowName]){return};
    if(!CONFIG.RESOURCE_ID_MATRIX[rowName][index]){return};
    //get corresponding ids for this row/tier
    const idValues = CONFIG.RESOURCE_ID_MATRIX[rowName][index];
    //update input field
    idValues.forEach(id => this.syncInputValue(id,!isActive))

    //update state
    if(!isActive){
      cellArea.classList.add('active');
    }else{
      cellArea.classList.remove('active');
    }
  }
};
