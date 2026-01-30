// Planner domain types

import type { MappingType, ProcessedNode } from './codex.js';

// =============================================================================
// ITEM MAPPINGS
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
// TRACKABLE ITEMS
// =============================================================================

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
    sources: string[];  // which research branches need this item
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

// =============================================================================
// AGGREGATION RESULTS
// =============================================================================

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
// PROGRESS REPORT
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
// PLANNER STATE
// =============================================================================

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

export interface PlannerState {
    targetTier: number;
    codexCount: number | null;
    results: PlannerResults | null;
}

// =============================================================================
// PLANNER CONFIGURATION
// =============================================================================

export interface TierRequirement {
    codexTier: number;
    count: number;
}

export type TierRequirements = Record<number, TierRequirement>;

export interface CalculateOptions {
    customCount?: number;
}