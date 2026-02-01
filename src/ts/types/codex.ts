// Codex and recipe type definitions

// =============================================================================
// RAW CODEX STRUCTURE (from JSON files)
// =============================================================================

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

// =============================================================================
// EXPANDED CODEX (after recipe-expander)
// =============================================================================

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

// =============================================================================
// PROCESSED CODEX (after cascade-calc)
// =============================================================================

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
// NORMALIZED RECIPE DATA (v2)
// =============================================================================

export interface RecipeInput {
  ref: string; // "Item Name:tier" format, e.g. "Exquisite Brick:5"
  qty: number;
}

/**
 * Recipe types determine node behavior in the crafting tree:
 * - gathered: Raw resources, leaf nodes with no inputs
 * - intermediate: Crafted items consumed in the same chain
 * - refined: Target materials for research completion
 * - research: Codex research goals (top-level nodes)
 * - study: Study journals and stone carvings
 */
export type RecipeType = 'gathered' | 'intermediate' | 'refined' | 'research' | 'study';

export interface Recipe {
  name: string; // Item name
  tier: number; // Item tier
  type: RecipeType;
  qty: number; // Output quantity per craft (alias for yields)
  yields: number; // Output quantity per craft
  inputs: RecipeInput[]; // Empty for gathered items
}

export interface RecipesFile {
  version: number;
  generated: string;
  recipes: Record<string, Recipe>; // Key: "Item Name:tier"
}

// =============================================================================
// CODEX FILE FORMAT
// =============================================================================

export interface CodexResearch {
  id: string; // Research name, e.g. "Apprentice Stone Research"
  tier: number;
  inputs: RecipeInput[]; // Direct inputs for research completion
}

export interface CodexTier {
  name: string; // e.g. "Apprentice Codex"
  tier: number;
  researches: CodexResearch[];
}

export interface CodexFile {
  version: number;
  generated: string;
  tiers: Record<string, CodexTier>; // Key: tier number as string
}
