// Core UI utilities - base object that other modules extend
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
  },

  renderMapLinkComposer(){
    const checkboxContainer = document.getElementById("checkbox-row");
    if(!checkboxContainer){
      return;
    }
    if(checkboxContainer.querySelectorAll('input[type="checkbox"]').length > 0){
      return;
    }
    //generate label and checkbox for region selection
    for(let i = 1; i<=9; i++){
      const label = document.createElement("label");
      const checkbox = document.createElement("input")

      checkbox.type = "checkbox";
      checkbox.value = i;

      label.appendChild(checkbox);
      label.append(` R${i}`);
      checkboxContainer.appendChild(label);
    }
    //add input validation for resource and player IDs
    UI.addCommaNumberValidation('res-ids');
    UI.addCommaNumberValidation('player-ids');

    const btn = document.getElementById("lnk-gen-btn");
    btn.addEventListener("click", () => UI.generateLinkEvent());

  },
  //gets values from checkboxes and input fields to pass into function and shows the generated link
  generateLinkEvent(){

    const checkboxes = Array
    .from(document.querySelectorAll('#checkbox-row input[type="checkbox"]:checked'))
    .map(cb => cb.value);

    let resourceIdInput = document.getElementById("res-ids")?.value || '';
    let playerIdInput = document.getElementById("player-ids")?.value || '';
    //removes possible comma at the end
    resourceIdInput = UI.finalizeCommaNumberInput(resourceIdInput)
    playerIdInput = UI.finalizeCommaNumberInput(playerIdInput)
    //use function to build the link
    const generatedLink = UI.generateLink(checkboxes, resourceIdInput, playerIdInput)
    // show link in UI
    const linkEl = document.getElementById("map-link");
    linkEl.href = generatedLink;
    linkEl.textContent = generatedLink;
  },
  //generates link to bitcraft map from actual data
  generateLink(regions, resourceIds, playerIds){

    const dataMap = {};
    //fill map if values exist
    if(regions.length > 0){
      dataMap.regionId = regions.join(',');
    }
    if(resourceIds !== ''){
      dataMap.resourceId = resourceIds;
    }
    if(playerIds !== ''){
      dataMap.playerId = playerIds;
    }

    let generatedLink = 'https://bitcraftmap.com/';
    let first = true;

    //first value has ? as a prefix, following are connected by &
    for(const [key,value] of Object.entries(dataMap)){
      const prefix = first ? '?' : '&';
      generatedLink += `${prefix}${key}=${value}`;
      first = false;
    }
    return generatedLink;
  },

  addCommaNumberValidation(inputId) {
    const field = document.getElementById(inputId);
    if (!field) return;

    field.addEventListener('input', () => {
      let value = field.value;

      value = value
      .replace(/[^0-9,]/g, '')  // only numbers and commas
      .replace(/^,+/, '')       // no leading commas
      .replace(/\s*,\s*/g, ',') // no spaces around commas
      .replace(/,{2,}/g, ',');  // no duplicate commas

      field.value = value;
    });
  },
  finalizeCommaNumberInput(value) {
    return value.replace(/,+$/, '');     // no commas at the end
  }
};
