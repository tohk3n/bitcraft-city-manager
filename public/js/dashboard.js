// Dashboard rendering methods
// Handles: material matrix, quick stats, crafting stations, inventory grid
import { CONFIG } from './config.js';

export const DashboardUI = {
  // Main render entry point for inventory view
  renderDashboard(data) {
    const { inventory, materialMatrix, foodItems, scholarByTier } = data;

    this.renderMaterialMatrix(materialMatrix);
    this.renderQuickStats(foodItems, scholarByTier);
    this.renderInventory(inventory);

    this.show('dashboard');
  },

  // Material matrix table with heatmap
  renderMaterialMatrix(matrix) {
    const container = document.getElementById('tier-bar');
    if (!container) return;

    const categories = Object.keys(matrix);

    // Find global max for heatmap normalization
    let globalMax = 0;
    let grandTotal = 0;
    for (const cat of categories) {
      for (let t = 1; t <= 7; t++) {
        const val = matrix[cat][t] || 0;
        if (val > globalMax) globalMax = val;
        grandTotal += val;
      }
    }

    // Calculate row and column totals
    const rowTotals = {};
    const colTotals = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    for (const cat of categories) {
      rowTotals[cat] = 0;
      for (let t = 1; t <= 7; t++) {
        const val = matrix[cat][t] || 0;
        rowTotals[cat] += val;
        colTotals[t] += val;
      }
    }

    let html = '<div class="matrix-header"><h3>Raw Materials</h3><span class="total">' + grandTotal.toLocaleString() + ' total</span></div>';
    html += '<table class="material-matrix"><thead><tr>';
    html += '<th></th>';
    for (let t = 1; t <= 7; t++) {
      const label = t === 7 ? 'T7+' : `T${t}`;
      html += `<th>${label}</th>`;
    }
    html += '<th class="row-total">Total</th>';
    html += '</tr></thead><tbody>';

    for (const cat of categories) {
      // Skip rows with zero total
      if (rowTotals[cat] === 0) continue;

      html += `<tr><td class="cat-label">${cat}</td>`;
      for (let t = 1; t <= 7; t++) {
        const val = matrix[cat][t] || 0;
        const intensity = globalMax > 0 ? val / globalMax : 0;
        const bgStyle = val > 0 ? `background: rgba(88, 166, 255, ${0.1 + intensity * 0.5});` : '';
        const displayVal = val > 0 ? val.toLocaleString() : '-';
        html += `<td class="matrix-cell" style="${bgStyle}">${displayVal}</td>`;
      }
      html += `<td class="row-total">${rowTotals[cat].toLocaleString()}</td>`;
      html += '</tr>';
    }

    // Column totals row
    html += '<tr class="col-totals"><td class="cat-label">Total</td>';
    for (let t = 1; t <= 7; t++) {
      const val = colTotals[t];
      const displayVal = val > 0 ? val.toLocaleString() : '-';
      html += `<td class="matrix-cell">${displayVal}</td>`;
    }
    html += `<td class="row-total grand-total">${grandTotal.toLocaleString()}</td>`;
    html += '</tr>';

    html += '</tbody></table>';
    container.innerHTML = html;
  },

  // Food and Scholar quick stats
  renderQuickStats(foodItems, scholarByTier) {
    const container = document.getElementById('quick-stats');
    if (!container) return;

    let html = '';

    // Food section
    const foodList = Object.values(foodItems).sort((a, b) => b.qty - a.qty);
    let foodTotal = 0;
    for (const f of foodList) foodTotal += f.qty;

    if (foodTotal > 0) {
      html += `
      <div class="quick-card">
      <div class="quick-header">
      <span class="icon">🍖</span>
      <h4>Food</h4>
      <span class="total">${foodTotal.toLocaleString()}</span>
      </div>
      <div class="quick-body">
      <table>
      `;
      for (const item of foodList.slice(0, 10)) {
        const tierBadge = item.tier > 0 ? `<span class="tier-badge">T${item.tier}</span>` : '';
        html += `<tr><td>${tierBadge} ${item.name}</td><td class="qty">${item.qty.toLocaleString()}</td></tr>`;
      }
      if (foodList.length > 10) {
        html += `<tr class="more"><td colspan="2">+${foodList.length - 10} more</td></tr>`;
      }
      html += '</table></div></div>';
    }

    // Scholar section
    let scholarTotal = 0;
    for (const qty of Object.values(scholarByTier)) scholarTotal += qty;

    if (scholarTotal > 0) {
      html += `
      <div class="quick-card">
      <div class="quick-header">
      <span class="icon">📜</span>
      <h4>Scholar</h4>
      <span class="total">${scholarTotal.toLocaleString()}</span>
      </div>
      <div class="quick-body">
      <table>
      `;
      for (let t = 1; t <= 7; t++) {
        const qty = scholarByTier[t] || 0;
        if (qty > 0) {
          const label = t === 7 ? 'T7+' : `T${t}`;
          html += `<tr><td><span class="tier-badge">${label}</span> Items</td><td class="qty">${qty.toLocaleString()}</td></tr>`;
        }
      }
      html += '</table></div></div>';
    }

    container.innerHTML = html;
  },

  // Crafting stations summary
  renderCraftingStations(data) {
    const container = document.getElementById('crafting-stations');
    if (!container) return;

    const { active, passive } = data;

    const activeNames = Object.keys(active).sort();
    const passiveNames = Object.keys(passive).sort();

    if (activeNames.length === 0 && passiveNames.length === 0) {
      container.innerHTML = '';
      return;
    }

    let html = '';

    // Helper to render a station matrix
    const renderMatrix = (stations, names, title) => {
      if (names.length === 0) return '';

      let total = 0;
      for (const name of names) {
        total += stations[name].total;
      }

      let out = `<div class="stations-section">`;
      out += `<div class="matrix-header"><h3>${title}</h3><span class="total">${total} total</span></div>`;
      out += '<table class="material-matrix"><thead><tr>';
      out += '<th></th>';
      for (let t = 1; t <= 7; t++) {
        out += `<th>T${t}</th>`;
      }
      out += '<th class="row-total">Total</th>';
      out += '</tr></thead><tbody>';

      for (const name of names) {
        const station = stations[name];
        out += `<tr><td class="cat-label">${name}</td>`;
        for (let t = 1; t <= 7; t++) {
          const val = station.tiers[t] || 0;
          const displayVal = val > 0 ? val : '—';
          const bgStyle = val > 0 ? 'background: rgba(88, 166, 255, 0.2);' : '';
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
  renderInventory(inventory) {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;

    // Exclude Food and Scholar from main grid (shown in quick stats)
    const exclude = CONFIG.INVENTORY_GRID_EXCLUDE;
    const sortedCategories = Object.keys(inventory)
    .filter(c => !exclude.includes(c))
    .sort((a, b) => {
      const aIdx = CONFIG.CATEGORY_ORDER.indexOf(a);
      const bIdx = CONFIG.CATEGORY_ORDER.indexOf(b);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });

    let html = '';

    for (const category of sortedCategories) {
      const tags = inventory[category];

      let categoryTotal = 0;
      for (const tagData of Object.values(tags)) {
        categoryTotal += tagData.total;
      }

      if (categoryTotal === 0) continue;

      let tableHtml = '';
      const sortedTags = Object.keys(tags).sort();

      for (const tag of sortedTags) {
        const tagData = tags[tag];

        const items = Object.values(tagData.items).sort((a, b) => {
          if (a.tier !== b.tier) return a.tier - b.tier;
          return a.name.localeCompare(b.name);
        });

        for (const item of items) {
          const tierBadge = item.tier > 0 ? `<span class="tier-badge">T${item.tier}</span>` : '';

          let breakdownHtml = '';
          if (item.buildings.length > 1) {
            const buildingList = item.buildings
            .sort((a, b) => b.qty - a.qty)
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
        header.closest('.inventory-card').classList.toggle('expanded');
      });
    });

    this.show('inventory');
  }
};
