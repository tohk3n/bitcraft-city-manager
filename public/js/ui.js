// UI rendering functions
const UI = {
  show(id) {
    document.getElementById(id)?.classList.remove('hidden');
  },

  hide(id) {
    document.getElementById(id)?.classList.add('hidden');
  },

  showError(message) {
    document.getElementById('error-message').textContent = message;
    this.show('error');
  },

  clearError() {
    this.hide('error');
  },

  setClaimName(name) {
    document.getElementById('claim-name').textContent = name;
    this.show('claim-info');
  },

  renderClaimHeader(claimInfo) {
    const container = document.getElementById('claim-header');
    if (!container || !claimInfo || !claimInfo.claim) {
      return;
    }

    const c = claimInfo.claim;

    // Calculate supplies percentage and time remaining
    const suppliesPercent = c.suppliesPurchaseThreshold > 0
    ? Math.min(100, (c.supplies / c.suppliesPurchaseThreshold) * 100)
    : 0;

    let suppliesTimeStr = '';
    if (c.suppliesRunOut) {
      const runOutDate = new Date(c.suppliesRunOut);
      const now = new Date();
      const diffMs = runOutDate - now;

      if (diffMs > 0) {
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days > 0) {
          suppliesTimeStr = `${days}d ${hours}h remaining`;
        } else {
          suppliesTimeStr = `${hours}h remaining`;
        }
      } else {
        suppliesTimeStr = 'Depleted';
      }
    }

    // Supplies bar color based on percentage
    let suppliesColor = 'var(--success)';
    if (suppliesPercent < 25) {
      suppliesColor = '#f85149';
    } else if (suppliesPercent < 50) {
      suppliesColor = 'var(--warning)';
    }

    const html = `
    <div class="claim-header-content">
    <div class="claim-title">
    <h2>${c.name || 'Unknown Settlement'}</h2>
    <span class="tier-badge tier-${c.tier || 1}">T${c.tier || 1}</span>
    <span class="region-badge">${c.regionName || 'Unknown'}</span>
    </div>
    <div class="claim-stats">
    <div class="claim-stat">
    <div class="stat-label">Supplies</div>
    <div class="stat-value">${(c.supplies || 0).toLocaleString()}</div>
    <div class="supplies-bar">
    <div class="supplies-fill" style="width: ${suppliesPercent}%; background: ${suppliesColor};"></div>
    </div>
    <div class="stat-sub">${suppliesTimeStr}</div>
    </div>
    <div class="claim-stat">
    <div class="stat-label">Treasury</div>
    <div class="stat-value">${parseInt(c.treasury || 0).toLocaleString()}</div>
    </div>
    <div class="claim-stat">
    <div class="stat-label">Tiles</div>
    <div class="stat-value">${(c.numTiles || 0).toLocaleString()}</div>
    </div>
    <div class="claim-stat">
    <div class="stat-label">Upkeep</div>
    <div class="stat-value">${(c.upkeepCost || 0).toFixed(1)}/h</div>
    </div>
    </div>
    </div>
    `;

    container.innerHTML = html;
    this.show('claim-header');
  },

  setLoading(isLoading) {
    const btn = document.getElementById('load-btn');
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Loading...' : 'Load';
  },

  showTabs() {
    this.show('view-tabs');
    // Reset to inventory view
    document.querySelectorAll('#view-tabs .tab-btn').forEach(t => t.classList.remove('active'));
    document.querySelector('#view-tabs .tab-btn[data-view="inventory"]').classList.add('active');
    document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
    document.getElementById('view-inventory').classList.remove('hidden');
  },

  showCitizensLoading(show) {
    if (show) {
      this.show('citizens-loading');
    } else {
      this.hide('citizens-loading');
    }
  },

  // Main render entry point
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
        const displayVal = val > 0 ? val.toLocaleString() : '—';
        html += `<td class="matrix-cell" style="${bgStyle}">${displayVal}</td>`;
      }
      html += `<td class="row-total">${rowTotals[cat].toLocaleString()}</td>`;
      html += '</tr>';
    }

    // Column totals row
    html += '<tr class="col-totals"><td class="cat-label">Total</td>';
    for (let t = 1; t <= 7; t++) {
      const val = colTotals[t];
      const displayVal = val > 0 ? val.toLocaleString() : '—';
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
      <span class="icon">●</span>
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
      <span class="icon">●</span>
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

  // Detailed inventory cards
  renderInventory(inventory) {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Exclude Food and Scholar from main grid (shown in quick stats)
    const exclude = ['Food', 'Scholar'];
    const categoryOrder = ['Wood', 'Metal', 'Stone', 'Cloth', 'Farming', 'Fishing', 'Leather', 'Packages', 'Gems', 'Tools', 'Other'];

    const sortedCategories = Object.keys(inventory)
    .filter(c => !exclude.includes(c))
    .sort((a, b) => {
      const aIdx = categoryOrder.indexOf(a);
      const bIdx = categoryOrder.indexOf(b);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });

    for (const category of sortedCategories) {
      const tags = inventory[category];

      let categoryTotal = 0;
      for (const tagData of Object.values(tags)) {
        categoryTotal += tagData.total;
      }

      if (categoryTotal === 0) continue;

      const card = document.createElement('div');
      card.className = 'inventory-card';

      const header = document.createElement('div');
      header.className = 'card-header';
      header.innerHTML = `
      <h4>${category}</h4>
      <span class="total">${categoryTotal.toLocaleString()}</span>
      <span class="chevron">▼</span>
      `;
      header.addEventListener('click', () => card.classList.toggle('expanded'));

      const body = document.createElement('div');
      body.className = 'card-body';

      let tableHtml = '<table>';

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

      tableHtml += '</table>';
      body.innerHTML = tableHtml;

      card.appendChild(header);
      card.appendChild(body);
      grid.appendChild(card);
    }

    this.show('inventory');
  },

  // Citizens view - show members with equipment summary
  renderCitizens(data) {
    const grid = document.getElementById('citizens-grid');
    if (!grid) return;

    this._citizensData = data;
    const citizens = data.citizens || [];

    if (citizens.length === 0) {
      grid.innerHTML = '<p class="empty-state">No citizens found for this claim.</p>';
      return;
    }

    // Equipment slot order
    const slots = ['head_clothing', 'torso_clothing', 'hand_clothing', 'belt_clothing', 'leg_clothing', 'feet_clothing'];
    const slotNames = ['Head', 'Chest', 'Hands', 'Belt', 'Legs', 'Feet'];
    const gearTypes = ['Cloth Clothing', 'Leather Clothing', 'Metal Clothing'];
    const gearTypeShort = ['Cloth', 'Leather', 'Metal'];

    let html = '<table class="citizens-table"><thead><tr>';
    html += '<th></th><th>Name</th><th>ID</th>';
    gearTypeShort.forEach(type => {
      html += `<th colspan="6">${type}</th>`;
    });
    html += '</tr><tr><th></th><th></th><th></th>';
    for (let i = 0; i < 3; i++) {
      slotNames.forEach(name => {
        html += `<th class="slot-header">${name.charAt(0)}</th>`;
      });
    }
    html += '</tr></thead><tbody>';

    for (const citizen of citizens) {
      const odataId = citizen.entityId;

      html += `<tr data-player-id="${odataId}">`;
      html += `<td class="vault-btn-cell"><button class="vault-btn" data-player-id="${odataId}" title="Load vault gear">+</button></td>`;
      html += `<td class="citizen-name">${citizen.userName || 'Unknown'}</td>`;
      html += `<td class="citizen-id"><button class="copy-btn" data-id="${odataId}" title="Copy ID">${odataId}</button></td>`;

      // For each gear type
      for (const gearType of gearTypes) {
        // For each slot
        for (const slot of slots) {
          const equipped = citizen.equipment.find(e =>
          e.primary === slot && e.item?.tags === gearType
          );

          const cellId = `cell-${odataId}-${gearType.split(' ')[0].toLowerCase()}-${slot}`;

          if (equipped && equipped.item) {
            const tier = equipped.item.tier || 0;
            const rarity = (equipped.item.rarityString || '').toLowerCase();
            const rarityClass = rarity ? `rarity-${rarity}` : '';
            html += `<td id="${cellId}" class="gear-cell ${rarityClass}" title="${equipped.item.name}" data-equipped="true" data-tier="${tier}">T${tier}</td>`;
          } else {
            html += `<td id="${cellId}" class="gear-cell empty" data-equipped="false" data-tier="0">-</td>`;
          }
        }
      }

      html += '</tr>';
    }

    html += '</tbody></table>';
    grid.innerHTML = html;

    // Add vault load handlers
    grid.querySelectorAll('.vault-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._loadPlayerVault(btn.dataset.playerId, btn);
      });
    });

    // Add copy handlers
    grid.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyToClipboard(btn.dataset.id, btn);
      });
    });
  },

  _vaultCache: {},

  async _loadPlayerVault(playerId, btn) {
    // Don't reload if already loaded
    if (this._vaultCache[playerId]) {
      btn.textContent = 'ok';
      btn.disabled = true;
      return;
    }

    btn.textContent = '...';
    btn.disabled = true;

    try {
      const data = await API.getPlayerVault(playerId);
      const items = this._parseVaultCollectibles(data);
      this._vaultCache[playerId] = items;

      this._fillVaultGear(playerId, items);
      btn.textContent = 'ok';
      btn.classList.add('loaded');
    } catch (err) {
      console.error(`Failed to load vault for ${playerId}:`, err);
      btn.textContent = '!';
      btn.classList.add('error');
      btn.disabled = false;
    }
  },

  _parseVaultCollectibles(data) {
    const collectibles = data.collectibles || [];

    // Filter to just clothing/armor items with valid tiers
    // type field: 8=head, 9=belt, 10=torso, 11=hands, 12=legs, 13=feet
    const validTypes = [8, 9, 10, 11, 12, 13];
    const clothingTags = ['Cloth Clothing', 'Leather Clothing', 'Metal Clothing',
    'Cloth Armor', 'Leather Armor', 'Metal Armor'];

    const filtered = collectibles.filter(item => {
      return validTypes.includes(item.type) &&
      clothingTags.includes(item.tag) &&
      item.tier && item.tier > 0;
    });

    console.log('Vault collectibles filtered:', filtered.length, 'gear items');
    return filtered;
  },

  _fillVaultGear(playerId, vaultItems) {
    const slots = ['head_clothing', 'torso_clothing', 'hand_clothing', 'belt_clothing', 'leg_clothing', 'feet_clothing'];
    const gearTypes = ['Cloth Clothing', 'Leather Clothing', 'Metal Clothing'];

    console.log('Vault gear items:', vaultItems);

    for (const gearType of gearTypes) {
      const gearKey = gearType.split(' ')[0].toLowerCase();

      for (const slot of slots) {
        const cellId = `cell-${playerId}-${gearKey}-${slot}`;
        const cell = document.getElementById(cellId);

        if (!cell) continue;

        const currentTier = parseInt(cell.dataset.tier) || 0;
        const bestVaultItem = this._getBestVaultItem(vaultItems, slot, gearType);

        if (bestVaultItem) {
          console.log(`Found vault item for ${gearType} ${slot}:`, bestVaultItem.name, 'T' + bestVaultItem.tier);
        }

        if (bestVaultItem && bestVaultItem.tier > currentTier) {
          const rarity = (bestVaultItem.rarityStr || '').toLowerCase();
          const rarityClass = rarity ? `rarity-${rarity}` : '';

          // Update cell with vault item (add 'from-vault' class to distinguish)
          cell.className = `gear-cell from-vault ${rarityClass}`;
          cell.textContent = `T${bestVaultItem.tier}`;
          cell.title = `${bestVaultItem.name} (in vault)`;
          cell.dataset.tier = bestVaultItem.tier;
        }
      }
    }
  },

  _getBestVaultItem(vaultItems, slot, gearType) {
    // Map our slot names to the vault's type field
    // type: 8=head, 9=belt, 10=torso, 11=hands, 12=legs, 13=feet
    const slotToType = {
      'head_clothing': 8,
      'torso_clothing': 10,
      'hand_clothing': 11,
      'belt_clothing': 9,
      'leg_clothing': 12,
      'feet_clothing': 13
    };

    const targetType = slotToType[slot];

    // Match tag - vault uses both "X Clothing" and "X Armor" patterns
    const gearBase = gearType.split(' ')[0]; // "Cloth", "Leather", "Metal"
    const possibleTags = [`${gearBase} Clothing`, `${gearBase} Armor`];

    // Filter items that match the gear type and slot type
    const matches = vaultItems.filter(item => {
      return item.type === targetType && possibleTags.includes(item.tag);
    });

    if (matches.length === 0) return null;

    // Sort by tier desc, then rarity
    const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    matches.sort((a, b) => {
      const tierDiff = (b.tier || 0) - (a.tier || 0);
      if (tierDiff !== 0) return tierDiff;
      const aRarity = rarityOrder.indexOf((a.rarityStr || '').toLowerCase());
      const bRarity = rarityOrder.indexOf((b.rarityStr || '').toLowerCase());
      return bRarity - aRarity;
    });

    return matches[0];
  },

  // ID Lookup view
  renderIdList(type, items, citizensData) {
    const list = document.getElementById('ids-list');
    if (!list) return;

    let html = '<table class="ids-table"><thead><tr><th>Name</th><th>ID</th></tr></thead><tbody>';

    if (type === 'citizens') {
      const citizens = citizensData?.citizens || [];
      if (citizens.length === 0) {
        list.innerHTML = '<p class="empty-state">Load a claim first to see citizens.</p>';
        return;
      }

      for (const c of citizens.sort((a, b) => (a.userName || '').localeCompare(b.userName || ''))) {
        html += `<tr data-name="${(c.userName || '').toLowerCase()}">
        <td>${c.userName || 'Unknown'}</td>
        <td><button class="copy-btn" data-id="${c.entityId}">${c.entityId}</button></td>
        </tr>`;
      }
    } else if (type === 'items') {
      if (!items || items.length === 0) {
        list.innerHTML = '<p class="empty-state">Loading items...</p>';
        return;
      }

      for (const item of items.sort((a, b) => a.name.localeCompare(b.name))) {
        const tierBadge = item.tier > 0 ? `<span class="tier-badge">T${item.tier}</span> ` : '';
        html += `<tr data-name="${item.name.toLowerCase()}">
        <td>${tierBadge}${item.name}</td>
        <td><button class="copy-btn" data-id="${item.id}">${item.id}</button></td>
        </tr>`;
      }
    }

    html += '</tbody></table>';
    list.innerHTML = html;

    // Add copy handlers
    list.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => this.copyToClipboard(btn.dataset.id, btn));
    });
  },

  filterIdList(filter, type) {
    const rows = document.querySelectorAll('#ids-list tbody tr');
    const lowerFilter = filter.toLowerCase();

    rows.forEach(row => {
      const name = row.dataset.name || '';
      if (name.includes(lowerFilter)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  },

  copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 1500);
    }).catch(err => {
      console.error('Copy failed:', err);
    });
  }
};
