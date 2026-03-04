// Dashboard rendering methods
// Handles: overview panels (food, supply, stations), inventory grid, profession sub-views
//
// Craftability (Can Make / Bottleneck) loads async after initial render.
// Panels show "—" immediately, then update when recipe data arrives.

import type {
  BuildingBreakdown,
  CategoryInventory,
  CraftingStationsResult,
  InventoryItem,
  InventoryProcessResult,
  Items,
  ProcessedInventory,
  StationsByName,
  TagGroup,
  Tier,
  TierQuantities,
  InventoryLookup,
  Package,
} from './types/index.js';
import { FILTER_TYPE } from './types/index.js';
import { CONFIG, DASHBOARD_CONFIG } from './configuration/index.js';
import { createLogger } from './logger.js';
import { applyTabA11y } from './aria.js';
import { loadRecipes } from './data/loader.js';
import { calcCraftableBatch, calcSupplyPotential } from './craftability-calc.js';
import type { CraftableResult, SupplyRow } from './craftability-calc.js';
import {
  createSubView,
  buildSubViewConfig,
  ALL_PROFESSIONS,
  calcProfessionBottlenecks,
  applyBottlenecks,
} from './sub-view/index.js';
import type { SubViewHandle } from './components/sub-view/index.js';

const log = createLogger('Dashboard');

// ═══ FOOD PIN PERSISTENCE ═══
// localStorage so pin state survives page reloads.
// Stores item IDs (the numeric keys from Items record).

const PINS_KEY = 'bcm-food-pins';

function loadPins(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(PINS_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function savePins(pins: Set<string>): void {
  localStorage.setItem(PINS_KEY, JSON.stringify([...pins]));
}

const pinnedFoodIds: Set<string> = loadPins();
let currentFoodFilter: 'all' | 'pinned' | 'stock' = 'all';

// ═══ CRAFTABILITY STATE ═══
// Computed async after initial render. null = still loading.
let craftabilityMap: Map<string, CraftableResult> | null = null;
let supplyRows: SupplyRow[] | null = null;

// Claim info for supply panel hero (supply pool, burn rate, time remaining).
// Set via setClaimInfo() from renderDashboard, read by renderSupplyPanel.
let cachedClaimInfo: {
  supplies?: number;
  upkeepCost?: number;
  suppliesRunOut?: string;
} | null = null;

// ═══ FOOD PANEL ═══

interface FoodRow {
  id: string;
  tier: number;
  name: string;
  have: number;
  canMake: number;
  bottleneck: string | null;
  pinned: boolean;
}

function buildFoodRows(foodItems: Items): FoodRow[] {
  return Object.entries(foodItems).map(([id, item]) => {
    const key = `${item.name}:${item.tier}`;
    const craft = craftabilityMap?.get(key);
    return {
      id,
      tier: item.tier,
      name: item.name,
      have: item.qty,
      canMake: craft?.canMake ?? 0,
      bottleneck: craft?.bottleneck ?? null,
      pinned: pinnedFoodIds.has(id),
    };
  });
}

function sortFoodRows(rows: FoodRow[]): FoodRow[] {
  return [...rows].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.have !== b.have) return b.have - a.have;
    if (a.canMake !== b.canMake) return b.canMake - a.canMake;
    return a.tier - b.tier;
  });
}

function filterFoodRows(rows: FoodRow[], filter: string): FoodRow[] {
  if (filter === 'pinned') return rows.filter((r) => r.pinned);
  if (filter === 'stock') return rows.filter((r) => r.have > 0 || r.canMake > 0);
  return rows;
}

function renderFoodTable(rows: FoodRow[]): string {
  return rows
    .map((row) => {
      const dimmed = !row.pinned && row.have === 0 && row.canMake === 0;
      const hCls = row.have > 0 ? '' : 'zero';
      const cCls = row.canMake > 0 ? 'pos' : 'zero';
      const craftText = row.canMake > 0 ? '+' + row.canMake.toLocaleString() : '—';
      const noteText = row.bottleneck ?? '—';
      return `<tr class="${dimmed ? 'dimmed' : ''}" data-id="${row.id}">
      <td class="it-pin ${row.pinned ? 'pinned' : ''}" data-action="pin">⊙</td>
      <td><span class="it-tier">T${row.tier}</span></td>
      <td class="it-name">${row.name}</td>
      <td class="it-qty ${hCls}">${row.have > 0 ? row.have.toLocaleString() : '—'}</td>
      <td class="it-craft ${cCls}">${craftText}</td>
      <td class="it-note">${noteText}</td>
    </tr>`;
    })
    .join('');
}

// Full food panel render, idempotent, call whenever pins or filter change
function renderFoodPanel(foodItems: Items): void {
  const panel = document.getElementById('food-panel');
  if (!panel) return;

  const allRows = buildFoodRows(foodItems);
  const totalHave = allRows.reduce((sum, r) => sum + r.have, 0);
  const totalCraftable = allRows.reduce((sum, r) => sum + r.canMake, 0);
  const visible = sortFoodRows(filterFoodRows(allRows, currentFoodFilter));

  // Build pill active states
  const pillHtml = (['all', 'pinned', 'stock'] as const)
    .map((f) => {
      const label = f === 'stock' ? 'in stock' : f;
      return `<button class="pill ${currentFoodFilter === f ? 'on' : ''}" data-filter="${f}">${label}</button>`;
    })
    .join('');

  const craftableSpan =
    totalCraftable > 0
      ? ` · <span style="color:var(--success);font-weight:600">+${totalCraftable}</span> craftable`
      : '';

  panel.innerHTML = `
    <div class="panel-header">
      <span class="panel-title">Food</span>
      <div class="filter-pills" id="foodFilters">${pillHtml}</div>
    </div>
    <div class="panel-body">
      <div class="panel-hero">
        <span class="hero-big">${totalHave.toLocaleString()}</span>
        <span class="hero-context">in stock${craftableSpan}</span>
      </div>
      <hr class="hero-divider">
      <table class="item-table">
        <thead><tr>
          <th style="width:20px"></th>
          <th style="width:28px"></th>
          <th>Item</th>
          <th class="r">Have</th>
          <th class="r">Can Make</th>
          <th>Bottleneck</th>
        </tr></thead>
        <tbody id="foodBody">${renderFoodTable(visible)}</tbody>
      </table>
    </div>`;

  wireFoodEvents(panel, foodItems);
}

// Attach click handlers, separated so render stays pure
function wireFoodEvents(panel: HTMLElement, foodItems: Items): void {
  // Pin toggle
  panel.querySelector('#foodBody')?.addEventListener('click', (e) => {
    const pin = (e.target as HTMLElement).closest('[data-action="pin"]');
    if (!pin) return;
    const row = pin.closest('tr');
    const id = row?.dataset.id;
    if (!id) return;

    if (pinnedFoodIds.has(id)) {
      pinnedFoodIds.delete(id);
    } else {
      pinnedFoodIds.add(id);
    }
    savePins(pinnedFoodIds);
    renderFoodPanel(foodItems);
  });

  // Filter pills
  panel.querySelector('#foodFilters')?.addEventListener('click', (e) => {
    const pill = (e.target as HTMLElement).closest('.pill') as HTMLElement | null;
    if (!pill?.dataset.filter) return;
    currentFoodFilter = pill.dataset.filter as typeof currentFoodFilter;
    renderFoodPanel(foodItems);
  });
}

// ═══ SUPPLY CARGO PANEL ═══

// Supply panel shows city supply pool stats and production potential.
// Finished cargo is almost always 0 because players deposit immediately.
// The useful question is "how much could we make from what's in chests?"
function renderSupplyPanel(): void {
  const panel = document.getElementById('supply-panel');
  if (!panel) return;

  const rows = (supplyRows ?? []).filter((r) => r.canMake > 0);
  const totalCraftable = rows.reduce((sum, r) => sum + r.canMake, 0);

  // Hero: supply pool from claim API
  const claim = cachedClaimInfo;
  const poolNum = claim?.supplies ?? 0;
  const upkeep = claim?.upkeepCost ?? 0;

  let timeStr = '';
  if (claim?.suppliesRunOut) {
    const diffMs = new Date(claim.suppliesRunOut).getTime() - Date.now();
    if (diffMs > 0) {
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      timeStr = days > 0 ? `${days}d ${hours}h remaining` : `${hours}h remaining`;
    } else {
      timeStr = 'Depleted';
    }
  }

  const rateStr = upkeep > 0 ? `@ ${upkeep.toLocaleString()}/h` : '';
  const contextParts = ['supplies', timeStr, rateStr].filter(Boolean).join(' \u00b7 ');
  const craftableSpan =
    totalCraftable > 0
      ? ` \u00b7 <span style="color:var(--success);font-weight:600">${totalCraftable.toLocaleString()}</span> craftable`
      : '';

  const tableRows = rows
    .map((row) => {
      const dimmed = row.canMake === 0;
      const cCls = row.canMake > 0 ? 'pos' : 'zero';
      const craftText = row.canMake > 0 ? row.canMake.toLocaleString() : '\u2014';
      const noteText = row.bottleneckDetail ?? '\u2014';
      return `<tr class="${dimmed ? 'dimmed' : ''}">
      <td><span class="it-tier">T${row.tier}</span></td>
      <td class="it-name">${row.label}</td>
      <td class="it-craft ${cCls}">${craftText}</td>
      <td class="it-note">${noteText}</td>
    </tr>`;
    })
    .join('');

  panel.innerHTML = `
    <div class="panel-header">
      <span class="panel-title">Supply Cargo</span>
    </div>
    <div class="panel-body">
      <div class="panel-hero">
        <span class="hero-big">${poolNum.toLocaleString()}</span>
        <span class="hero-context">${contextParts}${craftableSpan}</span>
      </div>
      <hr class="hero-divider">
      <table class="item-table">
        <thead><tr>
          <th style="width:28px"></th>
          <th>Cargo</th>
          <th class="r">Can Make</th>
          <th>Bottleneck</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;
}

// ═══ STATION PANELS ═══

function renderStationPanel(stations: StationsByName, panelId: string, title: string): void {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const names = Object.keys(stations).sort();
  const total = names.reduce((sum, n) => sum + stations[n].total, 0);

  // Find highest occupied tier so we don't render empty trailing columns
  let maxTier = 1;
  for (const name of names) {
    const tiers = stations[name].tiers;
    for (let t = CONFIG.MAX_TIER; t >= 1; t--) {
      if (tiers[t as keyof TierQuantities] > 0) {
        maxTier = Math.max(maxTier, t);
        break;
      }
    }
  }

  let headerCells = '<th></th>';
  for (let t = 1; t <= maxTier; t++) headerCells += `<th>T${t}</th>`;
  headerCells += '<th>Total</th>';

  const bodyRows = names
    .map((name) => {
      const station = stations[name];
      let cells = `<td>${name}</td>`;
      for (let t = 1; t <= maxTier; t++) {
        const val = station.tiers[t as keyof TierQuantities] || 0;
        cells += `<td class="${val > 0 ? 'has' : ''}">${val > 0 ? val : '–'}</td>`;
      }
      cells += `<td class="rtotal">${station.total}</td>`;
      return `<tr>${cells}</tr>`;
    })
    .join('');

  panel.innerHTML = `
    <div class="panel-header">
      <span class="panel-title">${title}</span>
      <span class="panel-stat">${total} total</span>
    </div>
    <div class="panel-body">
      <div class="station-body">
        <table class="st-table">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    </div>`;
}

// ═══ STATION SPECIFIER REMOVAL ═══
// "Simple Cooking Station" + "Sturdy Cooking Station" → "cooking station"
// with counts in the right tier columns. Same logic as before, just cleaner.

function condenseStations(source: StationsByName, specifiers: string[]): StationsByName {
  const result: StationsByName = {};

  for (const [name, summary] of Object.entries(source)) {
    const normalized = normalizeStationName(name, specifiers);

    if (!result[normalized]) {
      result[normalized] = { tiers: { ...summary.tiers }, total: summary.total };
    } else {
      for (const t of Object.keys(summary.tiers) as unknown as Tier[]) {
        result[normalized].tiers[t] = (result[normalized].tiers[t] ?? 0) + summary.tiers[t];
      }
      result[normalized].total += summary.total;
    }
  }

  return result;
}

function normalizeStationName(name: string, specifiers: string[]): string {
  let result = name.toLowerCase();
  for (const spec of specifiers) {
    result = result.replace(new RegExp(`\\b${spec}\\b`, 'gi'), '');
  }
  return result.replace(/\s+/g, ' ').trim();
}

// ═══ ASYNC CRAFTABILITY ═══
// Loads recipes.json, builds an inventory lookup from the processed items,
// computes canMake for every food and supply item, then re-renders panels.
// Fails silently, panels just keep showing "—" if recipes don't load.

async function loadCraftability(data: InventoryProcessResult): Promise<void> {
  try {
    const recipes = await loadRecipes();

    // Build a unified inventory lookup from ALL processed items
    const lookup = buildInventoryLookupFromProcessed(data);

    // Food craftability
    const foodItems = Object.values(data.foodItems).map((i) => ({ name: i.name, tier: i.tier }));
    craftabilityMap = calcCraftableBatch(recipes, foodItems, lookup);

    // Supply production potential
    supplyRows = calcSupplyPotential(recipes, lookup);

    // Re-render overview panels with real data
    if (lastFoodItems) renderFoodPanel(lastFoodItems);
    renderSupplyPanel();

    // Sub-view bottlenecks (re-render with craftability data)
    if (lastInventory && lastPackages) {
      for (const profession of ALL_PROFESSIONS) {
        const config = buildSubViewConfig(lastInventory, lastPackages, profession);
        const results = calcProfessionBottlenecks(profession, recipes, lookup);
        applyBottlenecks(config, results);
        subViewHandles.get(profession.id)?.update(config);
      }
    }

    log.debug(
      'Craftability loaded:',
      craftabilityMap?.size ?? 0,
      'food,',
      supplyRows.length,
      'supply rows'
    );
  } catch (e) {
    log.debug('Craftability load failed, panels keep showing dashes:', e);
  }
}

// Build "name:tier" → qty from the full ProcessedInventory.
// Includes all categories so recipe inputs (plank, ingot, etc.) are found.
function buildInventoryLookupFromProcessed(data: InventoryProcessResult): InventoryLookup {
  const lookup: InventoryLookup = new Map();

  for (const category of Object.values(data.inventory)) {
    for (const tagGroup of Object.values(category)) {
      for (const item of Object.values(tagGroup.items)) {
        const key = `${item.name}:${item.tier}`;
        lookup.set(key, (lookup.get(key) ?? 0) + item.qty);
      }
    }
  }

  return lookup;
}

// ═══ DATA REFS FOR RE-RENDER ═══
// Stored so craftability async callback can re-render panels without re-processing.
let lastFoodItems: Items | null = null;
let lastInventory: ProcessedInventory | null = null;
let lastPackages: Package | null = null;
const subViewHandles = new Map<string, SubViewHandle>();

// ═══ PUBLIC API, what UI.ts calls ═══

export const DashboardUI = {
  // Main render entry point for inventory view
  renderDashboard(
    data: InventoryProcessResult,
    claimInfo?: { claim?: { supplies?: number; upkeepCost?: number; suppliesRunOut?: string } }
  ): void {
    const { inventory, foodItems, packages } = data;

    // Cache claim info for supply panel hero
    cachedClaimInfo = claimInfo?.claim ?? null;

    // Show all food. The old RARITY_RARE filter dropped everything in
    // settlements with only common (rarity 1) food, which is most of them.
    const foods: Items = foodItems;

    // Stash for async re-render
    lastFoodItems = foods;

    // Overview panels -- render immediately with canMake = 0
    renderFoodPanel(foods);
    renderSupplyPanel();

    // Kick off async craftability computation
    loadCraftability(data);

    // Profession sub-views
    // Store handles for update() when bottleneck data arrives
    const subViewHandles = new Map<string, SubViewHandle>();
    lastInventory = inventory;
    lastPackages = packages;

    for (const profession of ALL_PROFESSIONS) {
      const el = document.getElementById(profession.id);
      if (!el) continue;

      const config = buildSubViewConfig(inventory, packages, profession);

      // First render or re-render
      const existing = subViewHandles.get(profession.id);
      if (existing) {
        existing.update(config);
      } else {
        subViewHandles.set(profession.id, createSubView(el, config));
      }
    }
    this.wireButtons();
    this.show('dashboard');
  },

  // Station panels are rendered separately because buildings come from a different API call
  renderCraftingStations(data: CraftingStationsResult): void {
    log.debug('Rendering station panels');
    const condensed = {
      active: condenseStations(data.active, DASHBOARD_CONFIG.SPECIFIER),
      passive: condenseStations(data.passive, DASHBOARD_CONFIG.SPECIFIER),
    };
    renderStationPanel(condensed.active, 'active-stations-panel', 'Active Stations');
    renderStationPanel(condensed.passive, 'passive-stations-panel', 'Passive Stations');
  },

  filterFridge(food: Items, fridge: string[], filter: FILTER_TYPE): Items {
    switch (filter) {
      case FILTER_TYPE.FRIDGE:
        return Object.fromEntries(
          Object.entries(food).filter(([_, item]) => fridge.includes(item.name))
        ) as Items;
      case FILTER_TYPE.RARITY_RARE:
        return Object.fromEntries(
          Object.entries(food).filter(([_, item]) => item.rarity && item.rarity > 1)
        ) as Items;
      default:
        return food;
    }
  },

  show(sectionId: string): void {
    const el: HTMLElement | null = document.getElementById(sectionId);
    if (el) el.classList.remove('hidden');
  },

  // ═══ SUB-VIEW TABS ═══

  wireButtons(): void {
    const subViews = document.getElementById('sub-views');
    if (subViews) applyTabA11y(subViews, '.sub-btn');

    const viewTabs = document.querySelectorAll<HTMLElement>('#sub-views .sub-btn');
    viewTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        viewTabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        document
          .querySelectorAll('#dashboard .dash-view')
          .forEach((s) => s.classList.add('hidden'));
        const viewEl = document.getElementById(`${view}`);
        viewEl?.classList.remove('hidden');
      });
    });
  },

  // ═══ INVENTORY GRID, collapsible category cards ═══

  renderInventory(inventory: ProcessedInventory, view: string): void {
    const grid: HTMLElement | null = document.getElementById(view);
    log.debug('start rendering inventory');
    if (!grid) {
      log.debug('inventory-grid not found ', view);
      return;
    }

    const exclude: string[] = DASHBOARD_CONFIG.INVENTORY_GRID_EXCLUDE;
    const sortedCategories: string[] = Object.keys(inventory)
      .filter((c) => !exclude.includes(c))
      .sort((a, b): number => {
        const aIdx: number = DASHBOARD_CONFIG.CATEGORY_ORDER.indexOf(a);
        const bIdx: number = DASHBOARD_CONFIG.CATEGORY_ORDER.indexOf(b);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });

    let html = '';

    for (const category of sortedCategories) {
      const tags: CategoryInventory = inventory[category];

      let categoryTotal = 0;
      for (const tagData of Object.values(tags) as TagGroup[]) {
        categoryTotal += tagData.total;
      }

      if (categoryTotal === 0) continue;

      let tableHtml = '';
      const sortedTags: string[] = Object.keys(tags).sort();

      for (const tag of sortedTags) {
        const tagData: TagGroup = tags[tag];

        const items: InventoryItem[] = (Object.values(tagData.items) as InventoryItem[]).sort(
          (a, b) => {
            if (a.tier !== b.tier) return a.tier - b.tier;
            return a.name.localeCompare(b.name);
          }
        );

        for (const item of items) {
          const tierBadge: string =
            item.tier > 0 ? `<span class="tier-badge">T${item.tier}</span>` : '';

          let breakdownHtml = '';
          if (item.buildings.length > 1) {
            const buildingList: string = [...item.buildings]
              .sort((a: BuildingBreakdown, b: BuildingBreakdown): number => b.qty - a.qty)
              .map((b) => `<li>${b.name}: ${b.qty.toLocaleString()}</li>`)
              .join('');
            breakdownHtml = `
            <details class="building-breakdown">
            <summary>${item.buildings.length} locations</summary>
            <ul>${buildingList}</ul>
            </details>
            `;
          }

          tableHtml += `
          <tr>
          <td>
          <div class="item-name">${tierBadge} ${item.name}</div>
          ${breakdownHtml}
          </td>
          <td class="qty">${item.qty.toLocaleString()}</td>
          </tr>
          `;
        }
      }

      html += `
      <div class="inventory-card" data-category="${category}">
      <div class="card-header">
      <h4>${category}</h4>
      <span class="total">${categoryTotal.toLocaleString()}</span>
      <span class="chevron">▼</span>
      </div>
      <div class="card-body">
      <table>${tableHtml}</table>
      </div>
      </div>
      `;
    }

    grid.innerHTML = html;

    grid.querySelectorAll('.card-header').forEach((header) => {
      header.addEventListener('click', () => {
        const card: Element | null = header.closest('.inventory-card');
        card?.classList.toggle('expanded');
      });
    });

    this.show('inventory');
  },

  // ═══ PROFESSION SUB-VIEWS ═══

  renderSubView(
    inventory: ProcessedInventory,
    packages: Package,
    completeTags: string[],
    singleItems: string[],
    allowedPackages: string[],
    view: string
  ): void {
    const filteredInventory: NamedMatrix = this.filterInventory(
      inventory,
      completeTags,
      singleItems
    );
    const sortedInventory: NamedMatrix = this.sortMatrix(
      filteredInventory,
      completeTags,
      singleItems
    );
    const config: MatrixConfig = this.createMatrixConfig(sortedInventory);
    const el: HTMLElement | null = document.getElementById(view + '-inventory');
    if (!el) return;
    createDataMatrix(el, config);
    const filteredPackages: NamedMatrix = this.filterPackages(packages, allowedPackages);
    const sortedPackages: NamedMatrix = this.sortMatrix(filteredPackages, allowedPackages, []);
    const configP: MatrixConfig = this.createMatrixConfig(sortedPackages);
    const elP: HTMLElement | null = document.getElementById(view + '-package');
    if (!elP) return;
    createDataMatrix(elP, configP);
  },

  filterInventory(
    inventory: ProcessedInventory,
    completeTags: string[],
    additionalItems: string[]
  ): NamedMatrix {
    const additionalSet = new Set(additionalItems);
    const completeTagSet = new Set(completeTags);
    const map: ResourceMatrix = {};

    for (const category of Object.values(inventory)) {
      for (const [tag, tagGroup] of Object.entries(category)) {
        const includesTag = completeTagSet.has(tag);
        for (const item of Object.values(tagGroup.items)) {
          if (!includesTag && !additionalSet.has(item.name)) continue;

          if (includesTag) {
            if (!map[tag]) map[tag] = Array.from({ length: CONFIG.MAX_TIER }, () => []);
            const tierIndex = item.tier >= 1 ? item.tier - 1 : 0;
            map[tag][tierIndex].push(item.qty);
          }

          if (additionalSet.has(item.name)) {
            if (!map[item.name]) map[item.name] = Array.from({ length: CONFIG.MAX_TIER }, () => []);
            const tierIndex = item.tier >= 1 ? item.tier - 1 : 0;
            map[item.name][tierIndex].push(item.qty);
          }
        }
      }
    }

    completeTagSet.forEach((value) => {
      if (!map[value]) map[value] = Array.from({ length: CONFIG.MAX_TIER }, () => []);
    });
    additionalSet.forEach((value) => {
      if (!map[value]) map[value] = Array.from({ length: CONFIG.MAX_TIER }, () => []);
    });

    return { map };
  },

  filterPackages(inventory: Package, allowedPackages: string[]): NamedMatrix {
    const allowedSet = new Set(allowedPackages);
    const map: ResourceMatrix = {};

    for (const [shortenedId, items] of Object.entries(inventory)) {
      if (!allowedSet.has(shortenedId)) continue;
      if (!map[shortenedId]) map[shortenedId] = Array.from({ length: CONFIG.MAX_TIER }, () => []);
      for (const item of Object.values(items)) {
        const tierIndex = item.tier >= 1 ? item.tier - 1 : 0;
        map[shortenedId][tierIndex].push(item.qty);
      }
    }

    allowedSet.forEach((value) => {
      if (!map[value]) map[value] = Array.from({ length: CONFIG.MAX_TIER }, () => []);
    });

    return { map };
  },

  sortMatrix(inventory: NamedMatrix, tags: string[], additionalItems: string[]): NamedMatrix {
    const priority = new Map([...tags, ...additionalItems].map((t, i) => [t, i]));
    const entries = Object.entries(inventory.map);
    entries.sort(([a], [b]) => (priority.get(a) ?? Infinity) - (priority.get(b) ?? Infinity));
    return { map: Object.fromEntries(entries) };
  },

  createMatrixConfig(named: NamedMatrix): MatrixConfig {
    const columns: MatrixColumn[] = Array.from({ length: CONFIG.MAX_TIER }, (_, i) => ({
      key: String(i + 1),
      label: `T${i + 1}`,
    }));

    const rows: MatrixRow[] = Object.entries(named.map).map(([tag, tiers]) => {
      const cells = Object.fromEntries(
        tiers.map((qtyList, i) => [String(i + 1), qtyList.reduce((sum, q) => sum + q, 0)])
      ) as Record<string, number>;
      return { key: tag, label: tag.toLowerCase(), cells };
    });

    return { columns, rows, showRowTotals: false };
  },
};
