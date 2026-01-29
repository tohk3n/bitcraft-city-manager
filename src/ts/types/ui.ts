// UI state and configuration types

import type { CELL_TYPE } from './enums.js';
import type {
    ApiItem,
    ClaimResponse,
    ClaimInventoriesResponse,
    ClaimCitizensResponse,
    ClaimBuildingsResponse,
    VaultCollectible
} from './api.js';
import type { MaterialCategory } from './inventory.js';

// =============================================================================
// VIEW STATE
// =============================================================================

export type ViewId = 'inventory' | 'planner' | 'citizens' | 'ids' | 'mapLinkComposer';

export type IdsTabType = 'citizens' | 'items';

// Vault cache: playerId -> filtered vault items
export type VaultCache = Record<string, VaultCollectible[]>;

// =============================================================================
// CONFIG TYPES
// =============================================================================

export type EquipmentSlotName =
    | 'head_clothing'
    | 'torso_clothing'
    | 'hand_clothing'
    | 'belt_clothing'
    | 'leg_clothing'
    | 'feet_clothing';

export type GearType = 'Cloth Clothing' | 'Leather Clothing' | 'Metal Clothing';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface FlowchartZoomConfig {
    MIN: number;
    MAX: number;
    STEP: number;
    WHEEL_SENSITIVITY: number;
}

export interface ResourceIdMatrix {
    Trees: number[][];
    OreVeins: number[][];
    FiberPlants: number[][];
    Berries: number[][];
    Flowers: number[][];
    Mushrooms: number[][];
    Clay: number[][];
    Sand: number[][];
    Rock: number[][];
    Baitfish: number[][];
    LakeFish: number[][];
    OceanFish: number[][];
    Carvings: number[][];
    Sailing: number[][];
}

export interface Config {
    EQUIPMENT_SLOTS: EquipmentSlotName[];
    SLOT_DISPLAY_NAMES: string[];
    SLOT_TYPE_CODES: Record<EquipmentSlotName, number>;
    GEAR_TYPES: GearType[];
    CLOTHING_TAGS: string[];
    RARITY_ORDER: Rarity[];
    CATEGORY_ORDER: string[];
    INVENTORY_GRID_EXCLUDE: string[];
    MATRIX_CATEGORIES: MaterialCategory[];
    TAG_CATEGORIES: Record<string, string[]>;
    RAW_MATERIAL_TAGS: Set<string>;
    REGION_COUNT: number;
    MAX_TIER: number;
    MAP_BASE_URL: string;
    FLOWCHART_ZOOM: FlowchartZoomConfig;
    TAG_TO_CATEGORY: Record<string, string>;
    RESOURCE_ID_MATRIX: ResourceIdMatrix;
}

// =============================================================================
// APPLICATION STATE
// =============================================================================

export interface ClaimData {
    claimId: string | null;
    claimInfo: ClaimResponse | null;
    inventories: ClaimInventoriesResponse | null;
    citizens: ClaimCitizensResponse | null;
    buildings: ClaimBuildingsResponse | null;
    items: ApiItem[] | null;
}

// =============================================================================
// RESOURCE MATRIX
// =============================================================================

export type ResourceRowName = keyof ResourceIdMatrix;

export type StateMatrixEntry = {
    category: string;
    col: number;
    state: CELL_TYPE;
};

// =============================================================================
// CLAIM SEARCH
// =============================================================================

export interface ClaimSearchElements {
    input: HTMLInputElement;
    suggestions: HTMLUListElement;
}

export interface ClaimSearchCallbacks {
    onSelect: (claimId: string) => void;
    onDirectLoad: (claimId: string) => void;
}