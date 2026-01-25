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
    const generatedLink = MAP_LINK.generateLink(checkboxes, resourceIdInput, playerIdInput);
    const displayLink = MAP_LINK.generateDisplayLink(checkboxes, resourceIdInput, playerIdInput);
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
  // Synchronize the resource ID matrix to match the input
  syncMatrixState(resourceIdInput)
  {
    const inputIds = resourceIdInput.split(',');
    const stateObject = MAP_LINK.buildStateMatrix(inputIds);
    MAP_LINK.setMatrixState(stateObject);
  },
  buildStateMatrix(idsToCheck) {

    const idSet = new Set(idsToCheck.map(Number));
    const result = [];
    const matrix = CONFIG.RESOURCE_ID_MATRIX;
    let categoryIndex = 0;
    let lastCategory = ''
    for (const [category, arrayOfArrays] of Object.entries(matrix)) {
      arrayOfArrays.forEach((ids, index) => {
        const matches = ids.filter(id => idSet.has(id)).length;
        if(lastCategory === ''){
          lastCategory = category;
        }
        if(lastCategory !== category){
          lastCategory = category;
          categoryIndex++;
        }
        let status;
        //TODO add enum for states
        if (matches === 0) {
          status = 'none';
        } else if (matches === ids.length) {
          status = 'full';
        } else {
          status = 'part';
        }

        result.push({
          category,
          row: categoryIndex,
          col: index, // 0–9
          status
        });
      });
    }
    return result
  },

  cellButtonEvent(rowName,tier){
    const cellArea = document.querySelector(
          `[data-row="${rowName}"][data-tier="${tier}"]`
        );
    const isActive = cellArea.classList.contains('full')||cellArea.classList.contains('part');
    const index = tier - 1;

    if(!CONFIG.RESOURCE_ID_MATRIX[rowName]){return};
    if(!CONFIG.RESOURCE_ID_MATRIX[rowName][index]){return};
    //get corresponding ids for this row/tier
    const idValues = CONFIG.RESOURCE_ID_MATRIX[rowName][index];
    //update input field
    idValues.forEach(id => this.syncInputValue(id,!isActive))
    //update matrix state
    const inputField = document.getElementById('res-ids');
    const fieldValues = inputField.value;
    MAP_LINK.syncMatrixState(fieldValues);

  },
  // Uses StateMatrix to set states for all cells
  setMatrixState(stateObject){
    const table = document.getElementById("id-matrix");

    stateObject.forEach(entry =>{
      const cell = MAP_LINK.getCell(table,entry.category,entry.col);
      MAP_LINK.setCellState(cell,entry.status);
    })
  },
  getCell(table, row, tier) {
    if (!table) return;

    const el = document.querySelector(
      `[data-row="${row}"][data-tier="${tier}"]`
    );

    return el;
  },
  //TODO add enum for states
  setCellState(cell, state){
    if(!cell)return;
    if(cell.classList.contains(state)) return;

    if(cell.classList.contains("part")){
      cell.classList.remove("part");
    }
    if(cell.classList.contains("full")){
      cell.classList.remove("full");
    }
    if(cell.classList.contains("none")){
      cell.classList.remove("none");
    }

    if(state==="full"){
      cell.classList.add("full");
    }else if(state === "part"){
      cell.classList.add("part");
    }else{
      cell.classList.add("none");
    }
  }
};
const STATE = { NONE: 'none', PART: 'part', FULL: 'full' };