// Matrix view, the spreadsheet-style skill grid.
//
// Answers "who can do X at what level?" without clicking into anyone.
// Column headers are clickable for sorting. Highest skill per row is
// highlighted with a subtle underline so you can spot specialists.

import { relativeTime, activityClass, filterRecords } from './data.js';
import { renderToolbar } from './toolbar.js';
import { PROFESSIONS, SKILLS, SKILL_ABBREV } from './skills.js';
import type { CitizenRecord, CitizensData, ViewState } from '../types/citizens.js';

// --- Column metadata ---

interface MatrixCol {
  id: number;
  abbrev: string;
  name: string;
}

function matrixColumns(data: CitizensData): MatrixCol[] {
  const names = data.skillNames;
  return [...PROFESSIONS, ...SKILLS].map((id) => {
    const name = names[String(id)] || `Skill ${id}`;
    return { id, abbrev: SKILL_ABBREV[name] || name.slice(0, 4), name };
  });
}

// --- Sorting ---
// Matrix reuses the base filter (search, activity, sort-by) then optionally
// re-sorts by a specific skill column. The skill sort overrides the toolbar
// sort when active, clicking a column header is a more specific intent.

function matrixSorted(data: CitizensData, viewState: ViewState): CitizenRecord[] {
  const rows = filterRecords(data.records, viewState);
  if (viewState.matrixSortSkill === null) return rows;

  const skillId = viewState.matrixSortSkill;
  const dir = viewState.matrixSortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const aLvl = a.skills?.[skillId] ?? 0;
    const bLvl = b.skills?.[skillId] ?? 0;
    return (bLvl - aLvl) * dir;
  });
}

// --- Level thresholds ---
// The game gates crafting by: floor(skillLevel / 10) >= itemTier.
// So level 80 = can craft T8 (endgame), 50 = T5 (mid), 20 = T2 (early).
// Below 20 you can only do T1. Zero means untrained.

function levelClass(level: number): string {
  if (level >= 80) return 'mx-lvl-high';
  if (level >= 50) return 'mx-lvl-mid';
  if (level >= 20) return 'mx-lvl-low';
  if (level > 0) return 'mx-lvl-min';
  return 'mx-lvl-none';
}

// --- Render ---

export function renderMatrix(viewState: ViewState, data: CitizensData | null): string {
  if (!data) return '<p class="empty-state">No data loaded.</p>';
  const rows = matrixSorted(data, viewState);
  const cols = matrixColumns(data);
  const bar = renderToolbar(viewState, data);

  if (rows.length === 0) {
    const msg = data.records.length === 0 ? 'No members found.' : 'No members match filters.';
    return `${bar}<p class="empty-state">${msg}</p>`;
  }

  return `${bar}
    <div class="mx-wrap">
      <table class="mx-table">
        <thead>${renderThead(cols, viewState)}</thead>
        <tbody>${renderTbody(rows, cols)}</tbody>
      </table>
    </div>`;
}

function renderThead(cols: MatrixCol[], viewState: ViewState): string {
  const sortArrow = viewState.matrixSortDir === 'asc' ? '▲' : '▼';

  let html = '<tr><th class="mx-th-name">Name</th><th class="mx-th-meta">Lv</th>';
  for (const col of cols) {
    const active = viewState.matrixSortSkill === col.id;
    const cls = active ? ' mx-th-active' : '';
    const arrow = active ? ` ${sortArrow}` : '';
    html += `<th class="mx-th-skill${cls}" data-skill="${col.id}" title="${col.name}">${col.abbrev}${arrow}</th>`;
  }
  html += '<th class="mx-th-meta mx-th-login" title="Last login">Seen</th></tr>';
  return html;
}

function renderTbody(rows: CitizenRecord[], cols: MatrixCol[]): string {
  let html = '';
  for (const r of rows) {
    const skills = r.skills || {};
    // Floor of 0 prevents highlighting when all skills are zero
    const maxLvl = Math.max(0, ...cols.map((c) => skills[c.id] ?? 0));

    html += `<tr class="mx-row" data-id="${r.entityId}">`;
    html += `<td class="mx-name"><span class="cz-dot ${activityClass(r.lastLogin)}"></span>${r.userName}</td>`;
    html += `<td class="mx-meta">${r.totalLevel || ''}</td>`;
    for (const col of cols) {
      const lvl = skills[col.id] ?? 0;
      const best = lvl > 0 && lvl === maxLvl ? ' mx-best' : '';
      html += `<td class="mx-cell ${levelClass(lvl)}${best}" title="${col.name}: ${lvl}">${lvl || ''}</td>`;
    }
    html += `<td class="mx-meta mx-login">${relativeTime(r.lastLogin)}</td>`;
    html += '</tr>';
  }
  return html;
}
