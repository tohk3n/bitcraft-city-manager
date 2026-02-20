// Citizens view — master-detail roster with search and activity filtering
//
// Two API calls on tab open: members + citizens. fin
// Members give login times. Citizens gives skills.
// TODO: Add Equipment/vault loading for more information.

import { API } from './api.js';
import { createLogger } from './logger.js';
import type { ClaimMember, CitizensApiResponse, CitizenWithSkills } from './types/index.js';

const log = createLogger('Citizens');

// =============================================================================
// TYPES
// =============================================================================

interface CitizenRecord {
  entityId: string;
  userName: string;
  lastLogin: Date;
  totalSkills: number;
  highestLevel: number;
  totalLevel: number;
  totalXP: number;
  skills: Record<string, number> | null;
}

type ActivityThreshold = 0 | 7 | 14 | 30 | 60;
type SortField = 'name' | 'lastLogin' | 'totalLevel' | 'highestLevel';

interface State {
  records: CitizenRecord[];
  view: 'roster' | 'detail';
  selectedId: string | null;
  search: string;
  activityDays: ActivityThreshold;
  sortBy: SortField;
  skillNames: Record<string, string>;
}

// TODO: Move to claimData next after State migration
const state: State = {
  records: [],
  view: 'roster',
  selectedId: null,
  search: '',
  activityDays: 30,
  sortBy: 'name',
  skillNames: {},
};

// =============================================================================
// DATA
// =============================================================================

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function relativeTime(date: Date): string {
  const days = daysSince(date);
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function activityClass(date: Date): string {
  const days = daysSince(date);
  if (days <= 7) return 'cz-active';
  if (days <= 30) return 'cz-stale';
  return 'cz-inactive';
}

/**
 * Members and citizens are two separate API responses about the same people.
 * Members has login times + permissions. Citizens has skills.
 * playerEntityId on members should match entityId on citizens.
 */
function mergeData(
  members: ClaimMember[],
  citizensResp: CitizensApiResponse
): { records: CitizenRecord[]; skillNames: Record<string, string> } {
  const citizens = citizensResp.citizens || [];
  const skillNames = citizensResp.skillNames || {};
  const byId = new Map(citizens.map((c) => [c.entityId, c as CitizenWithSkills]));

  const records: CitizenRecord[] = members.map((m) => {
    const c = byId.get(m.playerEntityId) || byId.get(m.entityId);

    return {
      entityId: m.playerEntityId || m.entityId,
      userName: m.userName || c?.userName || 'Unknown',
      lastLogin: new Date(m.lastLoginTimestamp),
      totalSkills: c?.totalSkills || 0,
      highestLevel: c?.highestLevel || 0,
      totalLevel: c?.totalLevel || 0,
      totalXP: c?.totalXP || 0,
      skills: c?.skills || null,
    };
  });

  return { records, skillNames };
}

function filtered(): CitizenRecord[] {
  let result = state.records;

  if (state.activityDays > 0) {
    result = result.filter((r) => daysSince(r.lastLogin) <= state.activityDays);
  }

  if (state.search) {
    const q = state.search.toLowerCase();
    result = result.filter((r) => r.userName.toLowerCase().includes(q));
  }

  const s = state.sortBy;
  return [...result].sort((a, b) => {
    if (s === 'name') return a.userName.localeCompare(b.userName);
    if (s === 'lastLogin') return b.lastLogin.getTime() - a.lastLogin.getTime();
    if (s === 'totalLevel') return b.totalLevel - a.totalLevel;
    return b.highestLevel - a.highestLevel;
  });
}

// =============================================================================
// RENDER
// =============================================================================

function toolbar(count: number, total: number): string {
  const opt = (val: string, label: string, current: string) =>
    `<option value="${val}"${val === current ? ' selected' : ''}>${label}</option>`;

  return `
    <div class="cz-toolbar">
      <div class="cz-toolbar-row">
        <input type="text" id="cz-search" class="cz-search"
               placeholder="Search members..." value="${state.search}">
        <select id="cz-activity" class="cz-select">
          ${opt('0', 'All members', String(state.activityDays))}
          ${opt('7', 'Active 7d', String(state.activityDays))}
          ${opt('14', 'Active 14d', String(state.activityDays))}
          ${opt('30', 'Active 30d', String(state.activityDays))}
          ${opt('60', 'Active 60d', String(state.activityDays))}
        </select>
        <select id="cz-sort" class="cz-select">
          ${opt('name', 'Name', state.sortBy)}
          ${opt('lastLogin', 'Last login', state.sortBy)}
          ${opt('totalLevel', 'Total level', state.sortBy)}
          ${opt('highestLevel', 'Highest skill', state.sortBy)}
        </select>
      </div>
      <span class="cz-toolbar-count">
        ${count === total ? `${total} members` : `${count} of ${total}`}
      </span>
    </div>`;
}

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
  const rows = filtered();
  const bar = toolbar(rows.length, state.records.length);

  if (rows.length === 0) {
    const msg = state.records.length === 0 ? 'No members found.' : 'No members match your search.';
    return `${bar}<p class="empty-state">${msg}</p>`;
  }

  return `${bar}<div class="cz-roster">${rows.map(rosterRow).join('')}</div>`;
}

function detail(r: CitizenRecord): string {
  let skillsHtml = '';
  if (r.skills && Object.keys(r.skills).length > 0) {
    const entries = Object.entries(r.skills)
      .map(([id, level]) => ({ name: state.skillNames[id] || id, level }))
      .sort((a, b) => b.level - a.level);

    skillsHtml = `
      <div class="cz-section">
        <h4 class="cz-heading">Skills</h4>
        <div class="cz-skills">
          ${entries
            .map(
              (s) => `
            <div class="cz-skill">
              <span class="cz-skill-name">${s.name}</span>
              <span class="cz-skill-level">${s.level}</span>
            </div>`
            )
            .join('')}
        </div>
      </div>`;
  }

  return `
    <div class="cz-detail">
      <button id="cz-back" class="cz-back">&larr; Back</button>
      <div class="cz-detail-header">
        <span class="cz-dot ${activityClass(r.lastLogin)}"></span>
        <h3 class="cz-detail-name">${r.userName}</h3>
        <button class="copy-btn" data-id="${r.entityId}" title="Copy ID">${r.entityId}</button>
      </div>
      <div class="cz-section">
        <div class="cz-stats">
          <div class="cz-stat">
            <span class="cz-stat-label">Last login</span>
            <span class="cz-stat-value">${relativeTime(r.lastLogin)}</span>
          </div>
          <div class="cz-stat">
            <span class="cz-stat-label">Total level</span>
            <span class="cz-stat-value">${r.totalLevel}</span>
          </div>
          <div class="cz-stat">
            <span class="cz-stat-label">Highest skill</span>
            <span class="cz-stat-value">${r.highestLevel}</span>
          </div>
          <div class="cz-stat">
            <span class="cz-stat-label">Total XP</span>
            <span class="cz-stat-value">${r.totalXP.toLocaleString()}</span>
          </div>
        </div>
      </div>
      ${skillsHtml}
    </div>`;
}

// =============================================================================
// WIRING
// =============================================================================

function wire(el: HTMLElement): void {
  if (state.view === 'detail') {
    wireDetail(el);
  } else {
    wireRoster(el);
  }
}

function wireRoster(el: HTMLElement): void {
  const search = el.querySelector<HTMLInputElement>('#cz-search');
  if (search) {
    search.addEventListener('input', () => {
      state.search = search.value;
      // Only re-render the roster area, not the toolbar
      const rosterEl = el.querySelector('.cz-roster');
      const countEl = el.querySelector('.cz-toolbar-count');
      const rows = filtered();
      if (rosterEl) rosterEl.innerHTML = rows.map(rosterRow).join('');
      if (countEl)
        countEl.textContent =
          rows.length === state.records.length
            ? `${state.records.length} members`
            : `${rows.length} of ${state.records.length}`;
      wireRowClicks(el);
    });
    // Auto-focus search on roster render
    search.focus();
  }

  el.querySelector<HTMLSelectElement>('#cz-activity')?.addEventListener('change', (e) => {
    state.activityDays = parseInt((e.target as HTMLSelectElement).value, 10) as ActivityThreshold;
    paint(el);
  });

  el.querySelector<HTMLSelectElement>('#cz-sort')?.addEventListener('change', (e) => {
    state.sortBy = (e.target as HTMLSelectElement).value as SortField;
    paint(el);
  });

  wireRowClicks(el);
}

function wireRowClicks(el: HTMLElement): void {
  el.querySelectorAll<HTMLButtonElement>('.cz-member-row').forEach((row) => {
    row.addEventListener('click', () => {
      state.selectedId = row.dataset.id || null;
      state.view = 'detail';
      paint(el);
    });
  });
}

function wireDetail(el: HTMLElement): void {
  el.querySelector<HTMLButtonElement>('#cz-back')?.addEventListener('click', () => {
    state.view = 'roster';
    state.selectedId = null;
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

// =============================================================================
// PAINT — render-then-wire
// =============================================================================

function paint(el: HTMLElement): void {
  if (state.view === 'detail' && state.selectedId) {
    const record = state.records.find((r) => r.entityId === state.selectedId);
    if (record) {
      el.innerHTML = detail(record);
      wire(el);
      return;
    }
    // Stale selection — fall back
    state.view = 'roster';
    state.selectedId = null;
  }

  el.innerHTML = roster();
  wire(el);
}

// =============================================================================
// PUBLIC
// =============================================================================

export const CitizensUI = {
  async loadAndRender(claimId: string): Promise<void> {
    const el = document.getElementById('citizens-grid');
    if (!el) return;

    if (state.records.length > 0) {
      paint(el);
      return;
    }

    el.innerHTML = '<p class="cz-loading">Loading members...</p>';

    try {
      const [members, citizens] = await Promise.all([
        API.getClaimMembers(claimId),
        API.getClaimCitizens(claimId),
      ]);

      const merged = mergeData(members.members, citizens);
      state.records = merged.records;
      state.skillNames = merged.skillNames;
      log.info(`Loaded ${merged.records.length} members`);

      paint(el);
    } catch (err) {
      const error = err as Error;
      log.error('Failed to load citizens:', error.message);
      el.innerHTML = `<p class="empty-state">Failed to load members: ${error.message}</p>`;
    }
  },

  reset(): void {
    state.records = [];
    state.view = 'roster';
    state.selectedId = null;
    state.search = '';
    state.skillNames = {};
  },
};
