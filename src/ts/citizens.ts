// Citizens view — master-detail roster with search and activity filtering
//
// Two API calls on tab open: members + citizens (roster data).
// Three more on detail open: equipment + vault + inventories.
// All cached — navigating back and re-opening is instant.

import { API } from './api.js';
import { createLogger } from './logger.js';
import { CITIZEN_CONFIG } from './configuration/citizenconfig.js';
import type {
  ClaimMember,
  ClaimCitizensResponse,
  EquipmentSlot,
  VaultCollectible,
  PlayerInventoriesResponse,
} from './types/index.js';

const log = createLogger('Citizens');

// --- TYPES ---

interface GearSlot {
  name: string;
  tier: number;
  rarity: string;
  source: 'equipped' | 'vault';
}

interface ToolItem {
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

interface GearData {
  equipment: EquipmentSlot[];
  vault: VaultCollectible[];
  grid: Record<string, Record<string, GearSlot | null>>;
  tools: ToolItem[];
}

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

export interface CitizensData {
  records: CitizenRecord[];
  skillNames: Record<string, string>;
}

type ActivityThreshold = 0 | 7 | 14 | 30 | 60;
type SortField = 'name' | 'lastLogin' | 'totalLevel' | 'highestLevel';

interface ViewState {
  view: 'roster' | 'detail';
  selectedId: string | null;
  search: string;
  activityDays: ActivityThreshold;
  sortBy: SortField;
}

const VIEW_DEFAULTS: ViewState = {
  view: 'roster',
  selectedId: null,
  search: '',
  activityDays: 30,
  sortBy: 'name',
};

const viewState: ViewState = { ...VIEW_DEFAULTS };

let data: CitizensData | null = null;

// --- FIXED SKILL ORDERING ---
// Order is fixed so your eyes learn positions and stop reading labels.

const PROFESSIONS: number[] = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
  // Forestry, Carpentry, Masonry, Mining, Blacksmithing, Scholar,
  // Leatherworking, Hunting, Tailoring, Farming, Fishing, Cooking, Foraging
];

const SKILLS: number[] = [
  1, 15, 16, 17, 18,
  // Slayer, Sailing, Construction, Taming, Merchanting
];

// --- GEAR RESOLUTION ---

const SLOTS = CITIZEN_CONFIG.EQUIPMENT_SLOTS;
const SLOT_NAMES = CITIZEN_CONFIG.SLOT_DISPLAY_NAMES;
const GEAR_TYPES = CITIZEN_CONFIG.GEAR_TYPES;
const SLOT_CODES = CITIZEN_CONFIG.SLOT_TYPE_CODES as Record<string, number>;
const RARITY_ORDER = CITIZEN_CONFIG.RARITY_ORDER;
const GEAR_TYPE_SHORT = GEAR_TYPES.map((g) => g.split(' ')[0]);

function rarityRank(r: string): number {
  const idx = RARITY_ORDER.indexOf(r.toLowerCase());
  return idx === -1 ? -1 : idx;
}

function filterVaultGear(collectibles: VaultCollectible[]): VaultCollectible[] {
  const validTypes = new Set(Object.values(SLOT_CODES));
  const validTags = new Set(CITIZEN_CONFIG.CLOTHING_TAGS);
  return collectibles.filter(
    (item) => validTypes.has(item.type) && validTags.has(item.tag) && item.tier > 0
  );
}

function resolveGearGrid(
  equipment: EquipmentSlot[],
  vaultGear: VaultCollectible[]
): Record<string, Record<string, GearSlot | null>> {
  const grid: Record<string, Record<string, GearSlot | null>> = {};

  for (const gearType of GEAR_TYPES) {
    const gearBase = gearType.split(' ')[0];
    const gearKey = gearBase.toLowerCase();
    grid[gearKey] = {};

    for (const slot of SLOTS) {
      const equipped = equipment.find((e) => e.primary === slot && e.item?.tags === gearType);
      let best: GearSlot | null = null;

      if (equipped?.item) {
        best = {
          name: equipped.item.name,
          tier: equipped.item.tier,
          rarity: (equipped.item.rarityString || '').toLowerCase(),
          source: 'equipped',
        };
      }

      const targetType = SLOT_CODES[slot];
      const possibleTags = [`${gearBase} Clothing`, `${gearBase} Armor`];
      const vaultMatches = vaultGear.filter(
        (v) => v.type === targetType && possibleTags.includes(v.tag)
      );

      for (const v of vaultMatches) {
        const vr = (v.rarityStr || '').toLowerCase();
        const dominated =
          !best ||
          v.tier > best.tier ||
          (v.tier === best.tier && rarityRank(vr) > rarityRank(best.rarity));
        if (dominated) {
          best = { name: v.name, tier: v.tier, rarity: vr, source: 'vault' };
        }
      }

      grid[gearKey][slot] = best;
    }
  }

  return grid;
}

// --- TOOL RESOLUTION ---

function parseTools(resp: PlayerInventoriesResponse): ToolItem[] {
  const items = resp.items || {};
  const tools: ToolItem[] = [];

  for (const inv of resp.inventories || []) {
    const source = inv.inventoryName || 'Unknown';
    const isToolbelt = source === 'Toolbelt';

    for (const pocket of inv.pockets || []) {
      if (!pocket.contents) continue;
      const meta = items[String(pocket.contents.itemId)];
      if (!meta?.toolType) continue;

      tools.push({
        name: meta.name,
        tier: meta.tier,
        rarity: (meta.rarityStr || 'common').toLowerCase(),
        tag: meta.tag || 'Tool',
        toolLevel: meta.toolLevel || 0,
        toolPower: meta.toolPower || 0,
        toolType: meta.toolType,
        toolSkillId: meta.toolSkillId || 0,
        equipped: isToolbelt,
        source,
      });
    }
  }

  return tools.sort((a, b) => {
    if (a.equipped !== b.equipped) return a.equipped ? -1 : 1;
    if (a.tag !== b.tag) return a.tag.localeCompare(b.tag);
    return rarityRank(b.rarity) - rarityRank(a.rarity);
  });
}

function shortToolName(tool: ToolItem): string {
  const words = tool.name.split(' ');
  return words.length > 1 ? words[words.length - 1] : tool.name;
}

// --- BLOCK BAR ---
// The bar is one element. Background = rarity color. Width = level%.
// Number sits inside it. The track behind it shows the unfilled portion.
// No block characters. No seams. One thing.

function blockBar(level: number, rarityClass: string): string {
  const pct = Math.min(level, 100);
  return (
    `<span class="cz-bar-track">` +
    `<span class="cz-bar-fill ${rarityClass}" style="width:${pct}%">${level}</span>` +
    `</span>`
  );
}

// --- DATA HELPERS ---

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function relativeTime(date: Date): string {
  if (isNaN(date.getTime())) return 'unknown';
  const days = daysSince(date);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function activityClass(date: Date): string {
  const days = daysSince(date);
  if (days <= 7) return 'cz-active';
  if (days <= 30) return 'cz-stale';
  return 'cz-inactive'; // also covers NaN from invalid dates
}

function mergeData(members: ClaimMember[], citizensResp: CitizensApiResponse): CitizensData {
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

function filtered(): CitizenRecord[] {
  if (!data) return [];
  let result = data.records;

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

// --- GEAR LOADING ---

async function loadGear(record: CitizenRecord, el: HTMLElement): Promise<void> {
  if (record.gear || record.gearLoading) return;

  record.gearLoading = true;
  paint(el);

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

  if (viewState.selectedId === record.entityId) {
    paint(el);
  }
}

// --- RENDER: TOOLBAR ---

function toolbar(count: number, total: number): string {
  const opt = (val: string, label: string, current: string) =>
    `<option value="${val}"${val === current ? ' selected' : ''}>${label}</option>`;

  return `
    <div class="cz-toolbar">
      <div class="cz-toolbar-row">
        <input type="text" id="cz-search" class="cz-search"
               placeholder="Search members..." value="${viewState.search}">
        <select id="cz-activity" class="cz-select">
          ${opt('0', 'All members', String(viewState.activityDays))}
          ${opt('7', 'Active 7d', String(viewState.activityDays))}
          ${opt('14', 'Active 14d', String(viewState.activityDays))}
          ${opt('30', 'Active 30d', String(viewState.activityDays))}
          ${opt('60', 'Active 60d', String(viewState.activityDays))}
        </select>
        <select id="cz-sort" class="cz-select">
          ${opt('name', 'Name', viewState.sortBy)}
          ${opt('lastLogin', 'Last login', viewState.sortBy)}
          ${opt('totalLevel', 'Total level', viewState.sortBy)}
          ${opt('highestLevel', 'Highest skill', viewState.sortBy)}
        </select>
      </div>
      <span class="cz-toolbar-count">
        ${count === total ? `${total} members` : `${count} of ${total}`}
      </span>
    </div>`;
}

// --- RENDER: ROSTER ---

function rosterRow(r: CitizenRecord): string {
  return `
    <button class="cz-member-row" data-id="${r.entityId}">
      <span class="cz-dot ${activityClass(r.lastLogin)}"></span>
      <span class="cz-name">${r.userName}</span>
      <span class="cz-meta">
        <span class="cz-login">${relativeTime(r.lastLogin)}</span>
        ${r.totalLevel > 0 ? `<span class="cz-level">Lv ${r.totalLevel}</span>` : ''}
      </span>
    </button>`;
}

function roster(): string {
  if (!data) return '<p class="empty-state">No data loaded.</p>';
  const rows = filtered();
  const bar = toolbar(rows.length, data.records.length);

  if (rows.length === 0) {
    const msg = data.records.length === 0 ? 'No members found.' : 'No members match your search.';
    return `${bar}<p class="empty-state">${msg}</p>`;
  }

  return `${bar}<div class="cz-roster">${rows.map(rosterRow).join('')}</div>`;
}

// --- RENDER: DETAIL ---

interface SkillEntry {
  id: number;
  name: string;
  level: number;
}

function legendContent(): string {
  const items = [
    ['common', 'Common'],
    ['uncommon', 'Uncommon'],
    ['rare', 'Rare'],
    ['epic', 'Epic'],
    ['legendary', 'Legendary'],
    ['mythic', 'Mythic'],
  ];
  const swatches = items
    .map(
      ([cls, label]) =>
        `<span class="cz-legend-item"><span class="cz-r-${cls}">█</span> ${label}</span>`
    )
    .join('');
  return `${swatches}<span class="cz-legend-item"><span class="cz-vault-sample">T5</span> vault</span>`;
}

function skillRow(
  s: SkillEntry,
  toolsBySkill: Map<number, ToolItem[]>,
  gridRow: number,
  grid: Record<string, Record<string, GearSlot | null>> | null,
  hasGear: boolean,
  showLegend = false
): string {
  const allTools = toolsBySkill.get(s.id) || [];
  const equipped = allTools.find((t) => t.equipped) || null;
  const stashed = allTools.filter((t) => !t.equipped);
  const rarityClass = equipped ? `cz-r-${equipped.rarity}` : 'cz-r-none';

  let toolHtml = '';
  if (equipped) {
    const short = shortToolName(equipped);
    toolHtml = `<span class="cz-r-${equipped.rarity}" title="${equipped.name} · ⚡${equipped.toolPower}">T${equipped.tier} ${short}</span>`;
  }
  if (stashed.length > 0) {
    const titles = stashed.map((t) => `${t.name} (${t.rarity}, ${t.source})`).join('\n');
    toolHtml += ` <span class="cz-stashed" title="${titles}">+${stashed.length}</span>`;
  }

  let rightHtml = '';
  if (hasGear && grid && gridRow < SLOTS.length) {
    // Gear cells for this body slot
    const slot = SLOTS[gridRow];
    rightHtml += '<span class="cz-g-gap"></span>';
    rightHtml += `<span class="cz-g-slot">${SLOT_NAMES[gridRow]}</span>`;
    for (const gt of GEAR_TYPE_SHORT) {
      const gearKey = gt.toLowerCase();
      const item = grid[gearKey]?.[slot];
      if (item) {
        const vaultCls = item.source === 'vault' ? ' cz-vault' : '';
        rightHtml += `<span class="cz-g-cell cz-r-${item.rarity}${vaultCls}" title="${item.name}${item.source === 'vault' ? ' (vault)' : ''}">T${item.tier}</span>`;
      } else {
        rightHtml += '<span class="cz-g-cell cz-g-empty">──</span>';
      }
    }
  } else if (showLegend) {
    // Legend in the gear zone, aligned with this row
    rightHtml += '<span class="cz-g-gap"></span>';
    rightHtml += `<span class="cz-legend-content">${legendContent()}</span>`;
  }

  return `
    <div class="cz-row">
      <span class="cz-c-skill">${s.name}</span>
      <span class="cz-c-bar">${blockBar(s.level, rarityClass)}</span>
      <span class="cz-c-tool">${toolHtml}</span>
      ${rightHtml}
    </div>`;
}

function profileGrid(r: CitizenRecord): string {
  if (!data) return '';
  const names = data.skillNames;
  const skills = r.skills || {};

  const toolsBySkill = new Map<number, ToolItem[]>();
  if (r.gear) {
    for (const t of r.gear.tools) {
      const group = toolsBySkill.get(t.toolSkillId) || [];
      group.push(t);
      toolsBySkill.set(t.toolSkillId, group);
    }
  }

  const hasGear = !!r.gear && !r.gearLoading && !r.gearError;
  const grid = r.gear?.grid || null;

  const knownIds = new Set([...PROFESSIONS, ...SKILLS]);
  const profEntries: SkillEntry[] = [];
  const skillEntries: SkillEntry[] = [];
  const unknownEntries: SkillEntry[] = [];

  for (const id of PROFESSIONS) {
    const level = skills[id];
    if (level !== undefined) {
      profEntries.push({ id, name: names[String(id)] || `Skill ${id}`, level });
    }
  }
  for (const id of SKILLS) {
    const level = skills[id];
    if (level !== undefined) {
      skillEntries.push({ id, name: names[String(id)] || `Skill ${id}`, level });
    }
  }
  for (const [idStr, level] of Object.entries(skills)) {
    const id = Number(idStr);
    if (!knownIds.has(id)) {
      unknownEntries.push({ id, name: names[idStr] || `Skill ${id}`, level });
    }
  }

  // Gear type headers — only the right zone needs labels
  let gearHeaders = '';
  if (r.gearLoading) {
    gearHeaders =
      '<span class="cz-g-gap"></span><span class="cz-g-slot"></span><span class="cz-g-hdr" style="grid-column: span 3">loading...</span>';
  } else if (r.gearError) {
    gearHeaders =
      '<span class="cz-g-gap"></span><span class="cz-g-slot"></span><span class="cz-g-hdr" style="grid-column: span 3">error</span>';
  } else if (hasGear) {
    gearHeaders = '<span class="cz-g-gap"></span><span class="cz-g-slot"></span>';
    for (const gt of GEAR_TYPE_SHORT) {
      gearHeaders += `<span class="cz-g-hdr">${gt.toLowerCase()}</span>`;
    }
  }

  let html = '<div class="cz-grid">';

  // Gear headers on first row, left zone is empty
  html += '<div class="cz-row cz-row-hdr">';
  html += '<span></span><span></span><span></span>'; // skill, bar, tool
  html += gearHeaders;
  html += '</div>';

  // Profession rows
  let gridRow = 0;
  for (const s of profEntries) {
    html += skillRow(s, toolsBySkill, gridRow, grid, hasGear);
    gridRow++;
  }

  // Breathing room — not a line, just space
  if (profEntries.length > 0 && (skillEntries.length > 0 || unknownEntries.length > 0)) {
    html += '<div class="cz-spacer"></div>';
    gridRow++;
  }

  // Skill rows
  const allSkillsAndUnknown = [...skillEntries, ...unknownEntries];
  for (let i = 0; i < allSkillsAndUnknown.length; i++) {
    const isLast = i === allSkillsAndUnknown.length - 1;
    html += skillRow(allSkillsAndUnknown[i], toolsBySkill, gridRow, grid, hasGear, isLast);
    gridRow++;
  }

  html += '</div>';
  return html;
}

function detail(r: CitizenRecord): string {
  if (!data) return '';

  return `
    <div class="cz-detail">
      <div class="cz-detail-top">
        <button id="cz-back" class="cz-back">&larr; Back</button>
        <div class="cz-detail-header">
          <span class="cz-dot ${activityClass(r.lastLogin)}"></span>
          <h3 class="cz-detail-name">${r.userName}</h3>
          <span class="cz-detail-meta">${relativeTime(r.lastLogin)} · Lv ${r.totalLevel} · ${r.totalXP.toLocaleString()} XP</span>
          <button class="copy-btn" data-id="${r.entityId}" title="Copy ID">${r.entityId}</button>
        </div>
      </div>
      ${profileGrid(r)}
    </div>`;
}

// --- WIRING ---

function wire(el: HTMLElement): void {
  if (viewState.view === 'detail') {
    wireDetail(el);
  } else {
    wireRoster(el);
  }
}

function wireRoster(el: HTMLElement): void {
  const search = el.querySelector<HTMLInputElement>('#cz-search');
  if (search) {
    search.addEventListener('input', () => {
      viewState.search = search.value;
      const rosterEl = el.querySelector('.cz-roster');
      const countEl = el.querySelector('.cz-toolbar-count');
      const rows = filtered();
      if (rosterEl) rosterEl.innerHTML = rows.map(rosterRow).join('');
      if (countEl && data) {
        countEl.textContent =
          rows.length === data.records.length
            ? `${data.records.length} members`
            : `${rows.length} of ${data.records.length}`;
      }
      wireRowClicks(el);
    });
    search.focus();
  }

  el.querySelector<HTMLSelectElement>('#cz-activity')?.addEventListener('change', (e) => {
    viewState.activityDays = parseInt(
      (e.target as HTMLSelectElement).value,
      10
    ) as ActivityThreshold;
    paint(el);
  });

  el.querySelector<HTMLSelectElement>('#cz-sort')?.addEventListener('change', (e) => {
    viewState.sortBy = (e.target as HTMLSelectElement).value as SortField;
    paint(el);
  });

  wireRowClicks(el);
}

function wireRowClicks(el: HTMLElement): void {
  el.querySelectorAll<HTMLButtonElement>('.cz-member-row').forEach((row) => {
    row.addEventListener('click', () => {
      viewState.selectedId = row.dataset.id || null;
      viewState.view = 'detail';
      paint(el);

      const record = data?.records.find((r) => r.entityId === viewState.selectedId);
      if (record && !record.gear && !record.gearLoading) {
        loadGear(record, el);
      }
    });
  });
}

function wireDetail(el: HTMLElement): void {
  el.querySelector<HTMLButtonElement>('#cz-back')?.addEventListener('click', () => {
    viewState.view = 'roster';
    viewState.selectedId = null;
    paint(el);
  });

  el.querySelectorAll<HTMLButtonElement>('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id || '';
      navigator.clipboard.writeText(id).then(() => {
        const original = btn.textContent;
        btn.textContent = '✔';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1500);
      });
    });
  });
}

// --- PAINT ---

function paint(el: HTMLElement): void {
  if (viewState.view === 'detail' && viewState.selectedId) {
    const record = data?.records.find((r) => r.entityId === viewState.selectedId);
    if (record) {
      el.innerHTML = detail(record);
      wire(el);
      return;
    }
    viewState.view = 'roster';
    viewState.selectedId = null;
  }

  el.innerHTML = roster();
  wire(el);
}

// --- PUBLIC ---

export const CitizensUI = {
  async loadAndRender(claimId: string, cached?: CitizensData): Promise<CitizensData | null> {
    const el = document.getElementById('citizens-grid');
    if (!el) return null;

    if (cached) {
      data = cached;
      paint(el);
      return data;
    }

    el.innerHTML = '<p class="cz-loading">Loading members...</p>';

    try {
      const [members, citizens] = await Promise.all([
        API.getClaimMembers(claimId),
        API.getClaimCitizens(claimId),
      ]);

      data = mergeData(members.members, citizens as CitizensApiResponse);
      log.info(`Loaded ${data.records.length} members`);
      paint(el);
      return data;
    } catch (err) {
      const error = err as Error;
      log.error('Failed to load citizens:', error.message);
      el.innerHTML = `<p class="empty-state">Failed to load members: ${error.message}</p>`;
      return null;
    }
  },

  reset(): void {
    data = null;
    Object.assign(viewState, VIEW_DEFAULTS);
  },
};
