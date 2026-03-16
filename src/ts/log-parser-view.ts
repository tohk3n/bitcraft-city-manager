import { createLogger } from './logger';

const log = createLogger('log-parser');
let buildingsData;
let citizenData;

export const logParserUI = {
  async loadAndRender(claimId: string) {
    const el = document.getElementById('log-content');
    if (!el) return null;

    el.innerHTML = '<p class="cz-loading">Loading data...</p>';

    if (!lastClaimId || claimId !== lastClaimId) {
      const loaded = await logParserUI.load(claimId);
      if (!loaded) {
        return;
      }
    }

    logParserUI.render(el, buildingsData, citizenData);
    lastClaimId = claimId;
  },

  async load(claimId: string) {
    try {
      citizenData = await fetchCitizens(claimId);
      log.info('citizenResponse', citizenData);

      try {
        buildingsData = await API.getClaimBuildings(claimId);
        log.info('buildingResponse', buildingsData);
      } catch (err) {
        const error = err as Error;
        log.error('Failed to load buildings:', error.message);
        return null;
      }
    } catch (err) {
      const error = err as Error;
      log.error('Failed to load citizens:', error.message);
      return null;
    }

    return true;
  },

  render(container: HTMLElement, buildings: Building[], citizens: CitizensData) {
    if (!container || !citizens || !buildings) return;

    const buildingNames: string[] = [];

    for (const building of buildings) {
      buildingNames.push(building.buildingNickname);
    }

    log.info(citizens);
  },
};
