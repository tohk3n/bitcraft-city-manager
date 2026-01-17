// API wrapper - all calls to bitjita go through proxy
const API = {
  async fetch(path) {
    const response = await fetch(`/api/proxy?path=${encodeURIComponent(path)}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return response.json();
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
