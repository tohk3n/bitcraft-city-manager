// API wrapper - all calls to bitjita go through proxy
import { createLogger } from './logger.js';

const log = createLogger('API');

export const API = {
  async fetch(path) {
    log.debug('Fetching', path);
    const done = log.time('fetch');

    const response = await fetch(`/api/proxy?path=${encodeURIComponent(path)}`);
    if (!response.ok) {
      log.error('Request failed', path, response.status);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    done();
    log.data(`Response ${path}`, data);
    return data;
  },

  getClaim(claimId) {
    return this.fetch(`/claims/${claimId}`);
  },

  getClaimInventories(claimId) {
    return this.fetch(`/claims/${claimId}/inventories`);
  },

  getClaimCitizens(claimId) {
    return this.fetch(`/claims/${claimId}/citizens`);
  },

  getClaimBuildings(claimId) {
    return this.fetch(`/claims/${claimId}/buildings`);
  },

  getItems() {
    return this.fetch('/items');
  },

  getItem(itemId) {
    return this.fetch(`/items/${itemId}`);
  },

  getPlayerEquipment(playerId) {
    return this.fetch(`/players/${playerId}/equipment`);
  },

  getPlayerInventories(playerId) {
    return this.fetch(`/players/${playerId}/inventories`);
  },

  getPlayerVault(playerId) {
    return this.fetch(`/players/${playerId}/vault`);
  }
};
