import { createLogger } from './logger.js';
import { API } from './api.js';
import type { LogCitizen, LogBuildings, SourceContainer } from './types/log-parser.js';
import type { Building, Citizen } from './types/api.js';

const log = createLogger('log-parser');
let logContainerData: SourceContainer;
export const logParserUI = {
  async loadAndRender(claimId: string) {
    const el = document.getElementById('log-content');
    if (!el) return;
    el.innerHTML = '<p class="cz-loading">Loading data...</p>';
    const loaded = await logParserUI.load(claimId);
    if (!loaded) {
      log.info('loading not successful');
      return;
    }
    logParserUI.render(logContainerData, el);
  },
  render(containerData: SourceContainer, el: HTMLElement): void {
    let html = `<table>`;
    const header = `<tr>
        <th>Citizen</th>
        <th>ContainerType</th>
        <th>ContainerName</th>
    </tr>`;
    const citizen = containerData.citizen;
    const buildings = containerData.buildings;
    const maxLength = Math.max(buildings.length, citizen.length);
    let content = '';
    for (let i = 0; i < maxLength; i++) {
      content += `<tr>
        <td>${citizen[i]?.userName}</td>
        <td>${buildings[i]?.buildingName}</td>
        <td>${buildings[i]?.buildingNickname}</td>
      </tr>`;
    }
    html += header;
    html += content;
    html += `</table>`;

    el.innerHTML = html;
  },
  async load(claimId: string) {
    let buildingsData;
    let citizenData;
    try {
      const citizenResponse = await API.getClaimCitizens(claimId);
      citizenData = citizenResponse.citizens;
    } catch (err) {
      const error = err as Error;
      log.error('Failed to load citizens:', error.message);
      return false;
    }
    try {
      buildingsData = await API.getClaimBuildings(claimId);
    } catch (err) {
      const error = err as Error;
      log.error('Failed to load buildings:', error.message);
      return false;
    }
    logContainerData = logParserUI.buildSourceContainer(buildingsData, citizenData);
    return true;
  },

  buildSourceContainer(buildings: Building[], citizenData: Citizen[]): SourceContainer {
    const logCitizens: LogCitizen[] = citizenData.map((record) => ({
      entityId: record.entityId,
      userName: record.userName,
    }));
    const logBuildings: LogBuildings[] = buildings.map((record) => ({
      buildingName: record.buildingNickname,
      buildingNickname: record.buildingNickname,
      entityId: record.entityId,
    }));
    return {
      buildings: logBuildings,
      citizen: logCitizens,
    };
  },
};
