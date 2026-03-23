// overview.ts -- the Home tab
// renders the newspaper-style city front page from data main.ts already fetches.
// each render function is idempotent: new data in, fresh DOM out.
//
// craftability arrives async from dashboard.ts via updateCraftability().
// citizens and planner arrive from main.ts via update* functions.
// the overview doesn't fetch anything itself - it CONSUMES.

import type {
  ClaimResponse,
  InventoryProcessResult,
  CraftingStationsResult,
  Items,
  StationsByName,
  Tier,
  PlannerResults,
  PlanItem,
} from './types/index.js';
import type { CraftableResult, SupplyRow } from './craftability-calc.js';
import { DASHBOARD_CONFIG } from './configuration/index.js';
import { createLogger } from './logger.js';
import { calculatePlanProgress, collectBranchKeys } from './planner/lib/progress-calc.js';
import { activityClass, relativeTime } from './citizens/data.js';

const log = createLogger('Overview');

interface OverviewData {
  claimInfo: ClaimResponse;
  inventory: InventoryProcessResult;
  foodItems: Items;
}

// stashed for async re-renders
let lastFoodItems: Items | null = null;
let lastSupplyCargo: Items | null = null;
let lastCraftability: Map<string, CraftableResult> | null = null;

// food pins - shared with dashboard.ts via same localStorage key
// plan is to remove the overview from the dashboard in next phase.
const PINS_KEY = 'bcm-food-pins';
let pinnedIds: Set<string> = loadPins();
let foodFilter: 'all' | 'pinned' | 'stock' = 'all';

function loadPins(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(PINS_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function savePins(): void {
  localStorage.setItem(PINS_KEY, JSON.stringify([...pinnedIds]));
}

// -- masthead --

function renderMasthead(claimInfo: ClaimResponse): void {
  const c = claimInfo.claim;
  if (!c) return;
  setText('ov-city-name', `${c.name ?? '\u2014'} Ledger`);
  setText('ov-faction', c.empireName ?? '\u2014');
  setText('ov-region', c.regionName ? `Region ${c.regionName}` : '\u2014');
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

function renderHeadlines(claimInfo: ClaimResponse, foodItems: Items): void {
  const c = claimInfo.claim;
  if (!c) return;

  const totalFood = Object.values(foodItems).reduce((sum, f) => sum + f.qty, 0);
  setHeadline('ov-hl-food', totalFood.toLocaleString(), 'ov-hl-food-sub', 'in stock');

  const supplies = c.supplies ?? 0;
  setHeadline(
    'ov-hl-supplies',
    supplies.toLocaleString(),
    'ov-hl-supplies-sub',
    formatSupplyRemaining(c.suppliesRunOut, c.upkeepCost ?? 0, supplies)
  );
}

// format the supplies remaining line. handles the raw timestamp,
// the computed hours, or just an empty string if there is neither.
function formatSupplyRemaining(
  suppliesRunOut: string | undefined,
  upkeepCost: number,
  currentSupplies: number
): string {
  if (suppliesRunOut) {
    const diffMs = new Date(suppliesRunOut).getTime() - Date.now();
    if (diffMs > 0) {
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      return days > 0 ? `${days}d ${hours}h remaining` : `${hours}h remaining`;
    }
    return 'depleted';
  }
  if (upkeepCost > 0) {
    const h = Math.floor(currentSupplies / upkeepCost);
    return `${Math.floor(h / 24)}d ${h % 24}h remaining`;
  }
  return '';
}

// -- station chip bar --
// grid layout. borders brighten based on active craft utilization.
// stash station data so we can re-render when craft counts arrive.

let lastStations: CraftingStationsResult | null = null;
let craftCountByStation = new Map<string, number>();

function renderStationChips(stations: CraftingStationsResult): void {
  const el = document.getElementById('ov-stations');
  if (!el) return;

  lastStations = stations;
  const specifiers = DASHBOARD_CONFIG.SPECIFIER;
  const active = condenseStations(stations.active, specifiers);
  const passive = condenseStations(stations.passive, specifiers);
  const activeNames = Object.keys(active).sort();
  const passiveNames = Object.keys(passive).sort();

  if (activeNames.length === 0 && passiveNames.length === 0) {
    el.innerHTML = '<span class="sc-label">no stations</span>';
    return;
  }

  const chip = (name: string, s: { tiers: Record<string, number>; total: number }): string => {
    const tiers = (Object.entries(s.tiers) as [string, number][])
      .filter(([, qty]) => qty > 0)
      .map(([t, qty]) => `T${t}x${qty}`)
      .join(' ');
    const tierBit = tiers ? ` <span class="sc-tiers">${tiers}</span>` : '';
    // brightness: 0 crafts = default border, more = brighter
    const busy = craftCountByStation.get(name) ?? 0;
    const busyCls = busy > 0 ? ' sc-busy' : '';
    return `<span class="station-chip${busyCls}" data-station="${name}">${name} <span class="sc-total">x${s.total}</span>${tierBit}</span>`;
  };

  let html = `<div class="sc-group"><span class="sc-label">crafting</span><div class="sc-grid">`;
  html += activeNames.map((n) => chip(n, active[n])).join('');
  html += '</div></div>';
  if (passiveNames.length > 0) {
    html += `<div class="sc-group"><span class="sc-label">passive</span><div class="sc-grid">`;
    html += passiveNames.map((n) => chip(n, passive[n])).join('');
    html += '</div></div>';
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

function normalizeStationName(name: string, specifiers: string[]): string {
  let n = name.toLowerCase();
  for (const s of specifiers) {
    n = n.replace(new RegExp(`\\b${s}\\b`, 'gi'), '');
  }
  // "station" wastes space so I stripped it
  n = n.replace(/\bstation\b/gi, '');
  return n.replace(/\s+/g, ' ').trim();
}

// -- food panel --

function rowStatus(have: number, canMake: number): string {
  if (have > 0 && canMake > 0) return 'complete';
  if (have > 0 || canMake > 0) return 'partial';
  return 'missing';
}

function renderFoodPanel(foodItems: Items, craftMap: Map<string, CraftableResult> | null): void {
  const body = document.getElementById('ov-food-body');
  if (!body) return;

  pinnedIds = loadPins();

  const rows = Object.entries(foodItems).map(([id, item]) => {
    const key = `${item.name}:${item.tier}`;
    const craft = craftMap?.get(key);
    return {
      id,
      tier: item.tier,
      name: item.name,
      have: item.qty,
      canMake: craft?.canMake ?? 0,
      bottleneck: craft?.bottleneck ?? null,
      pinned: pinnedIds.has(id),
    };
  });

  let visible = rows;
  if (foodFilter === 'pinned') visible = rows.filter((r) => r.pinned);
  if (foodFilter === 'stock') visible = rows.filter((r) => r.have > 0 || r.canMake > 0);

  visible.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.have !== b.have) return b.have - a.have;
    if (a.canMake !== b.canMake) return b.canMake - a.canMake;
    return a.tier - b.tier;
  });

  const maxHave = Math.max(1, ...visible.map((r) => r.have));

  body.innerHTML = visible
    .map((r) => {
      const status = rowStatus(r.have, r.canMake);
      const dimmed = !r.pinned && r.have === 0 && r.canMake === 0 ? ' dimmed' : '';
      const haveText = r.have > 0 ? r.have.toLocaleString() : '\u2014';
      const craftCls = r.canMake > 0 ? 'pos' : 'zero';
      const craftText = r.canMake > 0 ? `+${r.canMake.toLocaleString()}` : '\u2014';
      const pinCls = r.pinned ? 'pinned' : '';
      const pinText = r.pinned ? '[x]' : '[ ]';
      const barHtml = r.have > 0 ? heatBar(r.have, maxHave) : '';
      return `<tr class="${status}${dimmed}" data-id="${r.id}">
      <td class="it-pin">
        <button class="pin-toggle ${pinCls}" data-action="pin"
          aria-label="${r.pinned ? 'Unpin' : 'Pin'} ${r.name}"
          aria-pressed="${r.pinned}">${pinText}</button>
      </td>
      <td><span class="it-tier">T${r.tier}</span></td>
      <td class="it-name">${r.name}</td>
      <td class="it-qty${r.have === 0 ? ' zero' : ''}">${haveText}${barHtml}</td>
      <td class="it-craft ${craftCls}">${craftText}</td>
      <td class="it-note">${r.bottleneck ?? '\u2014'}</td>
    </tr>`;
    })
    .join('');
}

function wireFoodPanel(): void {
  const panel = document.getElementById('ov-food-panel');
  if (!panel || panel.dataset.wired) return;
  panel.dataset.wired = '1';

  panel.addEventListener('click', (e) => {
    const pin = (e.target as HTMLElement).closest('[data-action="pin"]');
    if (pin) {
      const row = pin.closest('tr');
      const id = row?.dataset.id;
      if (!id) return;
      if (pinnedIds.has(id)) pinnedIds.delete(id);
      else pinnedIds.add(id);
      savePins();
      if (lastFoodItems) renderFoodPanel(lastFoodItems, lastCraftability);
      return;
    }

    const pill = (e.target as HTMLElement).closest('.pill') as HTMLElement | null;
    if (pill?.dataset.filter) {
      foodFilter = pill.dataset.filter as typeof foodFilter;
      panel.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      if (lastFoodItems) renderFoodPanel(lastFoodItems, lastCraftability);
    }
  });
}

// -- supply panel --

function renderSupplyPanel(claimInfo: ClaimResponse): void {
  const stat = document.getElementById('ov-supply-stat');
  if (!stat) return;
  const c = claimInfo.claim;
  const supplies = c?.supplies ?? 0;
  const upkeep = c?.upkeepCost ?? 0;

  const parts: string[] = [`${supplies.toLocaleString()} total`];
  const remaining = formatSupplyRemaining(c?.suppliesRunOut, upkeep, supplies);
  if (remaining) parts.push(remaining);
  if (upkeep > 0) parts.push(`@ ${Math.round(upkeep * 100) / 100}/h`);
  stat.textContent = parts.join(' \u00b7 ');
}

function renderSupplyRows(supplyCargo: Items, supplyRowData: SupplyRow[] | null): void {
  const body = document.getElementById('ov-supply-body');
  if (!body) return;

  const cargoHave = new Map<string, number>();
  for (const item of Object.values(supplyCargo)) {
    const key = `${item.name}:${item.tier}`;
    cargoHave.set(key, (cargoHave.get(key) ?? 0) + item.qty);
  }

  if (supplyRowData && supplyRowData.length > 0) {
    const rows = supplyRowData.map((sr) => ({
      ...sr,
      have: cargoHave.get(`${sr.name}:${sr.tier}`) ?? 0,
    }));

    const seen = new Set(rows.map((r) => `${r.name}:${r.tier}`));
    for (const item of Object.values(supplyCargo)) {
      const key = `${item.name}:${item.tier}`;
      if (!seen.has(key) && item.qty > 0) {
        rows.push({
          name: item.name,
          tier: item.tier,
          label: item.name,
          have: item.qty,
          canMake: 0,
          bottleneck: null,
          bottleneckDetail: null,
        });
        seen.add(key);
      }
    }

    rows.sort((a, b) => b.have + b.canMake - (a.have + a.canMake) || a.tier - b.tier);

    const filtered = rows.filter((r) => r.have > 0 || r.canMake > 0);
    const maxHave = Math.max(1, ...filtered.map((r) => r.have));

    body.innerHTML = filtered
      .map((r) => {
        const status = rowStatus(r.have, r.canMake);
        const haveText = r.have > 0 ? r.have.toLocaleString() : '\u2014';
        const craftCls = r.canMake > 0 ? 'pos' : 'zero';
        const craftText = r.canMake > 0 ? `+${r.canMake.toLocaleString()}` : '\u2014';
        const barHtml = r.have > 0 ? heatBar(r.have, maxHave) : '';
        return `<tr class="${status}">
          <td><span class="it-tier">T${r.tier}</span></td>
          <td class="it-name">${r.label}</td>
          <td class="it-qty${r.have === 0 ? ' zero' : ''}">${haveText}${barHtml}</td>
          <td class="it-craft ${craftCls}">${craftText}</td>
          <td class="it-note">${r.bottleneck ?? '\u2014'}</td>
        </tr>`;
      })
      .join('');
    return;
  }

  const cargoEntries = Object.values(supplyCargo).filter((i) => i.qty > 0);
  if (cargoEntries.length > 0) {
    const sorted = cargoEntries.sort((a, b) => b.qty - a.qty || a.tier - b.tier);
    const maxQty = Math.max(1, ...sorted.map((i) => i.qty));
    body.innerHTML = sorted
      .map(
        (item) => `<tr class="partial">
        <td><span class="it-tier">T${item.tier}</span></td>
        <td class="it-name">${item.name}</td>
        <td class="it-qty">${item.qty.toLocaleString()}${heatBar(item.qty, maxQty)}</td>
        <td class="it-craft zero">\u2014</td>
        <td class="it-note">\u2014</td>
      </tr>`
      )
      .join('');
  } else {
    body.innerHTML = '';
  }
}

// -- research --

function toBranchLabel(name: string): string {
  return name
    .replace(' Research', '')
    .replace(' Codex', '')
    .replace(
      /^(Novice|Apprentice|Journeyman|Expert|Master|Proficient|Essential|Advanced|Comprehensive|Beginner's?) /i,
      ''
    );
}

function renderResearch(results: PlannerResults): void {
  const container = document.getElementById('ov-research');
  const pctEl = document.getElementById('ov-research-pct');
  if (!container) return;

  const overall = calculatePlanProgress(results.planItems);
  if (pctEl) pctEl.textContent = `${overall.percent}%`;

  const branches: { label: string; percent: number }[] = [];

  for (const research of results.researches) {
    const branchKeys = collectBranchKeys(research);
    const branchItems = results.planItems.filter((i) => branchKeys.has(`${i.name}:${i.tier}`));
    branches.push({
      label: toBranchLabel(research.name),
      percent: calculatePlanProgress(branchItems).percent,
    });
  }

  if (results.studyJournals) {
    const jKeys = collectBranchKeys(results.studyJournals);
    const jItems = results.planItems.filter((i) => jKeys.has(`${i.name}:${i.tier}`));
    branches.push({ label: 'Journals', percent: calculatePlanProgress(jItems).percent });
  }

  container.innerHTML = branches
    .map((b) => {
      const color =
        b.percent >= 100
          ? 'var(--status-complete)'
          : b.percent > 50
            ? 'var(--status-partial)'
            : 'var(--status-missing)';
      const pctText = b.percent >= 100 ? 'done' : `${b.percent}%`;
      return `<div class="ov-mat-row">
      <span class="ov-mat-name">${b.label}</span>
      <span class="ov-mat-qty" style="font-size:9px;color:${color}">${pctText}</span>
      <div class="ov-mat-bar"><div class="ov-mat-fill" style="width:${b.percent}%;background:${color}"></div></div>
    </div>`;
    })
    .join('');
}

// -- bottlenecks --

function renderBottlenecks(planItems: PlanItem[]): void {
  const container = document.getElementById('ov-bottlenecks');
  if (!container) return;

  const worst = planItems
    .filter((i) => i.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit)
    .slice(0, 5);

  if (worst.length === 0) {
    container.innerHTML = '<div class="ac-loading">no bottlenecks</div>';
    return;
  }

  container.innerHTML = worst
    .map((item) => {
      const icon = item.have === 0 ? '!' : '~';
      const color = item.have === 0 ? 'var(--status-missing)' : 'var(--status-partial)';
      const tierStr = item.tier > 0 ? `T${item.tier} ` : '';
      return `<div class="ov-alert">
      <span class="ov-alert-icon" style="color:${color}">${icon}</span>
      <span class="ov-alert-text"><strong>${tierStr}${item.name}</strong> -- need ${item.deficit.toLocaleString()}, have ${item.have.toLocaleString()}</span>
    </div>`;
    })
    .join('');
}

// -- helpers --

// tiny inline bar that gives a visual sense of relative quantity.
// color grades follow the heatmap gradient.
function heatBar(value: number, max: number): string {
  const ratio = max > 0 ? value / max : 0;
  const pct = Math.round(ratio * 100);
  const color =
    ratio > 0.5
      ? 'var(--status-complete)'
      : ratio > 0.2
        ? 'var(--status-partial)'
        : 'var(--status-missing)';
  return `<span class="it-heat"><span class="it-heat-fill" style="width:${pct}%;background:${color}"></span></span>`;
}

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
  lastFoodItems = data.foodItems;
  lastSupplyCargo = data.inventory.supplyCargo;

  renderMasthead(data.claimInfo);
  renderHeadlines(data.claimInfo, data.foodItems);
  renderFoodPanel(data.foodItems, lastCraftability);
  wireFoodPanel();
  renderSupplyPanel(data.claimInfo);
  renderSupplyRows(data.inventory.supplyCargo, null);
}

export function renderStations(stations: CraftingStationsResult): void {
  renderStationChips(stations);
}

// update chip borders when active craft data arrives.
// buildingNames = raw building names from craft API (e.g. "Fine Mining Station").
export function updateStationCrafts(buildingNames: string[]): void {
  const specifiers = DASHBOARD_CONFIG.SPECIFIER;
  const counts = new Map<string, number>();
  for (const raw of buildingNames) {
    const key = normalizeStationName(raw, specifiers);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  craftCountByStation = counts;
  // re-render chips with updated busy state
  if (lastStations) renderStationChips(lastStations);
}

export function updateCraftability(
  craftMap: Map<string, CraftableResult> | null,
  supplyRowData: SupplyRow[] | null
): void {
  lastCraftability = craftMap;
  if (lastFoodItems) renderFoodPanel(lastFoodItems, craftMap);
  if (lastSupplyCargo) renderSupplyRows(lastSupplyCargo, supplyRowData);
  log.debug('Craftability updated on overview');
}

export function updateResearch(results: PlannerResults): void {
  renderResearch(results);
  renderBottlenecks(results.planItems);
}

export function updateCitizenCount(_count: number): void {
  // initial total -- overwritten by updateCitizens with online count
}

export function updateCraftCount(count: number, finishingSoon: number): void {
  setText('ov-hl-crafts', String(count));
  setText('ov-hl-crafts-sub', finishingSoon > 0 ? `${finishingSoon} finishing soon` : '');
}

export function updateCitizens(
  records: {
    userName: string;
    lastLogin: Date;
  }[]
): void {
  const container = document.getElementById('ov-citizens-list');
  const statEl = document.getElementById('ov-cz-online');
  if (!container) return;

  if (records.length === 0) {
    container.innerHTML = '<div class="ac-loading">no citizens</div>';
    return;
  }

  const recent = records.filter((r) => activityClass(r.lastLogin) === 'cz-active').length;
  if (statEl) statEl.textContent = recent > 0 ? `${recent} active` : `${records.length} total`;

  // headline shows online count, sub shows total
  setText('ov-hl-citizens', String(recent));
  setText('ov-hl-citizens-sub', `of ${records.length}`);

  const sorted = [...records].sort((a, b) => b.lastLogin.getTime() - a.lastLogin.getTime());

  container.innerHTML = sorted
    .slice(0, 20)
    .map((r) => {
      const dotCls = activityClass(r.lastLogin);
      const seen = relativeTime(r.lastLogin);
      return `<div class="ov-cz-row">
        <span class="ov-cz-dot ${dotCls}"></span>
        <span class="ov-cz-name">${r.userName}</span>
        <span class="ov-cz-activity">${seen}</span>
      </div>`;
    })
    .join('');
}
