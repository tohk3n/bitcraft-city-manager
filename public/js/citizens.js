// Citizens view rendering - extends UI object
// Handles: citizen table, equipment display, vault loading

Object.assign(UI, {
  // Internal state for citizens module
  _citizensData: null,
  _vaultCache: {},

  // Render citizens table with equipment matrix
  renderCitizens(data) {
    const grid = document.getElementById('citizens-grid');
    if (!grid) return;

    this._citizensData = data;
    const citizens = data.citizens || [];

    if (citizens.length === 0) {
      grid.innerHTML = '<p class="empty-state">No citizens found for this claim.</p>';
      return;
    }

    // Equipment slot order - from config
    const slots = CONFIG.EQUIPMENT_SLOTS;
    const slotNames = CONFIG.SLOT_DISPLAY_NAMES;
    const gearTypes = CONFIG.GEAR_TYPES;
    const gearTypeShort = gearTypes.map(g => g.split(' ')[0]);

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
            html += `<td id="${cellId}" class="gear-cell empty loading" data-equipped="false" data-tier="0">-</td>`;
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

  // Update a single citizen's equipment cells (for progressive loading)
  updateCitizenEquipment(playerId, equipment) {
    const slots = CONFIG.EQUIPMENT_SLOTS;
    const gearTypes = CONFIG.GEAR_TYPES;

    for (const gearType of gearTypes) {
      const gearKey = gearType.split(' ')[0].toLowerCase();

      for (const slot of slots) {
        const cellId = `cell-${playerId}-${gearKey}-${slot}`;
        const cell = document.getElementById(cellId);
        if (!cell) continue;

        // Always remove loading class
        cell.classList.remove('loading');

        const equipped = equipment.find(e =>
        e.primary === slot && e.item?.tags === gearType
        );

        if (equipped && equipped.item) {
          const tier = equipped.item.tier || 0;
          const rarity = (equipped.item.rarityString || '').toLowerCase();
          const rarityClass = rarity ? `rarity-${rarity}` : '';
          cell.className = `gear-cell ${rarityClass}`;
          cell.textContent = `T${tier}`;
          cell.title = equipped.item.name;
          cell.dataset.equipped = 'true';
          cell.dataset.tier = tier;
        }
      }
    }
  },

  // Load vault gear for a player
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

  // Parse vault collectibles into gear items
  _parseVaultCollectibles(data) {
    const collectibles = data.collectibles || [];

    // Filter to just clothing/armor items with valid tiers
    const validTypes = Object.values(CONFIG.SLOT_TYPE_CODES);
    const clothingTags = CONFIG.CLOTHING_TAGS;

    const filtered = collectibles.filter(item => {
      return validTypes.includes(item.type) &&
      clothingTags.includes(item.tag) &&
      item.tier && item.tier > 0;
    });

    return filtered;
  },

  // Fill in vault gear that's better than equipped
  _fillVaultGear(playerId, vaultItems) {
    const slots = CONFIG.EQUIPMENT_SLOTS;
    const gearTypes = CONFIG.GEAR_TYPES;

    for (const gearType of gearTypes) {
      const gearKey = gearType.split(' ')[0].toLowerCase();

      for (const slot of slots) {
        const cellId = `cell-${playerId}-${gearKey}-${slot}`;
        const cell = document.getElementById(cellId);

        if (!cell) continue;

        const currentTier = parseInt(cell.dataset.tier) || 0;
        const bestVaultItem = this._getBestVaultItem(vaultItems, slot, gearType);

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

  // Find best vault item for a given slot and gear type
  _getBestVaultItem(vaultItems, slot, gearType) {
    const targetType = CONFIG.SLOT_TYPE_CODES[slot];

    // Match tag - vault uses both "X Clothing" and "X Armor" patterns
    const gearBase = gearType.split(' ')[0]; // "Cloth", "Leather", "Metal"
    const possibleTags = [`${gearBase} Clothing`, `${gearBase} Armor`];

    // Filter items that match the gear type and slot type
    const matches = vaultItems.filter(item => {
      return item.type === targetType && possibleTags.includes(item.tag);
    });

    if (matches.length === 0) return null;

    // Sort by tier desc, then rarity
    matches.sort((a, b) => {
      const tierDiff = (b.tier || 0) - (a.tier || 0);
      if (tierDiff !== 0) return tierDiff;
      const aRarity = CONFIG.RARITY_ORDER.indexOf((a.rarityStr || '').toLowerCase());
      const bRarity = CONFIG.RARITY_ORDER.indexOf((b.rarityStr || '').toLowerCase());
      return bRarity - aRarity;
    });

    return matches[0];
  }
});
