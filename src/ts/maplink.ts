// Map link composer functionality
import {CELL_TYPE, LINK_PARAM, MAP_CONFIG} from './configuration/maplinkconfig.js';

import {ResourceIdMatrix, ResourceRowName, StateMatrixEntry} from './types.js';

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

        let displayUrl = MAP_CONFIG.BASE_URL;
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
    const url = new URL(MAP_CONFIG.BASE_URL);
    if (regions.length > 0) {
      url.searchParams.set(LINK_PARAM.REGION_ID, regions.join(','));
    }
    if (resourceIds !== '') {
      url.searchParams.set(LINK_PARAM.RESOURCE_ID, resourceIds);
    }
    if (playerIds !== '') {
      url.searchParams.set(LINK_PARAM.PLAYER_ID, playerIds);
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
    // Synchronize the resource ID matrix to match the input
    syncMatrixState(resourceIdInput: string ):void {
        const inputIds:string[] = resourceIdInput.split(',');
        const stateObject:StateMatrixEntry[] = MAP_LINK.buildStateMatrix(inputIds);
        MAP_LINK.setMatrixState(stateObject);
    },
    buildStateMatrix(idsToCheck: string[]): StateMatrixEntry[]  {

        const idSet = new Set(idsToCheck.map(Number));
        const result: StateMatrixEntry[] = [];
        const matrix:ResourceIdMatrix = MAP_CONFIG.RESOURCE_ID_MATRIX;

        for (const [category, arrayOfArrays] of Object.entries(matrix)) {
            arrayOfArrays.forEach((ids:number[], index:number):void => {
                const matches:number = ids.filter(id => idSet.has(id)).length;
                let state;
                if (matches === 0) {
                    state = CELL_TYPE.NONE;
                } else if (matches === ids.length) {
                    state = CELL_TYPE.FULL;
                } else {
                    state = CELL_TYPE.PART;
                }

                result.push({
                    category,
                    col: index, // 0–9
                    state: state
                });
            });
        }
        return result;
    },
    cellButtonEvent(rowName:ResourceRowName, tier:number):void {
        const cellArea:Element|null = document.querySelector(`[data-row="${rowName}"][data-tier="${tier}"]`);
        if(!cellArea)return;
        const isActive:boolean | undefined = cellArea?.classList.contains(CELL_TYPE.FULL) || cellArea?.classList.contains(CELL_TYPE.PART);
        if(isActive===undefined)return;
        const index:number = tier - 1;

        //get corresponding ids for this row/tier
        const idValues:number[] = MAP_CONFIG.RESOURCE_ID_MATRIX?.[rowName]?.[index];
        if(!idValues)return;
        //update input field
        idValues.forEach(id => this.syncInputValue(id, !isActive))
        //update matrix state
        const inputField = document.getElementById('res-ids') as HTMLInputElement | null;
        if(!inputField) return;
        const fieldValues:string = inputField.value;
        MAP_LINK.syncMatrixState(fieldValues);
    },
    // Uses an array of stateMatrixEntries to set states for all cells
    setMatrixState(stateObjectArray:StateMatrixEntry[]):void {
        const table:HTMLElement|null = document.getElementById("id-matrix");
        if(!table)return;
        stateObjectArray.forEach(entry => {
            const cell:HTMLElement|null|undefined = MAP_LINK.getCell(table, entry.category, entry.col + 1);
            if(cell) {
                MAP_LINK.setCellState(cell, entry.state);
            }
        })
    },
    getCell(table:HTMLElement, row:string, tier:number):HTMLElement|null {
        if (!table) return null;

        return document.querySelector(`[data-row="${row}"][data-tier="${tier}"]`);
    },
    setCellState(cell:HTMLElement, state:CELL_TYPE):void {
        if (!cell || !Object.values(CELL_TYPE).includes(state)) return;

        cell.classList.remove(...Object.values(CELL_TYPE));
        cell.classList.add(state);
    }
};
