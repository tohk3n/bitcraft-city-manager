import { createLogger } from './logger.js';
import { UI } from './ui.js';
import { API } from './api.js';
import { processCraftingStations } from './inventory.js';
import { CitizensUI } from './citizens/index.js';
import { InventoryProcessor } from './inventory.js';
import * as Planner from './planner/planner.js';
import * as ClaimSearch from './claim-search.js';
import { buildFilterContext } from './planner/player-context.js';
import type { FilterContext } from './planner/player-filter.js';
import type {
  PlannerState,
  CalculateOptions,
  ClaimInventoriesResponse,
  ClaimCitizensResponse,
  InventoryProcessResult,
  ClaimBuildingsResponse,
  CraftingStationsResult,
  ClaimResponse,
  Building,
  ApiItem,
} from './types/index.js';
import type { CitizensData } from './citizens/index.js';
import * as Calculator from './calculator-view.js';
import { applyTabA11y } from './aria.js';
import * as MaterialsView from './material-breakdown-view.js';
import { initHotkeys } from './hotkeys.js';
import { initWalkthrough } from './walkthrough.js';
import { applyAll as applyPreferences } from './user-prefs.js';
import { init as initTravelerTimer } from './traveler-timer.js';
import * as Overview from './overview.js';
import * as ActiveCrafts from './active-crafts.js';
import { initAeolith } from './aeolith.js';

const log = createLogger('Main');

const loadBtn = document.getElementById('load-btn');

// -- url params --

const params = new URLSearchParams(window.location.search);
const claimParam: string | null = params.get('claim');
let activePlayerId: string | null = params.get('playerId');

// -- app state --

interface AppData {
  claimId: string | null;
  claimInfo: ClaimResponse | null;
  inventories: ClaimInventoriesResponse | null;
  citizens: ClaimCitizensResponse | null;
  citizensData: CitizensData | null;
  buildings: ClaimBuildingsResponse | null;
  items: ApiItem[] | null;
  playerFilter: FilterContext | null;
}

const claimData: AppData = {
  claimId: null,
  claimInfo: null,
  inventories: null,
  citizens: null,
  citizensData: null,
  buildings: null,
  items: null,
  playerFilter: null,
};

const plannerState: PlannerState = {
  targetTier: 6,
  codexCount: null,
  results: null,
};

// -- claim loading --

async function loadClaim(claimId: string): Promise<void> {
  if (!claimId || !/^\d+$/.test(claimId)) {
    UI.showError('Please enter a valid claim ID (numbers only)');
    return;
  }

  UI.clearError();
  UI.setLoading(true);

  try {
    const data: ClaimInventoriesResponse = await API.getClaimInventories(claimId);
    claimData.claimId = claimId;
    CitizensUI.reset();
    plannerState.results = null;
    claimData.inventories = data;
    claimData.playerFilter = null;

    // claim header
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
      const error = e as Error;
      log.debug('Could not fetch claim details:', error.message);
    }

    if (!hasClaimHeader) {
      UI.setClaimName(claimName);
    }
    UI.showTabs();

    const statusEl = document.getElementById('status-claim');
    if (statusEl) statusEl.textContent = claimName;

    const result: InventoryProcessResult = InventoryProcessor.processInventory(data);
    UI.renderDashboard(result, claimData.claimInfo ?? undefined);

    // overview gets the processed result, not the raw API response
    if (claimData.claimInfo) {
      Overview.render({
        claimInfo: claimData.claimInfo,
        inventory: result,
        foodItems: result.foodItems,
      });
    }

    // buildings, needed for station display and player filter
    try {
      const buildings: Building[] = await API.getClaimBuildings(claimId);
      claimData.buildings = { buildings };
      const stations: CraftingStationsResult = processCraftingStations(buildings);
      UI.renderCraftingStations(stations);
      Overview.renderStations(stations);

      // start active crafts polling -- stop() first is idempotent
      ActiveCrafts.stop();
      const craftsEl = document.getElementById('ov-active-crafts');
      if (craftsEl) ActiveCrafts.start(craftsEl, claimId);
    } catch (e) {
      const error = e as Error;
      log.debug('Could not fetch buildings:', error.message);
    }

    initPlanner();

    // default planner target to next tier upgrade
    const cityTier = claimData.claimInfo?.claim?.tier ?? 0;
    if (cityTier >= 1 && cityTier < 10) {
      plannerState.targetTier = cityTier + 1;
    }

    // preserve playerId in URL if present
    const urlParams = new URLSearchParams({ claim: claimId });
    if (activePlayerId) urlParams.set('playerId', activePlayerId);
    history.replaceState(null, '', `?${urlParams.toString()}`);
  } catch (err) {
    const error = err as Error;
    log.error('Failed to load claim:', error.message);
    UI.showError('Failed to load claim data. Check the ID and try again.');
  } finally {
    UI.setLoading(false);
  }
}

// -- player filter --
// requires citizens data (for skills) and buildings (for station tiers).
// loads citizens if not cached.

async function loadPlayerFilter(): Promise<void> {
  if (!claimData.claimId || !activePlayerId) return;

  if (!claimData.citizensData) {
    const result = await CitizensUI.loadAndRender(
      claimData.claimId,
      claimData.citizensData ?? undefined
    );
    if (result) claimData.citizensData = result;
  }

  if (!claimData.citizensData) return;

  const buildings = claimData.buildings?.buildings ?? [];
  const ctx = await buildFilterContext(activePlayerId, claimData.citizensData, buildings);

  if (ctx) {
    claimData.playerFilter = ctx;
    log.info(`Player filter active for ${activePlayerId}`);
  }
}

// -- planner --

function initPlanner(): void {
  const plannerContainer = document.getElementById('planner-content');
  if (!plannerContainer) return;
  Planner.renderEmpty(plannerContainer);
}

async function loadPlanner(): Promise<void> {
  if (!claimData.claimId) return;

  const plannerContainer = document.getElementById('planner-content');
  if (!plannerContainer) return;

  Planner.renderLoading(plannerContainer);

  // build player filter on first planner load if playerId present
  if (activePlayerId && !claimData.playerFilter) {
    await loadPlayerFilter();
  }

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

    const citizensList =
      claimData.citizensData?.records.map((r) => ({
        entityId: r.entityId,
        userName: r.userName,
      })) ?? null;

    Planner.renderPlannerView(
      plannerContainer,
      results,
      claimData.claimId,
      claimData.claimInfo?.claim?.tier ?? 0,
      claimData.playerFilter,
      citizensList,
      activePlayerId,
      (tier: number, count: number) => {
        plannerState.targetTier = tier;
        plannerState.codexCount = count;
        loadPlanner();
      },
      async (playerId: string | null) => {
        const urlParams = new URLSearchParams(window.location.search);
        if (playerId) {
          urlParams.set('playerId', playerId);
        } else {
          urlParams.delete('playerId');
        }
        history.replaceState(null, '', `?${urlParams.toString()}`);

        activePlayerId = playerId;
        claimData.playerFilter = null;
        if (playerId) await loadPlayerFilter();
        await loadPlanner();
      },
      // poll refresh, re-fetch inventory and recalculate for current tier
      async () => {
        if (!claimData.claimId) throw new Error('No claim loaded');
        const options: CalculateOptions = plannerState.codexCount
          ? { customCount: plannerState.codexCount }
          : {};
        const results = await Planner.calculateRequirements(
          claimData.claimId,
          plannerState.targetTier,
          options
        );
        plannerState.results = results;
        return {
          planItems: results.planItems,
          researches: results.researches,
          studyJournals: results.studyJournals,
        };
      }
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

// -- citizens --

async function loadCitizens(): Promise<void> {
  if (!claimData.claimId) return;

  const result = await CitizensUI.loadAndRender(
    claimData.claimId,
    claimData.citizensData ?? undefined
  );

  if (result) {
    claimData.citizensData = result;
    Overview.updateCitizenCount(result.records.length);
  }
}

// -- items --

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

// -- tab switching --

function setupTabs(): void {
  const tabContainer = document.getElementById('view-tabs');
  if (tabContainer) applyTabA11y(tabContainer, '.tab-btn');

  const idsTabContainer = document.getElementById('ids-tabs');
  if (idsTabContainer) applyTabA11y(idsTabContainer, '.ids-tab-btn');

  const tabs = document.querySelectorAll<HTMLElement>('#view-tabs .tab-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;

      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      document.querySelectorAll('.view-section').forEach((s) => s.classList.add('hidden'));
      const viewEl = document.getElementById(`view-${view}`);
      viewEl?.classList.remove('hidden');

      if (view !== 'planner') {
        Planner.stopPolling();
      }

      if (view === 'overview') {
        // re-render from cached data -- no extra API calls
        if (claimData.claimInfo && claimData.inventories) {
          const processed = InventoryProcessor.processInventory(claimData.inventories);
          Overview.render({
            claimInfo: claimData.claimInfo,
            inventory: processed,
            foodItems: processed.foodItems,
          });
        }
      } else if (view === 'citizens' && claimData.claimId) {
        loadCitizens();
      } else if (view === 'ids') {
        UI.renderIdList('citizens', claimData.items, claimData.citizens);
      } else if (view === 'mapLinkComposer') {
        UI.renderMapLinkComposer();
      } else if (view === 'planner' && claimData.claimId) {
        if (!plannerState.results) {
          loadPlanner();
        }
      } else if (view === 'calculator') {
        const container = document.getElementById('calculator-content');
        if (container) Calculator.render(container);
      } else if (view === 'resourceCalculator') {
        const container = document.getElementById('resource-calculator-content');
        if (container) MaterialsView.render(container);
      }
    });
  });

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

  const filterInput = document.getElementById('ids-filter') as HTMLInputElement | null;
  filterInput?.addEventListener('input', () => {
    UI.filterIdList(filterInput.value);
  });
}

// -- init --

ClaimSearch.init({
  onSelect: (claimId) => loadClaim(claimId),
  onDirectLoad: (claimId) => loadClaim(claimId),
});

loadBtn?.addEventListener('click', () => {
  const input = document.getElementById('claim-input-field') as HTMLInputElement | null;
  if (input) {
    loadClaim(input.value.trim());
  }
});

applyPreferences();
setupTabs();
initHotkeys();
initTravelerTimer();
initWalkthrough();

initAeolith({
  getClaimId: () => claimData.claimId,
  getClaimInfo: () => claimData.claimInfo,
  getInventoryLookup: () => Planner.getLastInventoryLookup(),
  getPlanItems: () => plannerState.results?.planItems ?? null,
  getTargetTier: () => plannerState.targetTier,
  getCitizens: () => claimData.citizensData,
  loadClaim: (id) => loadClaim(id),
  loadCitizens: () => loadCitizens(),
});

if (claimParam) {
  const input = document.getElementById('claim-input-field') as HTMLInputElement | null;
  if (input) input.value = claimParam;
  loadClaim(claimParam);
}
