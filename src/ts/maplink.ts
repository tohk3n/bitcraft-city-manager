// Map link composer functionality
import { CONFIG, MAP_CONFIG } from './configuration/index.js';
import type { NamedMatrix } from './types/index.js';
import { LINK_PARAM } from './types/index.js';
import { createLogger } from './logger.js';
import type {
  DataMatrixHandle,
  MatrixColumn,
  MatrixConfig,
  MatrixRow,
} from './components/data-matrix/data-matrix';
import { createDataMatrix } from './components/data-matrix/data-matrix.js';

const log = createLogger('mapLink');

interface LinkDataMap {
  regionId?: string;
  resourceId?: string;
  playerId?: string;
  enemyId?: string;
}
export const MAP_LINK = {
  selectedResourceIds: new Set<number>(),
  selectedEnemyIds: new Set<number>(),
  resourceHandle: null as DataMatrixHandle | null,
  enemyHandle: null as DataMatrixHandle | null,
  // Gets values from checkboxes and input fields to generate link
  generateLinkEvent(): void {
    const checkboxes = Array.from(
      document.querySelectorAll<HTMLInputElement>('#checkbox-row input[type="checkbox"]:checked')
    ).map((cb) => cb.value);

    const resIdsEl = document.getElementById('res-ids') as HTMLInputElement | null;
    const playerIdsEl = document.getElementById('player-ids') as HTMLInputElement | null;
    const enemyIdsEl = document.getElementById('enemy-ids') as HTMLInputElement | null;

    let resourceIdInput: string = resIdsEl?.value || '';
    let playerIdInput: string = playerIdsEl?.value || '';
    let enemyIdInput: string = enemyIdsEl?.value || '';
    // Remove possible trailing comma
    resourceIdInput = MAP_LINK.finalizeCommaNumberInput(resourceIdInput);
    playerIdInput = MAP_LINK.finalizeCommaNumberInput(playerIdInput);
    enemyIdInput = MAP_LINK.finalizeCommaNumberInput(enemyIdInput);

    // Build the link
    const generatedLink = MAP_LINK.generateLink(
      checkboxes,
      resourceIdInput,
      playerIdInput,
      enemyIdInput
    );
    const displayLink = MAP_LINK.generateDisplayLink(
      checkboxes,
      resourceIdInput,
      playerIdInput,
      enemyIdInput
    );

    // Show link in UI
    const linkEl = document.getElementById('map-link') as HTMLAnchorElement | null;
    if (linkEl) {
      linkEl.href = generatedLink.toString();
      linkEl.textContent = displayLink;
    }
  },

  // ONLY for display, it's not a correct link (so it might not work)
  generateDisplayLink(
    regions: string[],
    resourceIds: string,
    playerIds: string,
    enemyIds: string
  ): string {
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
    if (enemyIds !== '') {
      dataMap.enemyId = enemyIds;
    }

    let displayUrl: string = MAP_CONFIG.BASE_URL;
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
  generateLink(regions: string[], resourceIds: string, playerIds: string, enemyIds: string): URL {
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
    if (enemyIds !== '') {
      url.searchParams.set(LINK_PARAM.ENEMY_ID, enemyIds);
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
        .replace(/[^0-9,]/g, '') // only numbers and commas
        .replace(/^,+/, '') // no leading commas
        .replace(/\s*,\s*/g, ',') // no spaces around commas
        .replace(/,{2,}/g, ','); // no duplicate commas

      field.value = value;
    });
  },

  // Clean up trailing commas from input
  finalizeCommaNumberInput(value: string): string {
    return value.replace(/,+$/, '').replace(/,{2,}/g, ','); // no duplicate commas;
  },

  // Add cellValues to input field if none of them is in selected Ids
  // Removed if at least one value from cellValues is in selectedIds
  syncInputValue(cellValues: number[], elementName: string, selectedIds: Set<number>): void {
    const inputField = document.getElementById(elementName) as HTMLInputElement | null;
    if (!inputField) return;

    const resultValue = inputField.value.trim();
    const inputFieldValues: Set<number> = resultValue
      ? new Set(resultValue.split(',').map((v) => Number(v.trim())))
      : new Set();

    const removeValues = cellValues.some((id) => selectedIds.has(id));
    // order matters, so we handle the selected Ids her as well
    for (const val of cellValues) {
      if (removeValues) {
        inputFieldValues.delete(val);
        selectedIds.delete(val);
      } else {
        inputFieldValues.add(val);
        selectedIds.add(val);
      }
    }
    inputField.value = Array.from(inputFieldValues).join(',');
  },
  cellButtonEvent(
    entryKey: string,
    value: number[],
    sourceMap: NamedMatrix,
    elementName: string,
    selectedIds: Set<number>,
    after?: () => void
  ): void {
    log.debug(`Button clicked key $entryKey`, entryKey);
    if (!entryKey) return;
    if (entryKey in sourceMap.map) {
      this.syncInputValue(value, elementName, selectedIds);
    } else {
      return;
    }
    after?.();
  },
  // Generates table with clickable fields to add to input field for resource selection
  renderResourceMatrix(): void {
    const table: HTMLElement | null = document.getElementById('res-id-matrix');
    if (!table) return;
    const config: MatrixConfig = MAP_LINK.createResourceMatrixConfig(MAP_CONFIG.RESOURCE_ID_MATRIX);
    if (!this.resourceHandle) {
      this.resourceHandle = createDataMatrix(table, config);
    } else {
      this.resourceHandle.update(config);
    }
  },
  renderEnemyMatrix(): void {
    const table: HTMLElement | null = document.getElementById('enemy-id-matrix');
    if (!table) return;
    const config: MatrixConfig = MAP_LINK.createEnemyMatrixConfig(MAP_CONFIG.ENEMY_ID_MATRIX);
    if (!this.enemyHandle) {
      this.enemyHandle = createDataMatrix(table, config);
    } else {
      this.enemyHandle.update(config);
    }
  },
  buildRows(sourceMatrix: NamedMatrix): MatrixRow[] {
    const rows: MatrixRow[] = [];
    for (const resourceName of Object.keys(sourceMatrix.map)) {
      const key: string = resourceName;
      const label = resourceName;
      const cells = Object.fromEntries(
        Array.from({ length: CONFIG.MAX_TIER }, (_, i) => {
          return [String(i + 1), sourceMatrix.map[resourceName]?.[i] ?? []];
        })
      ) as Record<string, number[]>;
      rows.push({ key, label, cells });
    }
    return rows;
  },
  mapCellRenderer(value: unknown, selectedIds: Set<number>) {
    const ids = value as number[];

    const div = document.createElement('div');
    div.classList.add('matrix-cell-inner');
    if (!ids || ids.length === 0) {
      // no entries for this cell
      div.classList.add('none');
      return div;
    }
    const selected = ids.some((id) => selectedIds.has(id));
    if (selected) div.classList.add('active');

    return div;
  },
  createResourceMatrixConfig(sourceMatrix: NamedMatrix): MatrixConfig {
    const cols: MatrixColumn[] = [];

    for (let i = 1; i <= CONFIG.MAX_TIER; i++) {
      const key: string = i.toLocaleString();
      const label: string = 'T' + i.toLocaleString();
      cols.push({ key, label });
    }
    const rows: MatrixRow[] = this.buildRows(sourceMatrix);

    return {
      columns: cols,
      rows,
      showRowTotals: false,
      onCellClick: (rowKey, colKey, value) =>
        MAP_LINK.cellButtonEvent(
          rowKey,
          value as number[],
          MAP_CONFIG.RESOURCE_ID_MATRIX,
          'res-ids',
          this.selectedResourceIds,
          () => {
            MAP_LINK.renderResourceMatrix();
            MAP_LINK.generateLinkEvent();
          }
        ),
      renderCell: (value) => this.mapCellRenderer(value, this.selectedResourceIds),
    };
  },
  createEnemyMatrixConfig(sourceMatrix: NamedMatrix): MatrixConfig {
    const cols: MatrixColumn[] = [];
    for (let i = 1; i <= CONFIG.MAX_TIER; i++) {
      const key: string = i.toLocaleString();
      const label = '';
      cols.push({ key, label });
    }
    const rows: MatrixRow[] = this.buildRows(sourceMatrix);

    return {
      columns: cols,
      rows,
      showRowTotals: false,
      onCellClick: (rowKey, colKey, value) =>
        MAP_LINK.cellButtonEvent(
          rowKey,
          value as number[],
          MAP_CONFIG.ENEMY_ID_MATRIX,
          'enemy-ids',
          this.selectedEnemyIds,
          () => {
            MAP_LINK.renderEnemyMatrix();
            MAP_LINK.generateLinkEvent();
          }
        ),
      renderCell: (value) => this.mapCellRenderer(value, this.selectedEnemyIds),
    };
  },
};
