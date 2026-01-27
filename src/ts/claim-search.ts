/**
 * Claim Search - City name autocomplete
 */
import { createLogger } from './logger.js';
import { API } from './api.js';
import type { ClaimSearchResult } from './types.js';

const log = createLogger('ClaimSearch');

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 10;

// --- State ---

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
let highlightedIndex = -1;
let currentResults: ClaimSearchResult[] = [];

// --- DOM References (set during init) ---

let searchInput: HTMLInputElement | null = null;
let suggestionsEl: HTMLUListElement | null = null;
let onSelectCallback: ((claimId: string) => void) | null = null;

// --- Public API ---

export interface ClaimSearchOptions {
    onSelect: (claimId: string) => void;
}

/**
 * Initialize the claim search autocomplete.
 * Attaches event listeners to existing DOM elements.
 *
 * @param options.onSelect - Called when user selects a claim
 */
export function init(options: ClaimSearchOptions): void {
    searchInput = document.getElementById('claim-search') as HTMLInputElement | null;
    suggestionsEl = document.getElementById('claim-suggestions') as HTMLUListElement | null;
    onSelectCallback = options.onSelect;

    if (!searchInput || !suggestionsEl) {
        log.warn('Search elements not found, autocomplete disabled');
        return;
    }

    attachEventListeners();
    log.debug('Initialized');
}

// --- Event Handlers ---

function attachEventListeners(): void {
    if (!searchInput || !suggestionsEl) return;

    searchInput.addEventListener('input', handleInput);
    searchInput.addEventListener('keydown', handleKeydown);
    suggestionsEl.addEventListener('click', handleSuggestionClick);
    document.addEventListener('click', handleClickOutside);
}

function handleInput(): void {
    if (!searchInput) return;
    const query = searchInput.value.trim();
    debouncedSearch(query);
}

function handleKeydown(e: KeyboardEvent): void {
    // If dropdown not visible, allow Enter to trigger search
    if (!suggestionsEl || suggestionsEl.classList.contains('hidden')) {
        if (e.key === 'Enter' && searchInput && searchInput.value.trim().length >= MIN_QUERY_LENGTH) {
            search(searchInput.value.trim());
        }
        return;
    }

    const itemCount = currentResults.length;
    if (itemCount === 0) return;

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            highlightedIndex = (highlightedIndex + 1) % itemCount;
            updateHighlight();
            break;
        case 'ArrowUp':
            e.preventDefault();
            highlightedIndex = highlightedIndex <= 0 ? itemCount - 1 : highlightedIndex - 1;
            updateHighlight();
            break;
        case 'Enter':
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < currentResults.length) {
                selectClaim(currentResults[highlightedIndex].entityId);
            }
            break;
        case 'Escape':
            e.preventDefault();
            hide();
            break;
    }
}

function handleSuggestionClick(e: MouseEvent): void {
    const target = (e.target as HTMLElement).closest('li[data-id]');
    if (target) {
        const claimId = target.getAttribute('data-id');
        if (claimId) selectClaim(claimId);
    }
}

function handleClickOutside(e: MouseEvent): void {
    const target = e.target as Node;
    if (!searchInput?.contains(target) && !suggestionsEl?.contains(target)) {
        hide();
    }
}

// --- Search Logic ---

function debouncedSearch(query: string): void {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => search(query), DEBOUNCE_MS);
}

async function search(query: string): Promise<void> {
    if (!suggestionsEl) return;

    if (query.length < MIN_QUERY_LENGTH) {
        hide();
        return;
    }

    try {
        const response = await API.searchClaims(query, MAX_RESULTS);
        currentResults = response.claims || [];
        highlightedIndex = -1;
        render();
        show();
    } catch (err) {
        log.error('Search failed:', (err as Error).message);
        hide();
    }
}

// --- Rendering ---

function render(): void {
    if (!suggestionsEl) return;

    if (currentResults.length === 0) {
        suggestionsEl.innerHTML = '<li class="no-results">No cities found</li>';
        return;
    }

    suggestionsEl.innerHTML = currentResults
    .map((claim, i) => renderSuggestion(claim, i))
    .join('');
}

function renderSuggestion(claim: ClaimSearchResult, index: number): string {
    const regionHtml = claim.regionName
    ? `<span class="suggestion-region">${escapeHtml(claim.regionName)}</span>`
    : '';

    return `
    <li role="option" data-index="${index}" data-id="${claim.entityId}" id="suggestion-${index}">
    <span class="suggestion-name">${escapeHtml(claim.name)}</span>
    <span class="suggestion-tier tier-${claim.tier}">T${claim.tier}</span>
    ${regionHtml}
    </li>
    `;
}

function updateHighlight(): void {
    if (!suggestionsEl) return;

    const items = suggestionsEl.querySelectorAll<HTMLElement>('li[role="option"]');
    items.forEach((item, i) => {
        item.classList.toggle('highlighted', i === highlightedIndex);
    });

    // ARIA: announce active descendant to screen readers
    if (highlightedIndex >= 0 && searchInput) {
        searchInput.setAttribute('aria-activedescendant', `suggestion-${highlightedIndex}`);
    } else {
        searchInput?.removeAttribute('aria-activedescendant');
    }
}

// --- Visibility ---

function show(): void {
    suggestionsEl?.classList.remove('hidden');
    searchInput?.setAttribute('aria-expanded', 'true');
}

function hide(): void {
    suggestionsEl?.classList.add('hidden');
    searchInput?.setAttribute('aria-expanded', 'false');
    highlightedIndex = -1;
    currentResults = [];
}

// --- Selection ---

function selectClaim(claimId: string): void {
    if (searchInput) searchInput.value = '';
    hide();
    onSelectCallback?.(claimId);
}

// --- Utilities ---

function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
