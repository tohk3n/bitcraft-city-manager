// Citizen data, fetching, merging, filtering.
//
// The API gives us two separate responses: members (who's in the claim)
// and citizens (skill data). Merge them by entity ID. The members
// response has login timestamps; the citizens response has skill levels.
// A member without citizen data gets zeroed skills, they're in the
// claim but the skills API didn't return them (happens with very new
// or inactive players).

import { API } from '../api.js';
import { createLogger } from '../logger.js';
import { resolveGearGrid, filterVaultGear, parseTools } from './gear.js';
import type { ClaimMember, ClaimCitizensResponse } from '../types/index.js';
import type { CitizenRecord, CitizensData, ViewState } from '../types/citizens.js';

const log = createLogger('Citizens');

// --- Internal types for API response shape ---

interface CitizensApiResponse extends ClaimCitizensResponse {
  skillNames?: Record<string, string>;
}

interface CitizenWithSkills {
  entityId: string;
  userName?: string;
  skills?: Record<string, number>;
  totalSkills?: number;
  highestLevel?: number;
  totalLevel?: number;
  totalXP?: number;
}

// --- Merging ---

export function mergeData(members: ClaimMember[], citizensResp: CitizensApiResponse): CitizensData {
  const citizens = citizensResp.citizens || [];
  const skillNames = citizensResp.skillNames || {};
  const byId = new Map(citizens.map((c) => [c.entityId, c as CitizenWithSkills]));

  const records: CitizenRecord[] = members.map((m) => {
    const c = byId.get(m.playerEntityId) || byId.get(m.entityId);
    return {
      entityId: m.playerEntityId || m.entityId,
      userName: m.userName || c?.userName || 'Unknown',
      lastLogin: m.lastLoginTimestamp ? new Date(m.lastLoginTimestamp) : new Date(0),
      totalSkills: c?.totalSkills || 0,
      highestLevel: c?.highestLevel || 0,
      totalLevel: c?.totalLevel || 0,
      totalXP: c?.totalXP || 0,
      skills: c?.skills || null,
      gear: null,
      gearLoading: false,
      gearError: null,
    };
  });

  return { records, skillNames };
}

// --- Filtering & sorting ---

export function filterRecords(records: CitizenRecord[], viewState: ViewState): CitizenRecord[] {
  let result = records;

  if (viewState.activityDays > 0) {
    result = result.filter((r) => daysSince(r.lastLogin) <= viewState.activityDays);
  }
  if (viewState.search) {
    const q = viewState.search.toLowerCase();
    result = result.filter((r) => r.userName.toLowerCase().includes(q));
  }

  const s = viewState.sortBy;
  return [...result].sort((a, b) => {
    if (s === 'name') return a.userName.localeCompare(b.userName);
    if (s === 'lastLogin') return b.lastLogin.getTime() - a.lastLogin.getTime();
    if (s === 'totalLevel') return b.totalLevel - a.totalLevel;
    return b.highestLevel - a.highestLevel;
  });
}

// --- Gear loading ---
// Three API calls per citizen. Expensive. Only triggered on detail view open.

export async function loadGear(record: CitizenRecord, onUpdate: () => void): Promise<void> {
  if (record.gear || record.gearLoading) return;

  record.gearLoading = true;
  onUpdate();

  try {
    const [equipResp, vaultResp, invResp] = await Promise.all([
      API.getPlayerEquipment(record.entityId),
      API.getPlayerVault(record.entityId),
      API.getPlayerInventories(record.entityId),
    ]);

    const equipment = equipResp.equipment || [];
    const vaultRaw = vaultResp.collectibles || [];
    const vault = filterVaultGear(vaultRaw);
    const grid = resolveGearGrid(equipment, vault);
    const tools = parseTools(invResp);

    record.gear = { equipment, vault, grid, tools };
    record.gearLoading = false;
    log.info(`Loaded gear for ${record.userName} (${tools.length} tools)`);
  } catch (err) {
    const error = err as Error;
    record.gearLoading = false;
    record.gearError = error.message;
    log.warn(`Failed to load gear for ${record.userName}: ${error.message}`);
  }

  onUpdate();
}

// --- Fetching ---

export async function fetchCitizens(claimId: string): Promise<CitizensData> {
  const [members, citizens] = await Promise.all([
    API.getClaimMembers(claimId),
    API.getClaimCitizens(claimId),
  ]);

  const data = mergeData(members.members, citizens as CitizensApiResponse);
  log.info(`Loaded ${data.records.length} members`);
  return data;
}

// --- Time helpers ---

export function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export function relativeTime(date: Date): string {
  if (isNaN(date.getTime())) return 'unknown';
  const days = daysSince(date);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function activityClass(date: Date): string {
  const days = daysSince(date);
  if (days <= 7) return 'cz-active';
  if (days <= 30) return 'cz-stale';
  return 'cz-inactive';
}
