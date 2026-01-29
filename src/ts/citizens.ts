// Citizens view rendering
// Handles: citizen table, equipment display, vault loading
import { API } from './api.js';
import type {
  ClaimCitizensResponse,
  EquipmentSlot,
  VaultCollectible,
  EquipmentSlotName,
  GearType,
  VaultCache, Citizen, PlayerVaultResponse
} from './types/index.js';
import {CITIZEN_CONFIG} from "./configuration/citizenconfig";

// Internal state for citizens module
let _citizensData: ClaimCitizensResponse | null = null;
const _vaultCache: VaultCache = {};

export const CitizensUI = {
  // Render citizens table with equipment matrix
  renderCitizens(data: ClaimCitizensResponse): void {
    const grid:HTMLElement|null = document.getElementById('citizens-grid');
    if (!grid) return;

    _citizensData = data;
    const citizens:Citizen[] = data.citizens || [];

    if (citizens.length === 0) {
      grid.innerHTML = '<p class="empty-state">No citizens found for this claim.</p>';
      return;
    }

    // Equipment slot order - from config
    const slots:string[] = CITIZEN_CONFIG.EQUIPMENT_SLOTS;
    const slotNames:string[] = CITIZEN_CONFIG.SLOT_DISPLAY_NAMES;
    const gearTypes:string[] = CITIZEN_CONFIG.GEAR_TYPES;
    const gearTypeShort:string[] = gearTypes.map(g => g.split(' ')[0]);

    let html:string = '<table class="citizens-table"><thead><tr>';
    html += '<th></th><th>Name</th><th>ID</th>';
    gearTypeShort.forEach(type => {
      html += `<th colspan="6">${type}</th>`;
    });
    html += '</tr><tr><th></th><th></th><th></th>';
    for (let i:number = 0; i < 3; i++) {
      slotNames.forEach(name => {
        html += `<th class="slot-header">${name.charAt(0)}</th>`;
      });
    }
    html += '</tr></thead><tbody>';

    for (const citizen of citizens) {
      const odataId:string = citizen.entityId;

      html += `<tr data-player-id="${odataId}">`;
      html += `<td class="vault-btn-cell"><button class="vault-btn" data-player-id="${odataId}" title="Load vault gear">+</button></td>`;
      html += `<td class="citizen-name">${citizen.userName || 'Unknown'}</td>`;
      html += `<td class="citizen-id"><button class="copy-btn" data-id="${odataId}" title="Copy ID">${odataId}</button></td>`;

      // For each gear type
      for (const gearType of gearTypes) {
        // For each slot
        for (const slot of slots) {
          const equipped:EquipmentSlot|undefined = citizen.equipment.find(e =>
          e.primary === slot && e.item?.tags === gearType
          );

          const cellId = `cell-${odataId}-${gearType.split(' ')[0].toLowerCase()}-${slot}`;

          if (equipped && equipped.item) {
            const tier:number = equipped.item.tier || 0;
            const rarity:string = (equipped.item.rarityString || '').toLowerCase();
            const rarityClass:string = rarity ? `rarity-${rarity}` : '';
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
    grid.querySelectorAll<HTMLButtonElement>('.vault-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._loadPlayerVault(btn.dataset.playerId || '', btn);
      });
    });

    // Add copy handlers
    grid.querySelectorAll<HTMLButtonElement>('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyToClipboard(btn.dataset.id || '', btn);
      });
    });
  },

  // Update a single citizen's equipment cells (for progressive loading)
  updateCitizenEquipment(playerId: string, equipment: EquipmentSlot[]): void {
    const slots:string[] = CITIZEN_CONFIG.EQUIPMENT_SLOTS;
    const gearTypes:string[] = CITIZEN_CONFIG.GEAR_TYPES;

    for (const gearType of gearTypes) {
      const gearKey:string = gearType.split(' ')[0].toLowerCase();

      for (const slot of slots) {
        const cellId = `cell-${playerId}-${gearKey}-${slot}`;
        const cell:HTMLElement|null = document.getElementById(cellId);
        if (!cell) continue;

        // Always remove loading class
        cell.classList.remove('loading');

        const equipped:EquipmentSlot|undefined = equipment.find(e =>
        e.primary === slot && e.item?.tags === gearType
        );

        if (equipped && equipped.item) {
          const tier:number = equipped.item.tier || 0;
          const rarity:string = (equipped.item.rarityString || '').toLowerCase();
          const rarityClass:string = rarity ? `rarity-${rarity}` : '';
          cell.className = `gear-cell ${rarityClass}`;
          cell.textContent = `T${tier}`;
          cell.title = equipped.item.name;
          cell.dataset.equipped = 'true';
          cell.dataset.tier = String(tier);
        }
      }
    }
  },

  // Load vault gear for a player
  async _loadPlayerVault(playerId: string, btn: HTMLButtonElement): Promise<void> {
    // Don't reload if already loaded
    if (_vaultCache[playerId]) {
      btn.textContent = 'ok';
      btn.disabled = true;
      return;
    }

    btn.textContent = '...';
    btn.disabled = true;

    try {
      const data:PlayerVaultResponse = await API.getPlayerVault(playerId);
      const items:VaultCollectible[] = this._parseVaultCollectibles(data);
      _vaultCache[playerId] = items;

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
  _parseVaultCollectibles(data: { collectibles?: VaultCollectible[] }): VaultCollectible[] {
    const collectibles:VaultCollectible[] = data.collectibles || [];

    // Filter to just clothing/armor items with valid tiers
    const validTypes:number[] = Object.values(CITIZEN_CONFIG.SLOT_TYPE_CODES);
    const clothingTags:string[] = CITIZEN_CONFIG.CLOTHING_TAGS;

    const filtered:VaultCollectible[] = collectibles.filter(item => {
      return validTypes.includes(item.type) &&
      clothingTags.includes(item.tag) &&
      item.tier && item.tier > 0;
    });

    return filtered;
  },

  // Fill in vault gear that's better than equipped
  _fillVaultGear(playerId: string, vaultItems: VaultCollectible[]): void {
    const slots = CITIZEN_CONFIG.EQUIPMENT_SLOTS as EquipmentSlotName[];
    const gearTypes = CITIZEN_CONFIG.GEAR_TYPES as GearType[];

    for (const gearType of gearTypes) {
      const gearKey:string = gearType.split(' ')[0].toLowerCase();

      for (const slot of slots) {
        const cellId = `cell-${playerId}-${gearKey}-${slot}`;
        const cell:HTMLElement|null = document.getElementById(cellId);

        if (!cell) continue;

        const currentTier:number = parseInt(cell.dataset.tier || '0', 10);
        const bestVaultItem:VaultCollectible|null = this._getBestVaultItem(vaultItems, slot, gearType);

        if (bestVaultItem && bestVaultItem.tier > currentTier) {
          const rarity:string = (bestVaultItem.rarityStr || '').toLowerCase();
          const rarityClass:string = rarity ? `rarity-${rarity}` : '';

          // Update cell with vault item (add 'from-vault' class to distinguish)
          cell.className = `gear-cell from-vault ${rarityClass}`;
          cell.textContent = `T${bestVaultItem.tier}`;
          cell.title = `${bestVaultItem.name} (in vault)`;
          cell.dataset.tier = String(bestVaultItem.tier);
        }
      }
    }
  },

  // Find best vault item for a given slot and gear type
  _getBestVaultItem(
    vaultItems: VaultCollectible[],
    slot: EquipmentSlotName,
    gearType: GearType
  ): VaultCollectible | null {
    const targetType:number = CITIZEN_CONFIG.SLOT_TYPE_CODES[slot];

    // Match tag - vault uses both "X Clothing" and "X Armor" patterns
    const gearBase:string = gearType.split(' ')[0]; // "Cloth", "Leather", "Metal"
    const possibleTags:string[] = [`${gearBase} Clothing`, `${gearBase} Armor`];

    // Filter items that match the gear type and slot type
    const matches:VaultCollectible[] = vaultItems.filter(item => {
      return item.type === targetType && possibleTags.includes(item.tag);
    });

    if (matches.length === 0) return null;

    // Sort by tier desc, then rarity
    matches.sort((a, b) => {
      const tierDiff = (b.tier || 0) - (a.tier || 0);
      if (tierDiff !== 0) return tierDiff;
      const aRarity:number = CITIZEN_CONFIG.RARITY_ORDER.indexOf((a.rarityStr || '').toLowerCase() as any);
      const bRarity:number = CITIZEN_CONFIG.RARITY_ORDER.indexOf((b.rarityStr || '').toLowerCase() as any);
      return bRarity - aRarity;
    });

    return matches[0];
  },

  // Copy text to clipboard with visual feedback
  copyToClipboard(text: string, btn: HTMLButtonElement): void {
    navigator.clipboard.writeText(text).then(() => {
      const original = btn.textContent;
      btn.textContent = '✔';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 1500);
    });
  }
};
