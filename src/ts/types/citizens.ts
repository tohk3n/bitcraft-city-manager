// Citizen data types, the shapes that flow through the module.
//
// Types are split from logic so any file can import them without
// pulling in rendering code or API calls.

import type { EquipmentSlot, VaultCollectible } from './index.js';

// --- Gear & Tools ---

export interface GearSlot {
  name: string;
  tier: number;
  rarity: string;
  source: 'equipped' | 'vault';
}

export interface ToolItem {
  name: string;
  tier: number;
  rarity: string;
  tag: string;
  toolLevel: number;
  toolPower: number;
  toolType: number;
  toolSkillId: number;
  equipped: boolean;
  source: string;
}

export interface GearData {
  equipment: EquipmentSlot[];
  vault: VaultCollectible[];
  grid: Record<string, Record<string, GearSlot | null>>;
  tools: ToolItem[];
}

// --- Citizen Record ---

export interface CitizenRecord {
  entityId: string;
  userName: string;
  lastLogin: Date;
  totalSkills: number;
  highestLevel: number;
  totalLevel: number;
  totalXP: number;
  skills: Record<string, number> | null;
  gear: GearData | null;
  gearLoading: boolean;
  gearError: string | null;
}

export interface CitizensData {
  records: CitizenRecord[];
  skillNames: Record<string, string>;
}

// --- View State ---

export type ActivityThreshold = 0 | 7 | 14 | 30 | 60;
export type SortField = 'name' | 'lastLogin' | 'totalLevel' | 'highestLevel';

export interface ViewState {
  view: 'roster' | 'detail' | 'matrix';
  previousListView: 'roster' | 'matrix';
  selectedId: string | null;
  search: string;
  activityDays: ActivityThreshold;
  sortBy: SortField;
  matrixSortSkill: number | null;
  matrixSortDir: 'asc' | 'desc';
}

export const VIEW_DEFAULTS: ViewState = {
  view: 'matrix',
  previousListView: 'matrix',
  selectedId: null,
  search: '',
  activityDays: 30,
  sortBy: 'name',
  matrixSortSkill: null,
  matrixSortDir: 'desc',
};
