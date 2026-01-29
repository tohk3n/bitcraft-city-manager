/**
 * Claim Search - Intelligent city/ID input with autocomplete
 * 
 * Single responsibility: handle claim input that auto-detects intent.
 * - All digits → Claim ID (direct load on Enter)
 * - Contains letters → City name search (autocomplete)
 * 
 * Uses fresh DOM queries (no stale references).
 * Communicates via callbacks only.
 */
import { createLogger } from './logger.js';
import { API } from './api.js';
import { KeyboardKey } from './types/index.js';
import type { ClaimSearchResult, ClaimSearchElements, ClaimSearchCallbacks } from './types/index.js';

const log = createLogger('ClaimSearch');

// --- Configuration ---

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 10;
const CLAIM_ID_PATTERN = /^\d+$/;

// --- State ---

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
let highlightedIndex = -1;
let currentResults: ClaimSearchResult[] = [];
let callbacks: ClaimSearchCallbacks | null = null;

// --- DOM Accessors (fresh queries, no stale refs) ---

function getElements(): ClaimSearchElements | null {
    const input = document.getElementById('claim-input-field') as HTMLInputElement | null;
    const suggestions = document.getElementById('claim-suggestions') as HTMLUListElement | null;
    
    if (!input || !suggestions) {
        return null;
    }
    
    return { input, suggestions };
}

// --- Public API ---

/**
 * Initialize the claim search component.
 * 
 * @param options.onSelect - Called when user selects a city from autocomplete
 * @param options.onDirectLoad - Called when user enters a claim ID and presses Enter
 */
export function init(options: ClaimSearchCallbacks): void {
    callbacks = options;
    
    const elements = getElements();
    if (!elements) {
        log.warn('Claim search elements not found, feature disabled');
        return;
    }
    
    attachEventListeners(elements);
    log.debug('Initialized');
}

// --- Event Setup ---

function attachEventListeners(elements: ClaimSearchElements): void {
    elements.input.addEventListener('input', handleInput);
    elements.input.addEventListener('keydown', handleKeydown);
    elements.suggestions.addEventListener('click', handleSuggestionClick);
    document.addEventListener('click', handleClickOutside);
}

// --- Event Handlers ---

function handleInput(): void {
    const elements = getElements();
    if (!elements) return;
    
    const value = elements.input.value.trim();
    
    if (!value) {
        hide();
        return;
    }
    
    // All digits = claim ID, no autocomplete needed
    if (CLAIM_ID_PATTERN.test(value)) {
        hide();
        return;
    }
    
    // Has letters = city name search
    if (value.length >= MIN_QUERY_LENGTH) {
        debouncedSearch(value);
    } else {
        hide();
    }
}

function handleKeydown(e: KeyboardEvent): void {
    const elements = getElements();
    if (!elements) return;
    
    const value = elements.input.value.trim();
    const isDropdownVisible = !elements.suggestions.classList.contains('hidden');
    
    // Enter with claim ID = direct load
    if (e.key === KeyboardKey.Enter && CLAIM_ID_PATTERN.test(value)) {
        e.preventDefault();
        hide();
        callbacks?.onDirectLoad(value);
        return;
    }
    
    // If dropdown not visible, Enter triggers search
    if (!isDropdownVisible) {
        if (e.key === KeyboardKey.Enter && value.length >= MIN_QUERY_LENGTH) {
            search(value);
        }
        return;
    }
    
    // Dropdown navigation
    const itemCount = currentResults.length;
    if (itemCount === 0) return;
    
    switch (e.key) {
        case KeyboardKey.ArrowDown:
            e.preventDefault();
            highlightedIndex = (highlightedIndex + 1) % itemCount;
            updateHighlight();
            break;
            
        case KeyboardKey.ArrowUp:
            e.preventDefault();
            highlightedIndex = highlightedIndex <= 0 ? itemCount - 1 : highlightedIndex - 1;
            updateHighlight();
            break;
            
        case KeyboardKey.Enter:
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < currentResults.length) {
                selectClaim(currentResults[highlightedIndex].entityId);
            }
            break;
            
        case KeyboardKey.Escape:
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
    const elements = getElements();
    if (!elements) return;
    
    const target = e.target as Node;
    if (!elements.input.contains(target) && !elements.suggestions.contains(target)) {
        hide();
    }
}

// --- Search Logic ---

function debouncedSearch(query: string): void {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => search(query), DEBOUNCE_MS);
}

async function search(query: string): Promise<void> {
    const elements = getElements();
    if (!elements) return;
    
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
    const elements = getElements();
    if (!elements) return;
    
    if (currentResults.length === 0) {
        elements.suggestions.innerHTML = '<li class="no-results">No cities found</li>';
        return;
    }
    
    elements.suggestions.innerHTML = currentResults
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
    const elements = getElements();
    if (!elements) return;
    
    const items = elements.suggestions.querySelectorAll<HTMLElement>('li[role="option"]');
    items.forEach((item, i) => {
        item.classList.toggle('highlighted', i === highlightedIndex);
    });
    
    // ARIA: announce active descendant
    if (highlightedIndex >= 0) {
        elements.input.setAttribute('aria-activedescendant', `suggestion-${highlightedIndex}`);
    } else {
        elements.input.removeAttribute('aria-activedescendant');
    }
}

// --- Visibility ---

function show(): void {
    const elements = getElements();
    if (!elements) return;
    
    elements.suggestions.classList.remove('hidden');
    elements.input.setAttribute('aria-expanded', 'true');
}

function hide(): void {
    const elements = getElements();
    if (!elements) return;
    
    elements.suggestions.classList.add('hidden');
    elements.input.setAttribute('aria-expanded', 'false');
    highlightedIndex = -1;
    currentResults = [];
}

// --- Selection ---

function selectClaim(claimId: string): void {
    const elements = getElements();
    if (elements) {
        elements.input.value = '';
    }
    hide();
    callbacks?.onSelect(claimId);
}

// --- Utilities ---

function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}