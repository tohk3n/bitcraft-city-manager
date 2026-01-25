// Main entry point - imports all modules and wires up the app
import { createLogger } from './logger.js';
import { UI } from './ui.js';
import { API } from './api.js';
import { processInventory, processCraftingStations } from './inventory.js';
import * as Planner from './planner/planner.js';
const log = createLogger('Main');
const input = document.getElementById('claim-id');
const loadBtn = document.getElementById('load-btn');
// Store loaded data for switching views
const claimData = {
    claimId: null,
    claimInfo: null,
    inventories: null,
    citizens: null,
    buildings: null,
    items: null
};
// Planner state
const plannerState = {
    targetTier: 6, // Default target
    codexCount: null, // null means use default for tier
    results: null
};
async function loadClaim() {
    if (!input)
        return;
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
        }
        catch (e) {
            // Claim endpoint might not exist, continue with default name
            const error = e;
            log.debug('Could not fetch claim details:', error.message);
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
            const stations = processCraftingStations(buildingsData.buildings);
            UI.renderCraftingStations(stations);
        }
        catch (e) {
            const error = e;
            log.debug('Could not fetch buildings:', error.message);
        }
        // Initialize planner controls (don't load data yet - lazy load on tab click)
        initPlanner();
        // Save to URL for sharing
        history.replaceState(null, '', `?claim=${claimId}`);
    }
    catch (err) {
        const error = err;
        log.error('Failed to load claim:', error.message);
        UI.showError('Failed to load claim data. Check the ID and try again.');
    }
    finally {
        UI.setLoading(false);
    }
}
// Initialize planner UI
function initPlanner() {
    const controlsContainer = document.getElementById('planner-controls');
    const summaryContainer = document.getElementById('deficit-summary');
    const treeContainer = document.getElementById('research-tree');
    if (!controlsContainer || !treeContainer)
        return;
    Planner.renderControls(controlsContainer, plannerState.targetTier, async (newTier, newCount) => {
        plannerState.targetTier = newTier;
        plannerState.codexCount = newCount;
        await loadPlanner();
    });
    Planner.renderEmpty(treeContainer);
    if (summaryContainer)
        summaryContainer.innerHTML = '';
}
// Load planner data
async function loadPlanner() {
    if (!claimData.claimId)
        return;
    const summaryContainer = document.getElementById('deficit-summary');
    const treeContainer = document.getElementById('research-tree');
    if (!treeContainer)
        return;
    Planner.renderLoading(treeContainer);
    try {
        const options = plannerState.codexCount ? { customCount: plannerState.codexCount } : {};
        const results = await Planner.calculateRequirements(claimData.claimId, plannerState.targetTier, options);
        plannerState.results = results;
        if (summaryContainer) {
            Planner.renderDeficitSummary(summaryContainer, results.summary);
        }
        Planner.renderResearchTree(treeContainer, results.researches, results.studyJournals);
    }
    catch (err) {
        const error = err;
        log.error('Planner error:', error.message);
        treeContainer.innerHTML = `
    <div class="planner-empty">
    Failed to calculate requirements: ${error.message}
    </div>
    `;
    }
}
// Load citizens data (lazy loaded when tab clicked)
async function loadCitizens() {
    if (!claimData.claimId)
        return;
    // Return cached if available
    if (claimData.citizens) {
        UI.renderCitizens(claimData.citizens);
        return;
    }
    UI.showCitizensLoading(true);
    try {
        const citizensData = await API.getClaimCitizens(claimData.claimId);
        const citizens = citizensData.citizens || [];
        // Render skeleton table immediately with empty equipment
        const citizensWithEmptyGear = citizens.map(c => ({ ...c, equipment: [] }));
        claimData.citizens = { citizens: citizensWithEmptyGear };
        UI.renderCitizens(claimData.citizens);
        UI.showCitizensLoading(false);
        // Fetch all equipment in parallel (fast)
        const equipmentResults = await Promise.all(citizens.map(async (citizen) => {
            try {
                const equipment = await API.getPlayerEquipment(citizen.entityId);
                return { id: citizen.entityId, equipment: equipment.equipment || [] };
            }
            catch (e) {
                const error = e;
                log.warn(`Failed to load equipment for ${citizen.entityId}:`, error.message);
                return { id: citizen.entityId, equipment: [] };
            }
        }));
        // Update DOM progressively with staggered timing (smooth)
        for (let i = 0; i < equipmentResults.length; i++) {
            const result = equipmentResults[i];
            // Stagger updates ~30ms apart for visual smoothness
            setTimeout(() => {
                UI.updateCitizenEquipment(result.id, result.equipment);
                // Update cached data
                if (claimData.citizens) {
                    const cached = claimData.citizens.citizens.find(c => c.entityId === result.id);
                    if (cached)
                        cached.equipment = result.equipment;
                }
            }, i * 30);
        }
    }
    catch (err) {
        const error = err;
        log.error('Failed to load citizens:', error.message);
        UI.showError('Failed to load citizens data.');
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
    }
    catch (err) {
        const error = err;
        log.error('Failed to load items:', error.message);
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
            const viewEl = document.getElementById(`view-${view}`);
            viewEl?.classList.remove('hidden');
            // Load data if needed
            if (view === 'citizens' && claimData.claimId) {
                loadCitizens();
            }
            else if (view === 'ids') {
                UI.renderIdList('citizens', claimData.items, claimData.citizens);
            }
            else if (view === 'mapLinkComposer') {
                UI.renderMapLinkComposer();
            }
            else if (view === 'planner' && claimData.claimId) {
                // Only load if we haven't yet or if claim changed
                if (!plannerState.results) {
                    loadPlanner();
                }
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
            }
            else {
                UI.renderIdList('citizens', claimData.items, claimData.citizens);
            }
        });
    });
    // ID filter
    const filterInput = document.getElementById('ids-filter');
    filterInput?.addEventListener('input', () => {
        const activeTab = document.querySelector('.ids-tab-btn.active');
        const activeType = activeTab?.dataset.type || 'citizens';
        UI.filterIdList(filterInput.value, activeType);
    });
}
// Event listeners
loadBtn?.addEventListener('click', loadClaim);
input?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter')
        loadClaim();
});
setupTabs();
// Load from URL param if present
const params = new URLSearchParams(window.location.search);
const claimParam = params.get('claim');
if (claimParam && input) {
    input.value = claimParam;
    loadClaim();
}
//# sourceMappingURL=main.js.map