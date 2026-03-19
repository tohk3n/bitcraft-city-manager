// overview.ts -- the Home tab
// renders the newspaper-style city front page from data main.ts already fetches.
// each render function is idempotent: new data in, fresh DOM out.

import type {
  ClaimResponse,
  InventoryProcessResult,
  CraftingStationsResult,
  Items,
  StationsByName,
  Tier,
} from './types/index.js';
import { DASHBOARD_CONFIG } from './configuration/index.js';
import { createLogger } from './logger.js';

const log = createLogger('Overview');

interface OverviewData {
  claimInfo: ClaimResponse;
  inventory: InventoryProcessResult;
  foodItems: Items;
}

// -- masthead --

function renderMasthead(claimInfo: ClaimResponse): void {
  const c = claimInfo.claim;
  if (!c) return;

  setText('ov-city-name', `${c.name ?? '\u2014'} Ledger`);
  setText('ov-region', c.regionName ?? '\u2014');
  setText(
    'ov-date',
    new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  );
}

// -- headline stats --
// the four numbers across the top. no color logic yet --
// we don't know what "healthy" looks like across different cities
// so any threshold would be a guess. add it when we have real usage data.

function renderHeadlines(claimInfo: ClaimResponse, foodItems: Items): void {
  const c = claimInfo.claim;
  if (!c) return;

  const totalFood = Object.values(foodItems).reduce((sum, f) => sum + f.qty, 0);
  setHeadline('ov-hl-food', totalFood.toLocaleString(), 'ov-hl-food-sub', 'in stock');

  const supplies = c.supplies ?? 0;
  const upkeep = c.upkeepCost ?? 0;
  let supplySub = '';
  if (c.suppliesRunOut) {
    supplySub = c.suppliesRunOut;
  } else if (upkeep > 0) {
    const h = Math.floor(supplies / upkeep);
    supplySub = `${Math.floor(h / 24)}d ${h % 24}h remaining`;
  }
  setHeadline('ov-hl-supplies', supplies.toLocaleString(), 'ov-hl-supplies-sub', supplySub);
}

// -- station chip bar --
// condenses "Simple Cooking Station" + "Sturdy Cooking Station" into
// "cooking station x2 T2x1 T3x1". same logic dashboard.ts has for the
// station panels, just rendered as inline chips instead of a table.
//
// duplicates condenseStations/normalizeStationName from dashboard.ts.
// should be extracted to a shared module before this grows, but not
// doing that refactor inside this PR to keep the diff focused.

function renderStationChips(stations: CraftingStationsResult): void {
  const el = document.getElementById('ov-stations');
  if (!el) return;

  const specifiers = DASHBOARD_CONFIG.SPECIFIER;
  const active = condenseStations(stations.active, specifiers);
  const passive = condenseStations(stations.passive, specifiers);
  const activeNames = Object.keys(active).sort();
  const passiveNames = Object.keys(passive).sort();

  if (activeNames.length === 0 && passiveNames.length === 0) {
    el.innerHTML = '<span class="sc-label">no stations</span>';
    return;
  }

  const chips = (source: StationsByName, names: string[]): string =>
    names
      .map((name) => {
        const s = source[name];
        const tiers = (Object.entries(s.tiers) as [string, number][])
          .filter(([, qty]) => qty > 0)
          .map(([t, qty]) => `T${t}x${qty}`)
          .join(' ');
        const tierBit = tiers ? ` <span class="sc-tiers">${tiers}</span>` : '';
        return `<span class="station-chip">${name} <span class="sc-total">x${s.total}</span>${tierBit}</span>`;
      })
      .join('');

  let html = `<div class="sc-group"><span class="sc-label">crafting</span>${chips(active, activeNames)}</div>`;
  if (passiveNames.length > 0) {
    html += '<span class="sc-sep"></span>';
    html += `<div class="sc-group"><span class="sc-label">passive</span>${chips(passive, passiveNames)}</div>`;
  }
  el.innerHTML = html;
}

function condenseStations(source: StationsByName, specifiers: string[]): StationsByName {
  const result: StationsByName = {};
  for (const [name, summary] of Object.entries(source)) {
    const key = normalizeStationName(name, specifiers);
    if (!result[key]) {
      result[key] = { tiers: { ...summary.tiers }, total: summary.total };
    } else {
      for (const t of Object.keys(summary.tiers) as unknown as Tier[]) {
        result[key].tiers[t] = (result[key].tiers[t] ?? 0) + summary.tiers[t];
      }
      result[key].total += summary.total;
    }
  }
  return result;
}

// strips specifier prefixes so "Simple Cooking Station" and
// "Sturdy Cooking Station" both become "cooking station"
function normalizeStationName(name: string, specifiers: string[]): string {
  let n = name.toLowerCase();
  for (const s of specifiers) {
    n = n.replace(new RegExp(`\\b${s}\\b`, 'gi'), '');
  }
  return n.replace(/\s+/g, ' ').trim();
}

// -- food panel --
// same columns as the inventory food panel but with status-colored left borders.
// canMake/bottleneck start as dashes, filled when craftability finishes async.

function renderFoodPanel(foodItems: Items): void {
  const body = document.getElementById('ov-food-body');
  if (!body) return;

  const rows = Object.entries(foodItems)
    .map(([id, item]) => ({ id, tier: item.tier, name: item.name, have: item.qty }))
    .sort((a, b) => b.have - a.have || a.tier - b.tier);

  body.innerHTML = rows
    .map((r) => {
      const status = r.have > 0 ? 'complete' : 'missing';
      const dimmed = r.have === 0 ? ' dimmed' : '';
      const haveText = r.have > 0 ? r.have.toLocaleString() : '\u2014';
      return `<tr class="${status}${dimmed}">
      <td class="it-pin"><button class="pin-toggle" data-id="${r.id}">[ ]</button></td>
      <td><span class="it-tier">T${r.tier}</span></td>
      <td class="it-name">${r.name}</td>
      <td class="it-qty${r.have === 0 ? ' zero' : ''}">${haveText}</td>
      <td class="it-craft zero">\u2014</td>
      <td class="it-note">\u2014</td>
    </tr>`;
    })
    .join('');
}

// -- supply panel --
// header stat comes from claimInfo. the cargo rows need the same extraction
// logic that dashboard.ts renderSupplyPanel uses, which isn't exported yet.
// wiring that is a follow-up -- for now header works, body is empty.

function renderSupplyPanel(claimInfo: ClaimResponse): void {
  const stat = document.getElementById('ov-supply-stat');
  if (!stat) return;

  const c = claimInfo.claim;
  const supplies = c?.supplies ?? 0;
  const upkeep = c?.upkeepCost ?? 0;
  let text = `${supplies.toLocaleString()} total`;
  if (c?.suppliesRunOut) text += ` \u00b7 ${c.suppliesRunOut}`;
  if (upkeep > 0) text += ` \u00b7 @ ${upkeep}/h`;
  stat.textContent = text;
}

// -- helpers --

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setHeadline(valId: string, value: string, subId: string, sub: string): void {
  setText(valId, value);
  setText(subId, sub);
}

// -- public --

export function render(data: OverviewData): void {
  log.info('Rendering overview');
  renderMasthead(data.claimInfo);
  renderHeadlines(data.claimInfo, data.foodItems);
  renderFoodPanel(data.foodItems);
  renderSupplyPanel(data.claimInfo);
}

export function renderStations(stations: CraftingStationsResult): void {
  renderStationChips(stations);
}

export function updateCitizenCount(count: number): void {
  setText('ov-hl-citizens', String(count));
  setText('ov-hl-citizens-sub', 'members');
}

export function updateCraftCount(count: number, finishingSoon: number): void {
  const el = document.getElementById('ov-hl-crafts');
  if (el) {
    el.textContent = String(count);
    el.style.color = count > 0 ? 'var(--accent3)' : '';
  }
  setText('ov-hl-crafts-sub', finishingSoon > 0 ? `${finishingSoon} finishing soon` : '');
}
