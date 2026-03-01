// Roster view, the member list with activity dots and level badges.
// Click a row → detail view. This is the simple "who's here" view.

import { relativeTime, activityClass, filterRecords } from './data.js';
import { renderToolbar } from './toolbar.js';
import type { CitizenRecord, CitizensData, ViewState } from '../types/citizens.js';

export function renderRoster(viewState: ViewState, data: CitizensData | null): string {
  if (!data) return '<p class="empty-state">No data loaded.</p>';
  const rows = filterRecords(data.records, viewState);
  const bar = renderToolbar(viewState, data);

  if (rows.length === 0) {
    const msg = data.records.length === 0 ? 'No members found.' : 'No members match your search.';
    return `${bar}<p class="empty-state">${msg}</p>`;
  }

  return `${bar}<div class="cz-roster">${rows.map(rosterRow).join('')}</div>`;
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
