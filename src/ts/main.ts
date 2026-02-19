// Main entry point - imports all modules and wires up the app
import { createLogger } from './logger.js';
import { UI } from './ui.js';
import { API } from './api.js';
import { processInventory, processCraftingStations } from './inventory.js';
import * as Planner from './planner/planner.js';
import * as ClaimSearch from './claim-search.js';
import type {
  ClaimData,
  PlannerState,
  CalculateOptions,
  ClaimInventoriesResponse,
  InventoryProcessResult,
  ClaimBuildingsResponse,
  CraftingStationsResult,
  ClaimResponse,
  Building,
} from './types/index.js';
import { CitizensUI } from './citizens.js';

const log = createLogger('Main');

const loadBtn = document.getElementById('load-btn');

// Store loaded data for switching views
const claimData: ClaimData = {
  claimId: null,
  claimInfo: null,
  inventories: null,
  citizens: null,
  citizensData: null,
  buildings: null,
  items: null,
};

// Planner state
const plannerState: PlannerState = {
  targetTier: 6, // Default target
  codexCount: null, // null means use default for tier
  results: null,
};

async function loadClaim(claimId: string): Promise<void> {
  if (!claimId || !/^\d+$/.test(claimId)) {
    UI.showError('Please enter a valid claim ID (numbers only)');
    return;
  }

  UI.clearError();
  UI.setLoading(true);

  try {
    // Load inventories (includes item metadata)
    const data: ClaimInventoriesResponse = await API.getClaimInventories(claimId);
    claimData.claimId = claimId;
    CitizensUI.reset();
    claimData.inventories = data;

    // Try to get claim name and details
    let claimName = `Claim ${claimId}`;
    let hasClaimHeader = false;
    try {
      const claimInfo: ClaimResponse = await API.getClaim(claimId);
      claimData.claimInfo = claimInfo;
      if (claimInfo.claim && claimInfo.claim.name) {
        claimName = claimInfo.claim.name;
        UI.renderClaimHeader(claimInfo);
        hasClaimHeader = true;
      }
    } catch (e) {
      // Claim endpoint might not exist, continue with default name
      const error = e as Error;
      log.debug('Could not fetch claim details:', error.message);
    }

    // Only show simple name if header failed
    if (!hasClaimHeader) {
      UI.setClaimName(claimName);
    }
    UI.showTabs();
    // Process and render inventory view
    const result: InventoryProcessResult = processInventory(data);
    UI.renderDashboard(result);
    log.debug('rendered Dashboard');
    // Load and render crafting stations
    try {
      const buildings: Building[] = await API.getClaimBuildings(claimId);
      const buildingsData: ClaimBuildingsResponse = {
        buildings,
      };
      claimData.buildings = buildingsData;
      log.debug('claimdata.buildings:', buildingsData);
      const stations: CraftingStationsResult = processCraftingStations(buildingsData.buildings);
      UI.renderCraftingStations(stations);
    } catch (e) {
      const error = e as Error;
      log.debug('Could not fetch buildings:', error.message);
    }

    // Initialize planner controls (don't load data yet - lazy load on tab click)
    initPlanner();

    // Save to URL for sharing
    history.replaceState(null, '', `?claim=${claimId}`);
  } catch (err) {
    const error = err as Error;
    log.error('Failed to load claim:', error.message);
    UI.showError('Failed to load claim data. Check the ID and try again.');
  } finally {
    UI.setLoading(false);
  }
}

// Initialize planner UI
function initPlanner(): void {
  const controlsContainer = document.getElementById('planner-controls');
  const plannerContainer = document.getElementById('planner-content');

  if (!controlsContainer || !plannerContainer) return;

  Planner.renderControls(
    controlsContainer,
    plannerState.targetTier,
    async (newTier: number, newCount: number | null) => {
      plannerState.targetTier = newTier;
      plannerState.codexCount = newCount;
      await loadPlanner();
    }
  );

  Planner.renderEmpty(plannerContainer);
}

// Load planner data
async function loadPlanner(): Promise<void> {
  if (!claimData.claimId) return;

  const plannerContainer = document.getElementById('planner-content');
  if (!plannerContainer) return;

  Planner.renderLoading(plannerContainer);

  try {
    const options: CalculateOptions = plannerState.codexCount
      ? { customCount: plannerState.codexCount }
      : {};
    const results = await Planner.calculateRequirements(
      claimData.claimId,
      plannerState.targetTier,
      options
    );
    plannerState.results = results;

    // Render unified planner view (dashboard + flowchart tabs)
    Planner.renderPlannerView(
      plannerContainer,
      results.researches,
      results.planItems,
      results.targetTier,
      results.studyJournals
    );
  } catch (err) {
    const error = err as Error;
    log.error('Planner error:', error.message);
    plannerContainer.innerHTML = `
      <div class="pv-empty">
        Failed to calculate requirements: ${error.message}
      </div>
    `;
  }
}

// Load citizens data (lazy loaded when tab clicked)
async function loadCitizens(): Promise<void> {
  if (!claimData.claimId) return;

  const result = await CitizensUI.loadAndRender(
    claimData.claimId,
    claimData.citizensData ?? undefined
  );

  if (result) claimData.citizensData = result;
}

// Load items data (lazy loaded when tab clicked)
async function loadItems(): Promise<void> {
  if (claimData.items) {
    UI.renderIdList('items', claimData.items, claimData.citizens);
    return;
  }

  try {
    const itemsData = await API.getItems();
    claimData.items = itemsData.items || [];
    UI.renderIdList('items', claimData.items, claimData.citizens);
  } catch (err) {
    const error = err as Error;
    log.error('Failed to load items:', error.message);
  }
}

// Tab switching
function setupTabs(): void {
  const tabs = document.querySelectorAll<HTMLElement>('#view-tabs .tab-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;

      // Update active tab
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      // Show correct view
      document.querySelectorAll('.view-section').forEach((s) => s.classList.add('hidden'));
      const viewEl = document.getElementById(`view-${view}`);
      viewEl?.classList.remove('hidden');

      // Load data if needed
      if (view === 'citizens' && claimData.claimId) {
        loadCitizens();
      } else if (view === 'ids') {
        UI.renderIdList('citizens', claimData.items, claimData.citizens);
      } else if (view === 'mapLinkComposer') {
        UI.renderMapLinkComposer();
      } else if (view === 'planner' && claimData.claimId) {
        // Only load if we haven't yet or if claim changed
        if (!plannerState.results) {
          loadPlanner();
        }
      }
    });
  });

  // ID type tabs (citizens vs items)
  const idTabs = document.querySelectorAll<HTMLElement>('.ids-tab-btn');
  idTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const type = tab.dataset.type;

      idTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      if (type === 'items') {
        loadItems();
      } else {
        UI.renderIdList('citizens', claimData.items, claimData.citizens);
      }
    });
  });

  // ID filter
  const filterInput = document.getElementById('ids-filter') as HTMLInputElement | null;
  filterInput?.addEventListener('input', () => {
    const activeTab = document.querySelector<HTMLElement>('.ids-tab-btn.active');
    const activeType = activeTab?.dataset.type || 'citizens';
    UI.filterIdList(filterInput.value, activeType);
  });
}

// --- Initialization ---

// Unified claim input (handles both city search and direct ID)
ClaimSearch.init({
  onSelect: (claimId) => loadClaim(claimId),
  onDirectLoad: (claimId) => loadClaim(claimId),
});

// Load button (reads from input field)
loadBtn?.addEventListener('click', () => {
  const input = document.getElementById('claim-input-field') as HTMLInputElement | null;
  if (input) {
    loadClaim(input.value.trim());
  }
});

setupTabs();

// Load from URL param if present
const params = new URLSearchParams(window.location.search);
const claimParam: string | null = params.get('claim');
if (claimParam) {
  // Pre-fill input and load
  const input = document.getElementById('claim-input-field') as HTMLInputElement | null;
  if (input) input.value = claimParam;
  loadClaim(claimParam);
}
