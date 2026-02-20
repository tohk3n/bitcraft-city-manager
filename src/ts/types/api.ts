// BitJita API response types

// --- Common API Types ---

export interface ApiItem {
  id: number;
  name: string;
  tier: number;
  tag?: string;
  rarity?: number;
}

export interface ApiCargo {
  id: number;
  name: string;
  tier: number;
  tag?: string;
  rarity?: number;
}

// --- Claim Endpoints ---

export interface ClaimDetails {
  id: string;
  name: string;
  tier: number;
  regionName?: string;
  supplies?: number;
  suppliesPurchaseThreshold?: number;
  suppliesRunOut?: string; // ISO date string
  treasury?: number | string;
  numTiles?: number;
  upkeepCost?: number;
}

export interface ClaimResponse {
  claim?: ClaimDetails;
}

// --- Claim Search Endpoint ---

export interface ClaimSearchResult {
  entityId: string;
  name: string;
  tier: number;
  regionName?: string;
}

export interface ClaimSearchResponse {
  claims: ClaimSearchResult[];
  count: number;
}

// --- Inventory ---

export interface InventorySlotContents {
  item_id: number;
  item_type: 'item' | 'cargo';
  quantity: number;
  rarity: number;
}

export interface InventorySlot {
  contents: InventorySlotContents | null;
}

export interface BuildingFunction {
  level: number;
  crafting_slots?: number;
  refining_slots?: number;
}

export interface Building {
  buildingName: string;
  buildingNickname?: string;
  inventory?: InventorySlot[];
  functions?: BuildingFunction[];
}

export interface ClaimInventoriesResponse {
  buildings: Building[];
  items: ApiItem[];
  cargos: ApiCargo[];
}

export interface ClaimBuildingsResponse {
  buildings: Building[];
}

// --- Citizen/Player Endpoints ---

export interface EquippedItem {
  name: string;
  tier: number;
  tags: string; // e.g., "Cloth Clothing", "Leather Armor"
  rarityString?: string;
}

export interface EquipmentSlot {
  primary: string; // e.g., "head_clothing", "torso_clothing"
  item: EquippedItem | null;
}

export interface Citizen {
  entityId: string;
  userName?: string;
  equipment: EquipmentSlot[];
}

export interface ClaimCitizensResponse {
  citizens: Citizen[];
}

export interface CitizensApiResponse extends ClaimCitizensResponse {
  skillNames?: Record<string, string>;
}

export interface CitizenWithSkills {
  entityId: string;
  userName?: string;
  skills?: Record<string, number>;
  totalSkills?: number;
  highestLevel?: number;
  totalLevel?: number;
  totalXP?: number;
}

export interface PlayerEquipmentResponse {
  equipment: EquipmentSlot[];
}

// --- Vault Endpoint ---

export interface VaultCollectible {
  name: string;
  tier: number;
  type: number; // Slot type code (8=head, 9=belt, etc.)
  tag: string; // e.g., "Cloth Clothing", "Metal Armor"
  rarityStr?: string;
}

export interface PlayerVaultResponse {
  collectibles: VaultCollectible[];
}

// --- Items Endpoint ---

export interface ItemsResponse {
  items: ApiItem[];
}

export type ItemResponse = ApiItem;
