// Toolbar, search, activity filter, sort, view toggle, member count.
// Shared across roster and matrix views. Same controls, same markup.

import type { ViewState, CitizensData } from '../types/citizens.js';
import { filterRecords } from './data.js';

export function renderToolbar(viewState: ViewState, data: CitizensData | null): string {
  const opt = (val: string, label: string, current: string) =>
    `<option value="${val}"${val === current ? ' selected' : ''}>${label}</option>`;

  const count = data ? filterRecords(data.records, viewState).length : 0;
  const total = data?.records.length ?? 0;
  const countText = count === total ? `${total} members` : `${count} of ${total}`;

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
      <button id="cz-view-toggle" class="cz-view-toggle term-btn"
              title="${viewState.view === 'matrix' ? 'Switch to list view' : 'Switch to matrix view'}">
        ${viewState.view === 'matrix' ? '☰ list' : '▦ matrix'}
      </button>
      <span class="cz-toolbar-count">${countText}</span>
    </div>`;
}
