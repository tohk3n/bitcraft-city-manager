/**
 * Bitcraft City Manager - Type Definitions
 *
 * Organized into sections:
 * 1. API Response Types (BitJita endpoints)
 * 2. Codex Types (recipe structures)
 * 3. Internal Domain Types (processed data)
 */
import {CELL_TYPE} from "./config";

// =============================================================================
// 1. API RESPONSE TYPES
// =============================================================================

// --- Common API Types ---

export interface ApiItem {
    id: number;
    name: string;
    tier: number;
    tag?: string;
}

export interface ApiCargo {
    id: number;
    name: string;
    tier: number;
    tag?: string;
}

// --- Claim Endpoints ---

export interface ClaimDetails {
    id: string;
    name: string;
    tier: number;
    regionName?: string;
    supplies?: number;
    suppliesPurchaseThreshold?: number;
    suppliesRunOut?: string;  // ISO date string
    treasury?: number | string;
    numTiles?: number;
    upkeepCost?: number;
}

export interface ClaimResponse {
    claim?: ClaimDetails;
}

export interface InventorySlotContents {
    item_id: number;
    item_type: 'item' | 'cargo';
    quantity: number;
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
    tags: string;  // e.g., "Cloth Clothing", "Leather Armor"
    rarityString?: string;
}

export interface EquipmentSlot {
    primary: string;  // e.g., "head_clothing", "torso_clothing"
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

export interface PlayerEquipmentResponse {
    equipment: EquipmentSlot[];
}

// --- Vault Endpoint ---

export interface VaultCollectible {
    name: string;
    tier: number;
    type: number;      // Slot type code (8=head, 9=belt, etc.)
    tag: string;       // e.g., "Cloth Clothing", "Metal Armor"
    rarityStr?: string;
}

export interface PlayerVaultResponse {
    collectibles: VaultCollectible[];
}

// --- Items Endpoint ---

export interface ItemsResponse {
    items: ApiItem[];
}

export interface ItemResponse extends ApiItem {}


// =============================================================================
// 2. CODEX TYPES
// =============================================================================

// --- Raw Codex Structure (from JSON files) ---

export interface CodexNode {
    name: string;
    tier: number;
    qty: number;
    children: CodexNode[];
}

export interface Codex {
    name: string;
    tier: number;
    researches: CodexNode[];
}

// --- Expanded Codex (after recipe-expander) ---

export type MappingType =
| 'research'
| 'intermediate'
| 'gathered'
| 'reagent'
| 'mob_drop'
| 'fish'
| 'container'
| 'codex'
| 'study_material'
| 'alias'
| 'likely_api'
| 'unknown'
| null;

export interface ExpandedNode {
    name: string;
    tier: number;
    recipeQty: number;
    idealQty: number;
    trackable: boolean;
    mappingType: MappingType;
    children: ExpandedNode[];
}

export interface ExpandedCodex {
    name: string;
    tier: number;
    targetCount: number;
    researches: ExpandedNode[];
}

// --- Processed Codex (after cascade-calc) ---

export type NodeStatus = 'complete' | 'partial' | 'missing';

export interface ProcessedNode {
    name: string;
    tier: number;
    recipeQty: number;
    idealQty: number;
    required: number;
    have: number;
    deficit: number;
    contribution: number;
    pctComplete: number;
    status: NodeStatus;
    satisfied: boolean;
    satisfiedByParent: boolean;
    trackable: boolean;
    mappingType: MappingType;
    children: ProcessedNode[];
}

export interface ProcessedCodex {
    name: string;
    tier: number;
    targetCount: number;
    researches: ProcessedNode[];
    studyJournals: ProcessedNode | null;
}


// =============================================================================
// 3. ITEM MAPPINGS
// =============================================================================

export interface ItemMapping {
    type: MappingType;
    trackable: boolean;
    note?: string;
    tiers?: number[];
    apiEquivalent?: string;
    convertsTo?: string;
}

export interface ItemMappingsFile {
    version: number;
    generated: string;
    description: string;
    usage: Record<string, string>;
    stats: {
        totalCodexItems: number;
        directlyMatched: number;
        requiresMapping: number;
    };
    mappings: Record<string, ItemMapping>;
}


// =============================================================================
// 4. INTERNAL DOMAIN TYPES
// =============================================================================

// --- Inventory Processing ---

export interface TierQuantities {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
    6: number;
    7: number;
    8: number;
    9: number;
    10: number;
}

export type MaterialCategory =
| 'Wood'
| 'Metal'
| 'Stone'
| 'Cloth'
| 'Farming'
| 'Fishing'
| 'Leather';

export type MaterialMatrix = Record<MaterialCategory, TierQuantities>;

export interface FoodItem {
    name: string;
    tier: number;
    qty: number;
}

export type FoodItems = Record<number, FoodItem>;  // keyed by item ID

export type ScholarByTier = TierQuantities;

export interface BuildingBreakdown {
    name: string;
    qty: number;
}

export interface InventoryItem {
    id: number;
    name: string;
    tier: number;
    qty: number;
    buildings: BuildingBreakdown[];
}

export interface TagGroup {
    items: Record<number, InventoryItem>;  // keyed by item ID
    total: number;
}

export type CategoryInventory = Record<string, TagGroup>;  // tag -> TagGroup

export type ProcessedInventory = Record<string, CategoryInventory>;  // category -> tags

export interface InventoryProcessResult {
    inventory: ProcessedInventory;
    materialMatrix: MaterialMatrix;
    foodItems: FoodItems;
    scholarByTier: ScholarByTier;
}

// --- Crafting Stations ---

export interface StationSummary {
    tiers: TierQuantities;
    total: number;
}

export type StationsByName = Record<string, StationSummary>;

export interface CraftingStationsResult {
    active: StationsByName;
    passive: StationsByName;
}

// --- Inventory Matcher ---

export type InventoryLookup = Map<string, number>;  // "name:tier" -> quantity

export interface ItemQuantityResult {
    qty: number;
    mapping: ItemMapping | null;
    trackable: boolean;
}

export interface MetaLookups {
    itemMeta: Record<number, ApiItem>;
    cargoMeta: Record<number, ApiCargo>;
}

// --- Cascade Calculator Collection Results ---

export interface TrackableItem {
    name: string;
    tier: number;
    required: number;
    have: number;
    deficit: number;
    pctComplete: number;
    mappingType: MappingType;
}

export interface FirstTrackableItem extends TrackableItem {
    sources: string[];
}

export interface SecondLevelItem {
    name: string;
    tier: number;
    required: number;
    have: number;
    deficit: number;
    trackable: boolean;
    mappingType: MappingType;
}

// --- Aggregation Results ---

export interface AggregatedItem {
    name: string;
    tier: number;
    idealQty: number;
    trackable: boolean;
    mappingType: MappingType;
    sources: string[];
}

export interface FlattenedItem {
    name: string;
    tier: number;
    idealQty: number;
    trackable: boolean;
    mappingType: MappingType;
    research: string;
}

export interface FirstTrackableResult {
    name: string;
    tier: number;
    idealQty: number;
    mappingType: MappingType;
    parent: string | null;
}


// =============================================================================
// 5. UI STATE TYPES
// =============================================================================

export type ViewId = 'inventory' | 'planner' | 'citizens' | 'ids' | 'mapLinkComposer';

export type IdsTabType = 'citizens' | 'items';

// Vault cache: playerId -> filtered vault items
export type VaultCache = Record<string, VaultCollectible[]>;


// =============================================================================
// 6. CONFIG TYPES
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
// 7. APPLICATION STATE TYPES
// =============================================================================

export interface ClaimData {
    claimId: string | null;
    claimInfo: ClaimResponse | null;
    inventories: ClaimInventoriesResponse | null;
    citizens: ClaimCitizensResponse | null;
    buildings: ClaimBuildingsResponse | null;
    items: ApiItem[] | null;
}

export interface PlannerState {
    targetTier: number;
    codexCount: number | null;
    results: PlannerResults | null;
}

export interface PlannerResults {
    targetTier: number;
    codexTier: number;
    codexCount: number;
    codexName: string;
    researches: ProcessedNode[];
    studyJournals: ProcessedNode | null;
    summary: SecondLevelItem[];
    report: ProgressReport;
}

// =============================================================================
// 8. PROGRESS REPORT TYPES
// =============================================================================

export interface ProgressOverall {
    percent: number;
    totalRequired: number;
    totalContribution: number;
    completeCount: number;
    totalItems: number;
}

export interface ActivityGroup {
    activity: string;
    items: TrackableItem[];
    totalDeficit: number;
}

export interface ResearchProgress {
    percent: number;
    totalRequired: number;
    totalContribution: number;
    items: TrackableItem[];
}

export interface ProgressReport {
    overall: ProgressOverall;
    byActivity: Record<string, ActivityGroup>;
    byResearch: Record<string, ResearchProgress>;
    trackableItems: TrackableItem[];
    firstTrackable: FirstTrackableItem[];
    secondLevel: SecondLevelItem[];
    targetCount: number;
}

// =============================================================================
// 9. PLANNER CONFIGURATION
// =============================================================================

export interface TierRequirement {
    codexTier: number;
    count: number;
}

export type TierRequirements = Record<number, TierRequirement>;

export interface CalculateOptions {
    customCount?: number;
}

// =============================================================================
// 10. RESOURCE MATRIX KEY TYPE
// =============================================================================

export type ResourceRowName = keyof ResourceIdMatrix;

export type StateMatrixEntry = {
    category: string;
    col: number;
    state: CELL_TYPE;
};
