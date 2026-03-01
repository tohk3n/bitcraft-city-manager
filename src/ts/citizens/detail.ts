// Detail view, individual citizen profile.
//
// Shows skill bars with rarity-colored fills, equipped tools per skill,
// and a gear grid showing best-in-slot armor across cloth/leather/metal.
// Vault items are styled differently (italic + dashed underline) so you
// can see at a glance what's equipped vs what's sitting in storage.

import { CITIZEN_CONFIG } from '../configuration/citizenconfig.js';
import { relativeTime, activityClass } from './data.js';
import { shortToolName } from './gear.js';
import { PROFESSIONS, SKILLS } from './skills.js';
import type { CitizenRecord, CitizensData, GearSlot, ToolItem } from '../types/citizens.js';

const SLOTS = CITIZEN_CONFIG.EQUIPMENT_SLOTS;
const SLOT_NAMES = CITIZEN_CONFIG.SLOT_DISPLAY_NAMES;
const GEAR_TYPES = CITIZEN_CONFIG.GEAR_TYPES;
const GEAR_TYPE_SHORT = GEAR_TYPES.map((g) => g.split(' ')[0]);

// --- Public ---

export function renderDetail(record: CitizenRecord, data: CitizensData): string {
  return `
    <div class="cz-detail">
      <div class="cz-detail-top">
        <button id="cz-back" class="cz-back">&larr; Back</button>
        <div class="cz-detail-header">
          <span class="cz-dot ${activityClass(record.lastLogin)}"></span>
          <h3 class="cz-detail-name">${record.userName}</h3>
          <span class="cz-detail-meta">${relativeTime(record.lastLogin)} · Lv ${record.totalLevel} · ${record.totalXP.toLocaleString()} XP</span>
          <button class="copy-btn" data-id="${record.entityId}" title="Copy ID">${record.entityId}</button>
          <a class="cz-map-link" href="https://map.bitjita.com/?playerId=${record.entityId}"
             target="_blank" rel="noopener" title="Track on map">🗺</a>
        </div>
      </div>
      ${profileGrid(record, data)}
    </div>`;
}

// --- Skill entry ---

interface SkillEntry {
  id: number;
  name: string;
  level: number;
}

// --- Bar ---
// One element. Background = rarity color. Width = level%.
// Number sits inside. Track behind shows the unfilled portion.

function blockBar(level: number, rarityClass: string): string {
  const pct = Math.min(level, 100);
  return (
    `<span class="cz-bar-track">` +
    `<span class="cz-bar-fill ${rarityClass}" style="width:${pct}%">${level}</span>` +
    `</span>`
  );
}

// --- Legend ---

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

// --- Skill row ---
// Each row shows: skill name, level bar, equipped tool, and (if gear loaded)
// the armor piece for the corresponding body slot.
//
// The `gridRow` parameter maps skill rows to body slots, row 0 = head,
// row 1 = chest, etc. When there are more skills than body slots (there are),
// extra rows just don't get gear cells. The last row gets the rarity legend
// in the gear zone instead.

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

// --- Profile grid ---
// Categorizes skills into professions, non-profession skills, and unknowns.
// Unknowns are skills the API returned that aren't in our hardcoded ordering
// these appear at the bottom so new game skills show up immediately even
// before we add them to the PROFESSIONS/SKILLS arrays.

function profileGrid(r: CitizenRecord, data: CitizensData): string {
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

  // Gear headers
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
  html += '<div class="cz-row cz-row-hdr">';
  html += '<span></span><span></span><span></span>';
  html += gearHeaders;
  html += '</div>';

  let gridRow = 0;
  for (const s of profEntries) {
    html += skillRow(s, toolsBySkill, gridRow, grid, hasGear);
    gridRow++;
  }

  if (profEntries.length > 0 && (skillEntries.length > 0 || unknownEntries.length > 0)) {
    html += '<div class="cz-spacer"></div>';
    gridRow++;
  }

  const allSkillsAndUnknown = [...skillEntries, ...unknownEntries];
  for (let i = 0; i < allSkillsAndUnknown.length; i++) {
    const isLast = i === allSkillsAndUnknown.length - 1;
    html += skillRow(allSkillsAndUnknown[i], toolsBySkill, gridRow, grid, hasGear, isLast);
    gridRow++;
  }

  html += '</div>';
  return html;
}
