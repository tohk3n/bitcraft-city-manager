// Dashboard rendering methods
// Handles: material matrix, quick stats, crafting stations, inventory grid

import type {
  BuildingBreakdown,
  CategoryInventory,
  CraftingStationsResult,
  InventoryItem,
  InventoryProcessResult,
  Item,
  Items,
  NamedMatrix,
  ProcessedInventory,
  ResourceMatrix,
  Rule,
  StationsByName,
  StationSummary,
  TagGroup,
  Tier,
  TierQuantities,
} from './types/index.js';
import { FILTER_TYPE, FOOD_BUFF, SUPPLY_CAT } from './types/index.js';
import { CONFIG, DASHBOARD_CONFIG } from './configuration/index.js';
import { createLogger } from './logger.js';
import type {
  MatrixColumn,
  MatrixConfig,
  MatrixRow,
} from './components/data-matrix/data-matrix.js';
import { createDataMatrix } from './components/data-matrix/data-matrix.js';

const log = createLogger('Dashboard');

export const DashboardUI = {
  // Main render entry point for inventory view
  renderDashboard(data: InventoryProcessResult): void {
    const { inventory, foodItems, supplyCargo } = data;
    const foods: Items = DashboardUI.filterFridge(
      foodItems,
      DASHBOARD_CONFIG.FRIDGE,
      FILTER_TYPE.RARITY_RARE
    );
    this.renderQuickStats(foods, supplyCargo, 'quick-stats');
    this.renderInventory(inventory, 'inventory-grid');
    this.renderTailoring(inventory, 'tailor-view');
    this.wireButtons();
    this.show('dashboard');
  },
  // Used to set subview button listener
  wireButtons(): void {
    const viewTabs = document.querySelectorAll<HTMLElement>('#sub-views .sub-btn');
    viewTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;

        // Update active tab
        viewTabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        // Show correct view
        document
          .querySelectorAll('#dashboard .dash-view')
          .forEach((s) => s.classList.add('hidden'));
        const viewEl = document.getElementById(`${view}`);
        viewEl?.classList.remove('hidden');
      });
    });
  },
  filterFridge(food: Items, fridge: string[], filter: FILTER_TYPE): Items {
    // defines what we show in the food tab
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
  // Helper to show a section
  show(sectionId: string): void {
    const el: HTMLElement | null = document.getElementById(sectionId);
    if (el) el.classList.remove('hidden');
  },

  // Food and Supply quick stats
  renderQuickStats(foodItems: Items, supplies: Items, view: string): void {
    const container: HTMLElement | null = document.getElementById(view);
    if (!container) return;

    // Food section
    const foodList: Item[] = DashboardUI.sortItems(foodItems, DASHBOARD_CONFIG.FOOD_RULE);
    //total amount
    const foodTotal: number = Object.values(foodItems).reduce(
      (sum: number, item: Item): number => sum + (item.qty ?? 0),
      0
    );

    let html: string = DashboardUI.generateFoodHtml(foodTotal, foodList, 15);

    // Supply cargo items available
    const suppliesTotal: number = Object.values(supplies).reduce(
      (sum: number, item: Item): number => sum + (item.qty ?? 0),
      0
    );
    const supplyList: Item[] = DashboardUI.sortItems(supplies, []);

    html += DashboardUI.generateSupplyHtml(suppliesTotal, supplyList, 15);

    container.innerHTML = html;
  },
  generateItemTableHtml<CAT>(
    icon: string,
    title: string,
    total: number,
    items: Item[],
    maxEntries: number,
    getCategory: (item: Item) => CAT,
    renderCategory: (cat: CAT) => string,
    showMoreRow = false
  ): string {
    let html: string = DashboardUI.makeTableHeaderHtml(icon, total, title);
    let lastCat: CAT | undefined = undefined;

    for (const item of items.slice(0, maxEntries)) {
      const cat: CAT = getCategory(item);
      if (lastCat !== cat) {
        lastCat = cat;
        html += `<tr><td>${renderCategory(cat)}</td><td class="cat-header"></td></tr>`;
      }
      const tierBadge: string =
        item.tier > 0 ? `<span class="tier-badge">T${item.tier}</span>` : '';

      html += `<tr>
      <td>${tierBadge} ${item.name}</td>
      <td class="qty">${item.qty.toLocaleString()}</td>
    </tr>`;
    }
    if (showMoreRow && items.length > maxEntries) {
      html += `<tr class="more">
      <td colspan="2">+${items.length - maxEntries} more</td>
    </tr>`;
    }
    html += '</table></div></div>';
    return html;
  },
  generateFoodHtml(foodTotal: number, foodList: Item[], maxEntries: number) {
    return DashboardUI.generateItemTableHtml(
      '🍖',
      'Food',
      foodTotal,
      foodList,
      maxEntries,
      (item) => DashboardUI.getFoodBuffCategory(item.name),
      (cat) => String(cat),
      true
    );
  },
  // requires the supplyList to be sorted by tag/category -> look into SUPPLY_CAT
  generateSupplyHtml(suppliesTotal: number, supplyList: Item[], maxEntries: number) {
    return DashboardUI.generateItemTableHtml(
      '📦',
      'Supply Cargo',
      suppliesTotal,
      supplyList,
      maxEntries,
      (item) => DashboardUI.getSupplyCategory(item.name),
      (cat) => String(cat),
      false
    );
  },
  getFoodBuffCategory(name: string): FOOD_BUFF {
    name = name.toLowerCase();
    let cat;
    if (name.includes('fish')) {
      cat = FOOD_BUFF.CRAFTING;
    } else if (name.includes('meat')) {
      cat = FOOD_BUFF.COMBAT;
    } else if (name.includes('mushroom') || name.includes('berry')) {
      cat = FOOD_BUFF.MOVEMENT;
    } else {
      cat = FOOD_BUFF.NONE;
    }
    return cat;
  },
  getSupplyCategory(name: string): SUPPLY_CAT {
    name = name.toLowerCase();
    let cat;
    if (name.includes('timber')) {
      cat = SUPPLY_CAT.TIMBER;
    } else if (name.includes('frame')) {
      cat = SUPPLY_CAT.FRAMES;
    } else if (name.includes('tarp')) {
      cat = SUPPLY_CAT.TARP;
    } else if (name.includes('sack')) {
      cat = SUPPLY_CAT.HEX;
    } else if (name.includes('slab')) {
      cat = SUPPLY_CAT.SLAB;
    } else if (name.includes('sheeting')) {
      cat = SUPPLY_CAT.LEATHER;
    } else if (name.includes('experimental')) {
      cat = SUPPLY_CAT.SCHOLAR;
    } else {
      cat = SUPPLY_CAT.NONE;
    }
    return cat;
  },
  sortItems(items: Items, rules: Rule[]): Item[] {
    return Object.values(items).sort(
      DashboardUI.prioritySort(
        (item) => {
          const n: string = item.name.toLowerCase();
          for (const r of rules) {
            if (r.words.some((w) => n.includes(w))) return r.prio;
          }
          return rules.length;
        },
        (item) => item.tier
      )
    );
  },
  // Generic sort function
  prioritySort<T>(getPriority: (item: T) => number, getSecondary: (item: T) => number) {
    return (a: T, b: T) => {
      const pA: number = getPriority(a);
      const pB: number = getPriority(b);

      if (pA !== pB) {
        return pA - pB;
      }

      return getSecondary(b) - getSecondary(a);
    };
  },
  makeTableHeaderHtml(icon: string, total: number, title: string): string {
    const html = `
    <div class="quick-card">
    <div class="quick-header">
    <span class="icon">${icon}</span>
    <h4>${title}</h4>
    <span class="total">${total.toLocaleString()}</span>
    </div>
    <div class="quick-body">
    <table>
    `;
    return html;
  },
  // Crafting stations summary
  renderCraftingStations(data: CraftingStationsResult): void {
    log.debug('Start rendering Stations');
    const container: HTMLElement | null = document.getElementById('crafting-stations');
    if (!container) return;
    log.debug('Stations data:', data);
    data = this.removeSpecifier(data, DASHBOARD_CONFIG.SPECIFIER);
    const { active, passive } = data;
    const activeNames: string[] = Object.keys(active).sort();
    const passiveNames: string[] = Object.keys(passive).sort();
    if (activeNames.length === 0 && passiveNames.length === 0) {
      container.innerHTML = '';
      log.debug('No stations to render found (active and passive)');
      return;
    }
    log.debug(active, activeNames);
    let html = `<div><button id = "toggleStationsBtn">Show Stations</button></div>`;
    html += `<div id="station-box" class="hidden">`;
    html += this.generateMatrixHtml(active, activeNames, 'Active Crafting Stations');
    html += this.generateMatrixHtml(passive, passiveNames, 'Passive Crafting Stations');

    html += `</div>`;
    container.innerHTML = html;
    const btn = document.getElementById('toggleStationsBtn');
    const box = document.getElementById('station-box');
    if (!btn || !box) return;
    btn.addEventListener('click', () => {
      box.classList.toggle('hidden');
      btn.textContent = box.classList.contains('hidden') ? 'Show Stations' : 'Hide Stations';
    });
    this.show('crafting-stations');
  },
  removeSpecifier(data: CraftingStationsResult, specifier: string[]): CraftingStationsResult {
    const condense = (source: StationsByName): StationsByName => {
      const result: StationsByName = {};

      for (const [name, summary] of Object.entries(source)) {
        const normalizedName: string = this.normalizeStationName(name, specifier);

        if (!result[normalizedName]) {
          result[normalizedName] = {
            tiers: { ...summary.tiers },
            total: summary.total,
          };
        } else {
          result[normalizedName].tiers = this.mergeTiers(
            result[normalizedName].tiers,
            summary.tiers
          );

          result[normalizedName].total += summary.total;
        }
      }

      return result;
    };

    return {
      active: condense(data.active),
      passive: condense(data.passive),
    };
  },
  normalizeStationName(name: string, specifier: string[]): string {
    let result = name.toLowerCase();

    for (const spec of specifier) {
      const regex = new RegExp(`\\b${spec}\\b`, 'gi');
      result = result.replace(regex, '');
    }

    return result.replace(/\s+/g, ' ').trim();
  },
  mergeTiers(target: TierQuantities, source: TierQuantities): TierQuantities {
    const result: TierQuantities = { ...target };

    for (const tier of Object.keys(source) as unknown as Tier[]) {
      result[tier] = (result[tier] ?? 0) + source[tier];
    }

    return result;
  },
  generateMatrixHtml(stations: StationsByName, names: string[], title: string): string {
    if (names.length === 0) return '';

    let total = 0;
    for (const name of names) {
      total += stations[name].total;
    }

    let out = `<div class="stations-section">`;
    out += `<div class="matrix-header"><h3>${title}</h3><span class="total">${total} total</span></div>`;
    out += '<table class="material-matrix"><thead><tr>';
    out += '<th></th>';
    for (let t = 1; t <= CONFIG.MAX_TIER; t++) {
      out += `<th>T${t}</th>`;
    }
    out += '<th class="row-total">Total</th>';
    out += '</tr></thead><tbody>';

    for (const name of names) {
      const station: StationSummary = stations[name];
      out += `<tr><td class="cat-label">${name}</td>`;
      for (let t = 1; t <= CONFIG.MAX_TIER; t++) {
        const val: number = station.tiers[t as keyof TierQuantities] || 0;
        const displayVal: string = val > 0 ? String(val) : '—';
        const bgStyle: string = val > 0 ? DASHBOARD_CONFIG.BG_CONST : '';
        out += `<td class="matrix-cell" style="${bgStyle}">${displayVal}</td>`;
      }
      out += `<td class="row-total">${station.total}</td>`;
      out += '</tr>';
    }

    out += '</tbody></table></div>';
    log.debug('Finished generating matrix');
    return out;
  },
  // Inventory grid with expandable category cards
  renderInventory(inventory: ProcessedInventory, view: string): void {
    const grid: HTMLElement | null = document.getElementById(view);
    log.debug('start rendering inventory');
    if (!grid) {
      log.debug('inventory-grid not found ', view);
      return;
    }

    // Exclude Food and Scholar from main grid (shown in quick stats)
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

    // Attach event listeners after innerHTML assignment
    grid.querySelectorAll('.card-header').forEach((header) => {
      header.addEventListener('click', () => {
        const card: Element | null = header.closest('.inventory-card');
        card?.classList.toggle('expanded');
      });
    });

    this.show('inventory');
  },
  // Render Tailoring sub view
  renderTailoring(inventory: ProcessedInventory, view: string): void {
    const filteredInventory: NamedMatrix = this.filterInventory(
      DASHBOARD_CONFIG.TAILOR_ITEMS_ADDITIONAL,
      DASHBOARD_CONFIG.TAILOR_TYPES,
      inventory
    );
    const config: MatrixConfig = this.createMatrixConfig(filteredInventory);
    const el: HTMLElement | null = document.getElementById(view);
    if (!el) return;
    createDataMatrix(el, config);
  },
  // Filters so only allowedItems are kept
  filterInventory(
    additionalItems: string[],
    completeTags: string[],
    inventory: ProcessedInventory
  ): NamedMatrix {
    const additionalSet = new Set(additionalItems);
    const completeTagSet = new Set(completeTags);

    const map: ResourceMatrix = {};

    for (const category of Object.values(inventory)) {
      for (const [tag, tagGroup] of Object.entries(category)) {
        const includesTag = completeTagSet.has(tag);
        for (const item of Object.values(tagGroup.items)) {
          if (!includesTag && !additionalSet.has(item.name)) {
            continue;
          }
          // add for tag row
          if (includesTag) {
            if (!map[tag]) {
              map[tag] = Array.from({ length: CONFIG.MAX_TIER }, () => []);
            }
            const tierIndex = item.tier >= 1 ? item.tier - 1 : 0; // single items with tier -1 get set to index 0
            map[tag][tierIndex].push(item.qty);
          }
          // Add single row for additional items -> can be used to show single lines of an item
          if (additionalSet.has(item.name)) {
            if (!map[item.name]) {
              map[item.name] = Array.from({ length: CONFIG.MAX_TIER }, () => []);
            }
            const tierIndex = item.tier >= 1 ? item.tier - 1 : 0; // single items with tier -1 get set to index 0
            map[item.name][tierIndex].push(item.qty);
          }
        }
      }
    }

    return { map };
  },
  createMatrixConfig(named: NamedMatrix): MatrixConfig {
    const columns: MatrixColumn[] = Array.from({ length: CONFIG.MAX_TIER }, (_, i) => {
      const tier = i + 1;
      return { key: String(tier), label: `T${tier}` };
    });

    const rows: MatrixRow[] = Object.entries(named.map).map(([tag, tiers]) => {
      const cells = Object.fromEntries(
        tiers.map((qtyList, i) => [String(i + 1), qtyList.reduce((sum, q) => sum + q, 0)])
      ) as Record<string, number>;

      return {
        key: tag,
        label: tag,
        cells,
      };
    });

    return {
      columns,
      rows,
      showRowTotals: false,
    };
  },
};
