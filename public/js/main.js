// Main entry point
(function () {
  const input = document.getElementById('claim-id');
  const loadBtn = document.getElementById('load-btn');

  // Store loaded data for switching views
  let claimData = {
    claimId: null,
    claimInfo: null,
    inventories: null,
    citizens: null,
    items: null
  };

  async function loadClaim() {
    const claimId = input.value.trim();

    if (!claimId || !/^\d+$/.test(claimId)) {
      UI.showError('Please enter a valid claim ID (numbers only)');
      return;
    }

    UI.clearError();
    UI.setLoading(true);

    try {
      // Load inventories (includes item metadata)
      const data = await API.getClaimInventories(claimId);
      claimData.claimId = claimId;
      claimData.inventories = data;

      // Try to get claim name and details
      let claimName = `Claim ${claimId}`;
      let hasClaimHeader = false;
      try {
        const claimInfo = await API.getClaim(claimId);
        claimData.claimInfo = claimInfo;
        if (claimInfo.claim && claimInfo.claim.name) {
          claimName = claimInfo.claim.name;
          UI.renderClaimHeader(claimInfo);
          hasClaimHeader = true;
        }
      } catch (e) {
        // Claim endpoint might not exist, continue with default name
        console.log('Could not fetch claim details:', e);
      }

      // Only show simple name if header failed
      if (!hasClaimHeader) {
        UI.setClaimName(claimName);
      }
      UI.showTabs();

      // Process and render inventory view
      const result = processInventory(data);
      UI.renderDashboard(result);

      // Load and render crafting stations
      try {
        const buildingsData = await API.getClaimBuildings(claimId);
        claimData.buildings = buildingsData;
        const stations = processCraftingStations(buildingsData);
        UI.renderCraftingStations(stations);
      } catch (e) {
        console.log('Could not fetch buildings:', e);
      }

      // Save to URL for sharing
      history.replaceState(null, '', `?claim=${claimId}`);

    } catch (err) {
      console.error(err);
      UI.showError('Failed to load claim data. Check the ID and try again.');
    } finally {
      UI.setLoading(false);
    }
  }

  // Load citizens data (lazy loaded when tab clicked)
  async function loadCitizens() {
    if (!claimData.claimId) return;

    // Return cached if available
    if (claimData.citizens) {
      UI.renderCitizens(claimData.citizens);
      return;
    }

    UI.showCitizensLoading(true);

    try {
      const citizensData = await API.getClaimCitizens(claimData.claimId);
      claimData.citizens = citizensData;

      // Load equipment for each citizen
      const citizens = citizensData.citizens || [];
      const citizensWithGear = [];

      for (const citizen of citizens) {
        try {
          const equipment = await API.getPlayerEquipment(citizen.entityId);
          citizensWithGear.push({
            ...citizen,
            equipment: equipment.equipment || []
          });
        } catch (e) {
          citizensWithGear.push({
            ...citizen,
            equipment: []
          });
        }
      }

      claimData.citizens = { citizens: citizensWithGear };
      UI.renderCitizens(claimData.citizens);

    } catch (err) {
      console.error(err);
      UI.showError('Failed to load citizens data.');
    } finally {
      UI.showCitizensLoading(false);
    }
  }

  // Load items data (lazy loaded when tab clicked)
  async function loadItems() {
    if (claimData.items) {
      UI.renderIdList('items', claimData.items, claimData.citizens);
      return;
    }

    try {
      const itemsData = await API.getItems();
      claimData.items = itemsData.items || [];
      UI.renderIdList('items', claimData.items, claimData.citizens);
    } catch (err) {
      console.error(err);
    }
  }

  // Tab switching
  function setupTabs() {
    const tabs = document.querySelectorAll('#view-tabs .tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;

        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Show correct view
        document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
        document.getElementById(`view-${view}`).classList.remove('hidden');

        // Load data if needed
        if (view === 'citizens' && claimData.claimId) {
          loadCitizens();
        } else if (view === 'ids') {
          UI.renderIdList('citizens', claimData.items, claimData.citizens);
        } else if (view === 'mapLinkComposer'){
          UI.renderMapLinkComposer();
        }
      });
    });

    // ID type tabs (citizens vs items)
    const idTabs = document.querySelectorAll('.ids-tab-btn');
    idTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const type = tab.dataset.type;

        idTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        if (type === 'items') {
          loadItems();
        } else {
          UI.renderIdList('citizens', claimData.items, claimData.citizens);
        }
      });
    });

    // ID filter
    const filterInput = document.getElementById('ids-filter');
    filterInput.addEventListener('input', () => {
      const activeType = document.querySelector('.ids-tab-btn.active').dataset.type;
      UI.filterIdList(filterInput.value, activeType);
    });
  }

  // Event listeners
  loadBtn.addEventListener('click', loadClaim);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadClaim();
  });

    setupTabs();

    // Load from URL param if present
    const params = new URLSearchParams(window.location.search);
    const claimParam = params.get('claim');
    if (claimParam) {
      input.value = claimParam;
      loadClaim();
    }
})();
