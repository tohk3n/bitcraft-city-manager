// Dashboard rendering methods
// Handles: material matrix, quick stats, crafting stations, inventory grid

import {
  BuildingBreakdown,
  CategoryInventory,
  CraftingStationsResult,
  FILTER_TYPE,
  FOOD_BUFF,
  InventoryItem,
  InventoryProcessResult,
  Item,
  Items,
  MaterialCategory,
  MaterialMatrix,
  ProcessedInventory,
  Rule,

  StationsByName,
  StationSummary, SUPPLY_CAT,
  TagGroup,
  TierQuantities
} from './types/index.js';
import {CONFIG, DASHBOARD_CONFIG} from "./configuration/index.js";
import {createLogger} from "./logger.js";
const log = createLogger('Dashboard');
export const DashboardUI = {
  // Main render entry point for inventory view
  renderDashboard(data: InventoryProcessResult): void {
    const { inventory, materialMatrix, foodItems, supplyCargo } = data;
    let foods:Items = DashboardUI.filterFridge(foodItems,DASHBOARD_CONFIG.FRIDGE,FILTER_TYPE.RARITY_RARE);
    this.renderQuickStats(foods, supplyCargo);
    this.renderMaterialMatrix(materialMatrix);
    this.renderInventory(inventory);

    this.show('dashboard');
  },
  filterFridge(food: Items, fridge: string[], filter:FILTER_TYPE): Items {
    // defines what we show in the food tab
    switch(filter){
      case FILTER_TYPE.FRIDGE:
        return Object.fromEntries(
            Object.entries(food).filter(([_, item]) =>
                fridge.includes(item.name)
            )) as Items;
      case FILTER_TYPE.RARITY_RARE:
        return Object.fromEntries(
            Object.entries(food).filter(([_, item]) =>
                  item.rarity && item.rarity>1
            )) as Items;
      default:
        return food;
    }
  },
  // Helper to show a section
  show(sectionId: string): void {
    const el:HTMLElement|null = document.getElementById(sectionId);
    if (el) el.classList.remove('hidden');
  },

  // Material matrix table with heatmap
  renderMaterialMatrix(matrix: MaterialMatrix): void {
    const container:HTMLElement|null = document.getElementById('tier-bar');
    if (!container) return;

    const categories = Object.keys(matrix) as MaterialCategory[];

    // Find global max for heatmap normalization
    let globalMax:number = 0;
    let grandTotal:number = 0;
    for (const cat of categories) {
      for (let t:number = 1; t <= CONFIG.MAX_TIER; t++) {
        const val:number = matrix[cat][t as keyof TierQuantities] || 0;
        if (val > globalMax) globalMax = val;
        grandTotal += val;
      }
    }

    // Calculate row and column totals
    const rowTotals: Record<string, number> = {};
    const colTotals: TierQuantities = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
    for (const cat of categories) {
      rowTotals[cat] = 0;
      for (let t:number = 1; t <= CONFIG.MAX_TIER; t++) {
        const tier = t as keyof TierQuantities;
        const val:number = matrix[cat][tier] || 0;
        rowTotals[cat] += val;
        colTotals[tier] += val;
      }
    }

    let html:string = '<div class="matrix-header"><h3>Raw Materials</h3><span class="total">' + grandTotal.toLocaleString() + ' total</span></div>';
    html += '<table class="material-matrix"><thead><tr>';
    html += '<th></th>';
    for (let t:number = 1; t <= CONFIG.MAX_TIER; t++) {
      const label = t === CONFIG.MAX_TIER ? 'T10' : `T${t}`;
      html += `<th>${label}</th>`;
    }
    html += '<th class="row-total">Total</th>';
    html += '</tr></thead><tbody>';

    for (const cat of categories) {
      // Skip rows with zero total
      if (rowTotals[cat] === 0) continue;

      html += `<tr><td class="cat-label">${cat}</td>`;
      for (let t:number = 1; t <= CONFIG.MAX_TIER; t++) {
        const val:number = matrix[cat][t as keyof TierQuantities] || 0;
        const intensity:number = globalMax > 0 ? val / globalMax : 0;
        const bgStyle:string = val > 0 ? `background: rgba(88, 166, 255, ${0.1 + intensity * 0.5});` : '';
        const displayVal:string = val > 0 ? val.toLocaleString() : '-';
        html += `<td class="matrix-cell" style="${bgStyle}">${displayVal}</td>`;
      }
      html += `<td class="row-total">${rowTotals[cat].toLocaleString()}</td>`;
      html += '</tr>';
    }

    // Column totals row
    html += '<tr class="col-totals"><td class="cat-label">Total</td>';
    for (let t:number = 1; t <= CONFIG.MAX_TIER; t++) {
      const val:number = colTotals[t as keyof TierQuantities];
      const displayVal:string = val > 0 ? val.toLocaleString() : '-';
      html += `<td class="matrix-cell">${displayVal}</td>`;
    }
    html += `<td class="row-total grand-total">${grandTotal.toLocaleString()}</td>`;
    html += '</tr>';

    html += '</tbody></table>';
    container.innerHTML = html;
  },

  // Food and Supply quick stats
  renderQuickStats(foodItems: Items, supplies: Items): void {
    const container:HTMLElement|null = document.getElementById('quick-stats');
    if (!container) return;

    // Food section
    const foodList:Item[] = DashboardUI.sortItems(foodItems,DASHBOARD_CONFIG.FOOD_RULE);
    //total amount
    let foodTotal:number = Object.values(foodItems).reduce((sum:number, item:Item):number => sum + (item.qty ?? 0), 0);

    let html:string = DashboardUI.generateFoodHtml(foodTotal,foodList,15);

    // Supply cargo items available
    const suppliesTotal:number = Object.values(supplies).reduce((sum:number, item:Item):number => sum + (item.qty ?? 0), 0);
    const supplyList:Item[] = DashboardUI.sortItems(supplies,[]);

    html += DashboardUI.generateSupplyHtml(suppliesTotal,supplyList,15)

    container.innerHTML = html;
  },
  generateFoodHtml(foodTotal:number,foodList:Item[],maxEntries:number){

    let html:string = DashboardUI.makeTableHeaderHtml("🍖",foodTotal,'Food');
    let lastCat:FOOD_BUFF|undefined = undefined;

    for (const item of foodList.slice(0, maxEntries)) {
      const name:string = item.name.toLowerCase();
      const cat:FOOD_BUFF = DashboardUI.getFoodBuffCategory(name);

      if(!lastCat || lastCat!==cat) {
        lastCat = cat;
        html += `<tr><td>${cat}</td><td class="cat-header"></td></tr>`;
      }
      const tierBadge:string = item.tier > 0 ? `<span class="tier-badge">T${item.tier}</span>` : '';
      html += `<tr><td>${tierBadge} ${item.name}</td><td class="qty">${item.qty.toLocaleString()}</td></tr>`;
    }
    if (foodList.length > maxEntries) {
      html += `<tr class="more"><td colspan="2">+${foodList.length - maxEntries} more</td></tr>`;
    }
    html += '</table></div></div>';
    return html;
  },
  generateSupplyHtml(suppliesTotal:number,supplyList:Item[], maxEntries:number):string{
    let html:string = DashboardUI.makeTableHeaderHtml("📦",suppliesTotal,'Supply Cargo');
    let lastCat:SUPPLY_CAT|undefined = undefined;
    for (const item of supplyList.slice(0, maxEntries)) {
      const name:string = item.name;
      const cat:SUPPLY_CAT = DashboardUI.getSupplyCategory(name);
      if(!lastCat || lastCat!== cat){
        lastCat = cat;
        html += `<tr><td>${cat}</td><td class="cat-header"></td></tr>`;
      }
      const tierBadge:string = item.tier > 0 ? `<span class="tier-badge">T${item.tier}</span>` : '';
      html += `<tr><td>${tierBadge} ${item.name}</td><td class="qty">${item.qty.toLocaleString()}</td></tr>`;
    }
    html += '</table></div></div>';
    return html;
  },
  getFoodBuffCategory(name:string):FOOD_BUFF{
    name = name.toLowerCase();
    let cat
    if(name.includes('fish')){
      cat = FOOD_BUFF.CRAFTING;
    }else if(name.includes('meat')){
      cat = FOOD_BUFF.COMBAT;
    }else if(name.includes('mushroom')||name.includes('berry')){
      cat = FOOD_BUFF.MOVEMENT;
    }else {
      cat = FOOD_BUFF.NONE;
    }
    return cat;
  },
  getSupplyCategory(name:string):SUPPLY_CAT{
    name = name.toLowerCase();
    let cat
    if(name.includes('timber')){
      cat = SUPPLY_CAT.TIMBER;
    }else if (name.includes('frame')){
      cat = SUPPLY_CAT.FRAMES;
    }else if (name.includes('tarp')){
      cat = SUPPLY_CAT.TARP;
    }else if (name.includes('sack')){
      cat = SUPPLY_CAT.HEX;
    }else if (name.includes('slab')){
      cat = SUPPLY_CAT.SLAB;
    }else if(name.includes('sheeting')){
      cat = SUPPLY_CAT.LEATHER;
    }else if(name.includes('experimental')){
      cat = SUPPLY_CAT.SCHOLAR;
    }else{
      cat = SUPPLY_CAT.NONE;
    }
    return cat;
  },
  sortItems(items:Items,rules:Rule[]):Item[]{
    return Object.values(items).sort(
        DashboardUI.prioritySort(
            item => {
              const n:string = item.name.toLowerCase();
              for (const r of rules) {
                if (r.words.some(w => n.includes(w))) return r.prio;
              }
              return rules.length;
            },
            item => item.tier
        )
    );
  },
  // Generic sort function
  prioritySort<T>(
      getPriority: (item: T) => number,
      getSecondary: (item: T) => number
  ) {
    return (a: T, b: T) => {
      const pA:number = getPriority(a);
      const pB:number = getPriority(b);

      if (pA !== pB) {
        return pA - pB;
      }

      return getSecondary(b) - getSecondary(a);
    };
  },
  makeTableHeaderHtml(icon:string,total:number,title:string):string{
    let html:string = `
    <div class="quick-card">
    <div class="quick-header">
    <span class="icon">${icon}</span>
    <h4>${title}</h4>
    <span class="total">${total.toLocaleString()}</span>
    </div>
    <div class="quick-body">
    <table>
    `;
    return html
  },
  // Crafting stations summary
  renderCraftingStations(data: CraftingStationsResult): void {
    const container:HTMLElement|null = document.getElementById('crafting-stations');
    if (!container) return;

    const { active, passive } = data;

    const activeNames:string[] = Object.keys(active).sort();
    const passiveNames:string[] = Object.keys(passive).sort();

    if (activeNames.length === 0 && passiveNames.length === 0) {
      container.innerHTML = '';
      return;
    }

    let html:string = '';

    // Helper to render a station matrix
    const renderMatrix = (stations: StationsByName, names: string[], title: string): string => {
      if (names.length === 0) return '';

      let total:number = 0;
      for (const name of names) {
        total += stations[name].total;
      }

      let out:string = `<div class="stations-section">`;
      out += `<div class="matrix-header"><h3>${title}</h3><span class="total">${total} total</span></div>`;
      out += '<table class="material-matrix"><thead><tr>';
      out += '<th></th>';
      for (let t:number = 1; t <= CONFIG.MAX_TIER; t++) {
        out += `<th>T${t}</th>`;
      }
      out += '<th class="row-total">Total</th>';
      out += '</tr></thead><tbody>';

      for (const name of names) {
        const station:StationSummary = stations[name];
        out += `<tr><td class="cat-label">${name}</td>`;
        for (let t:number = 1; t <= CONFIG.MAX_TIER; t++) {
          const val:number = station.tiers[t as keyof TierQuantities] || 0;
          const displayVal:string = val > 0 ? String(val) : '—';
          const bgStyle:string = val > 0 ? DASHBOARD_CONFIG.BG_CONST : '';
          out += `<td class="matrix-cell" style="${bgStyle}">${displayVal}</td>`;
        }
        out += `<td class="row-total">${station.total}</td>`;
        out += '</tr>';
      }

      out += '</tbody></table></div>';
      return out;
    };

    html += renderMatrix(active, activeNames, 'Active Crafting Stations');
    html += renderMatrix(passive, passiveNames, 'Passive Crafting Stations');

    container.innerHTML = html;
    this.show('crafting-stations');
  },

  // Inventory grid with expandable category cards
  renderInventory(inventory: ProcessedInventory): void {
    const grid:HTMLElement|null = document.getElementById('inventory-grid');
    if (!grid) return;

    // Exclude Food and Scholar from main grid (shown in quick stats)
    const exclude:string[] = DASHBOARD_CONFIG.INVENTORY_GRID_EXCLUDE;
    const sortedCategories:string[] = Object.keys(inventory)
    .filter(c => !exclude.includes(c))
    .sort((a, b):number => {
      const aIdx:number = DASHBOARD_CONFIG.CATEGORY_ORDER.indexOf(a);
      const bIdx:number = DASHBOARD_CONFIG.CATEGORY_ORDER.indexOf(b);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });

    let html:string = '';

    for (const category of sortedCategories) {
      const tags:CategoryInventory = inventory[category];

      let categoryTotal:number = 0;
      for (const tagData of Object.values(tags) as TagGroup[]) {
        categoryTotal += tagData.total;
      }

      if (categoryTotal === 0) continue;

      let tableHtml:string = '';
      const sortedTags:string[] = Object.keys(tags).sort();

      for (const tag of sortedTags) {
        const tagData:TagGroup = tags[tag];

        const items:InventoryItem[] = (Object.values(tagData.items) as InventoryItem[]).sort((a, b) => {
          if (a.tier !== b.tier) return a.tier - b.tier;
          return a.name.localeCompare(b.name);
        });

        for (const item of items) {
          const tierBadge:string = item.tier > 0 ? `<span class="tier-badge">T${item.tier}</span>` : '';

          let breakdownHtml:string = '';
          if (item.buildings.length > 1) {
            const buildingList:string = [...item.buildings]
            .sort((a:BuildingBreakdown, b:BuildingBreakdown):number => b.qty - a.qty)
            .map(b => `<li>${b.name}: ${b.qty.toLocaleString()}</li>`)
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
    grid.querySelectorAll('.card-header').forEach(header => {
      header.addEventListener('click', () => {
        const card:Element|null = header.closest('.inventory-card');
        card?.classList.toggle('expanded');
      });
    });

    this.show('inventory');
  }
};
