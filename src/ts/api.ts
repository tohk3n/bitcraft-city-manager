// API wrapper - all calls to bitjita go through proxy
import { createLogger } from './logger.js';
import type {
  ClaimResponse,
  ClaimSearchResponse,
  ClaimInventoriesResponse,
  ClaimCitizensResponse,
  ItemsResponse,
  ItemResponse,
  PlayerEquipmentResponse,
  PlayerVaultResponse, Building
} from './types/index.js';

const log = createLogger('API');

export const API = {
  async fetch<T>(path: string): Promise<T> {
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
    return data as T;
  },

  searchClaims(query: string, limit: 10): Promise<ClaimSearchResponse> {
    return this.fetch<ClaimSearchResponse>(`/claims?q=${encodeURIComponent(query)}&limit=${limit}`);
  },

  getClaim(claimId: string): Promise<ClaimResponse> {
    return this.fetch<ClaimResponse>(`/claims/${claimId}`);
  },

  getClaimInventories(claimId: string): Promise<ClaimInventoriesResponse> {
    return this.fetch<ClaimInventoriesResponse>(`/claims/${claimId}/inventories`);
  },

  getClaimCitizens(claimId: string): Promise<ClaimCitizensResponse> {
    return this.fetch<ClaimCitizensResponse>(`/claims/${claimId}/citizens`);
  },

  getClaimBuildings(claimId: string): Promise<Building[]> {
    return this.fetch<Building[]>(`/claims/${claimId}/buildings`);
  },

  getItems(): Promise<ItemsResponse> {
    return this.fetch<ItemsResponse>('/items');
  },

  getItem(itemId: number): Promise<ItemResponse> {
    return this.fetch<ItemResponse>(`/items/${itemId}`);
  },

  getPlayerEquipment(playerId: string): Promise<PlayerEquipmentResponse> {
    return this.fetch<PlayerEquipmentResponse>(`/players/${playerId}/equipment`);
  },

  getPlayerInventories(playerId: string): Promise<unknown> {
    return this.fetch<unknown>(`/players/${playerId}/inventories`);
  },

  getPlayerVault(playerId: string): Promise<PlayerVaultResponse> {
    return this.fetch<PlayerVaultResponse>(`/players/${playerId}/vault`);
  }
};
