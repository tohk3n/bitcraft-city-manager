// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initHotkeys, destroyHotkeys } from '../hotkeys.js';

// =============================================================================
// HELPERS
// =============================================================================

function getTab(view: string): HTMLElement {
  const tab = document.querySelector<HTMLElement>(`#view-tabs .tab-btn[data-view="${view}"]`);
  if (!tab) throw new Error(`Tab not found: ${view}`);
  return tab;
}

function setActiveTab(view: string): void {
  document.querySelectorAll('#view-tabs .tab-btn').forEach((t) => t.classList.remove('active'));
  getTab(view).classList.add('active');
}

function pressKey(key: string, target?: HTMLElement): void {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  (target ?? document).dispatchEvent(event);
}

function pressKeyWithModifier(key: string, modifier: 'ctrlKey' | 'altKey' | 'metaKey'): void {
  const event = new KeyboardEvent('keydown', {
    key,
    [modifier]: true,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(event);
}

function createTabBar(): void {
  const nav = document.createElement('nav');
  nav.id = 'view-tabs';

  const tabs = [
    { view: 'inventory', label: 'Inventory' },
    { view: 'planner', label: 'Planner' },
    { view: 'citizens', label: 'Citizens' },
    { view: 'ids', label: 'IDs' },
    { view: 'mapLinkComposer', label: 'Map' },
    { view: 'calculator', label: 'Calc' },
    { view: 'resourceCalculator', label: 'Resources' },
  ];

  for (const { view, label } of tabs) {
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.dataset.view = view;
    btn.textContent = label;
    nav.appendChild(btn);
  }

  // Default active tab
  nav.children[0].classList.add('active');
  document.body.appendChild(nav);
}

function createSearchInput(id: string): HTMLInputElement {
  const input = document.createElement('input');
  input.id = id;
  input.type = 'text';
  document.body.appendChild(input);
  return input;
}

function createPlannerTabs(): void {
  const container = document.createElement('div');
  container.innerHTML = `
    <button class="pv-tab active" data-view="dashboard">Tasks</button>
    <button class="pv-tab" data-view="flowchart">Tree</button>
  `;
  document.body.appendChild(container);
}

// =============================================================================
// TAB SWITCHING
// =============================================================================

describe('Hotkeys — tab switching', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    createTabBar();
    initHotkeys();
  });

  afterEach(() => {
    destroyHotkeys();
  });

  it.each([
    ['i', 'inventory'],
    ['p', 'planner'],
    ['c', 'citizens'],
    ['d', 'ids'],
    ['m', 'mapLinkComposer'],
    ['a', 'calculator'],
    ['r', 'resourceCalculator'],
  ])('pressing "%s" clicks the %s tab', (key, view) => {
    const tab = getTab(view);
    const spy = vi.fn();
    tab.addEventListener('click', spy);

    pressKey(key);

    expect(spy).toHaveBeenCalledOnce();
  });

  it('handles uppercase keys (caps lock)', () => {
    const tab = getTab('planner');
    const spy = vi.fn();
    tab.addEventListener('click', spy);

    pressKey('P');

    expect(spy).toHaveBeenCalledOnce();
  });

  it('ignores keys when typing in an input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const tab = getTab('planner');
    const spy = vi.fn();
    tab.addEventListener('click', spy);

    pressKey('p', input);

    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores keys when typing in a textarea', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    const tab = getTab('planner');
    const spy = vi.fn();
    tab.addEventListener('click', spy);

    pressKey('p', textarea);

    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores keys with ctrl modifier', () => {
    const tab = getTab('planner');
    const spy = vi.fn();
    tab.addEventListener('click', spy);
    pressKeyWithModifier('p', 'ctrlKey');
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores keys with alt modifier', () => {
    const tab = getTab('planner');
    const spy = vi.fn();
    tab.addEventListener('click', spy);
    pressKeyWithModifier('p', 'altKey');
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores keys with meta modifier', () => {
    const tab = getTab('planner');
    const spy = vi.fn();
    tab.addEventListener('click', spy);
    pressKeyWithModifier('p', 'metaKey');
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores unmapped keys', () => {
    const tabs = document.querySelectorAll<HTMLElement>('#view-tabs .tab-btn');
    const spies = Array.from(tabs).map((tab) => {
      const spy = vi.fn();
      tab.addEventListener('click', spy);
      return spy;
    });

    pressKey('z');

    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

// =============================================================================
// ESCAPE — blur inputs
// =============================================================================

describe('Hotkeys — Escape', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    createTabBar();
    initHotkeys();
  });

  afterEach(() => {
    destroyHotkeys();
  });

  it('blurs a focused input', () => {
    const input = createSearchInput('test-input');
    input.focus();
    expect(document.activeElement).toBe(input);

    pressKey('Escape', input);

    expect(document.activeElement).not.toBe(input);
  });

  it('blurs a focused textarea', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    pressKey('Escape', textarea);

    expect(document.activeElement).not.toBe(textarea);
  });

  it('blurs a focused select', () => {
    const select = document.createElement('select');
    document.body.appendChild(select);
    select.focus();
    expect(document.activeElement).toBe(select);

    pressKey('Escape', select);

    expect(document.activeElement).not.toBe(select);
  });
});

// =============================================================================
// / — focus contextual search
// =============================================================================

describe('Hotkeys — / search focus', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    createTabBar();
    initHotkeys();
  });

  afterEach(() => {
    destroyHotkeys();
  });

  it('focuses ids-filter when IDs tab is active', () => {
    setActiveTab('ids');
    const input = createSearchInput('ids-filter');

    pressKey('/');

    expect(document.activeElement).toBe(input);
  });

  it('focuses cz-search when Citizens tab is active', () => {
    setActiveTab('citizens');
    const input = createSearchInput('cz-search');

    pressKey('/');

    expect(document.activeElement).toBe(input);
  });

  it('focuses calc-item-search when Calculator tab is active', () => {
    setActiveTab('calculator');
    const input = createSearchInput('calc-item-search');

    pressKey('/');

    expect(document.activeElement).toBe(input);
  });

  it('falls back to claim-input-field when no view-specific search', () => {
    setActiveTab('inventory');
    const input = createSearchInput('claim-input-field');

    pressKey('/');

    expect(document.activeElement).toBe(input);
  });

  it('does not fire when already in an input', () => {
    setActiveTab('ids');
    const idsInput = createSearchInput('ids-filter');
    const otherInput = createSearchInput('some-other-input');
    otherInput.focus();

    // / typed in an input should just type, not refocus
    pressKey('/', otherInput);

    expect(document.activeElement).toBe(otherInput);
    expect(document.activeElement).not.toBe(idsInput);
  });
});

// =============================================================================
// PLANNER SCOPED — t/f for Tasks/Tree
// =============================================================================

describe('Hotkeys — planner scoped keys', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    createTabBar();
    createPlannerTabs();
    initHotkeys();
  });

  afterEach(() => {
    destroyHotkeys();
  });

  it('t clicks the Tasks (dashboard) tab when planner is active', () => {
    setActiveTab('planner');
    const tab = document.querySelector<HTMLElement>('.pv-tab[data-view="dashboard"]');
    if (!tab) throw new Error('dashboard tab not found');
    const spy = vi.fn();
    tab.addEventListener('click', spy);

    pressKey('t');

    expect(spy).toHaveBeenCalledOnce();
  });

  it('f clicks the Tree (flowchart) tab when planner is active', () => {
    setActiveTab('planner');
    const tab = document.querySelector<HTMLElement>('.pv-tab[data-view="flowchart"]');
    if (!tab) throw new Error('flowchart tab not found');
    const spy = vi.fn();
    tab.addEventListener('click', spy);

    pressKey('f');

    expect(spy).toHaveBeenCalledOnce();
  });

  it('t does nothing when planner is NOT active', () => {
    setActiveTab('inventory');
    const tab = document.querySelector<HTMLElement>('.pv-tab[data-view="dashboard"]');
    if (!tab) throw new Error('dashboard tab not found');
    const spy = vi.fn();
    tab.addEventListener('click', spy);

    pressKey('t');

    expect(spy).not.toHaveBeenCalled();
  });

  it('f does nothing when planner is NOT active', () => {
    setActiveTab('citizens');
    const tab = document.querySelector<HTMLElement>('.pv-tab[data-view="flowchart"]');
    if (!tab) throw new Error('flowchart tab not found');
    const spy = vi.fn();
    tab.addEventListener('click', spy);

    pressKey('f');

    expect(spy).not.toHaveBeenCalled();
  });
});

// =============================================================================
// ? — guide button
// =============================================================================

describe('Hotkeys — guide', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    createTabBar();
    initHotkeys();
  });

  afterEach(() => {
    destroyHotkeys();
  });

  it('? key clicks guide button when present', () => {
    const guideBtn = document.createElement('button');
    guideBtn.id = 'guide-btn';
    document.body.appendChild(guideBtn);

    const spy = vi.fn();
    guideBtn.addEventListener('click', spy);

    pressKey('?');

    expect(spy).toHaveBeenCalledOnce();
  });

  it('? key does nothing when guide button absent', () => {
    expect(() => pressKey('?')).not.toThrow();
  });
});
