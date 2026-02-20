// --- Player Inventory Endpoints ---
// Equipment and vault types live in api.ts; these cover the inventories endpoint.

export interface InventoryItemMeta {
  name: string;
  tier: number;
  rarityStr?: string;
  tag?: string;
  toolLevel?: number;
  toolPower?: number;
  toolType?: number;
  toolSkillId?: number;
}

export interface InventoryPocket {
  contents: { itemId: number; itemType: number; quantity: number } | null;
}

export interface PlayerInventory {
  inventoryName: string;
  pockets: InventoryPocket[];
}

export interface PlayerInventoriesResponse {
  inventories: PlayerInventory[];
  items: Record<string, InventoryItemMeta>;
}
