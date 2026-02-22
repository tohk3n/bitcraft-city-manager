/**
 * Flowchart - Research tree visualization
 *
 * Renders the recipe tree with tabs, collapsible branches, and SVG connectors.
 */

import {
  formatCompact,
  calculatePlanProgress,
  generatePlanExportText,
} from './lib/progress-calc.js';
import { CONFIG } from '../configuration/config.js';
import type { ProcessedNode, PlanItem } from '../types/index.js';
import { applyTabA11y } from '../aria.js';

// Extended node type for tabs (includes optional isStudyJournals flag)
interface TabNode extends ProcessedNode {
  isStudyJournals?: boolean;
}

// Module state
let hideComplete = false;
let zoomLevel = 1;
const collapsedNodes = new Set<string>(); // Track collapsed nodes by "name:tier" key

/**
 * Render the flowchart view.
 */
export function render(
  container: HTMLElement,
  researches: ProcessedNode[],
  planItems: PlanItem[],
  targetTier: number,
  studyJournals: ProcessedNode | null = null
): void {
  if (!researches || researches.length === 0) {
    container.innerHTML = '<div class="fc-empty">No data</div>';
    return;
  }

  // Reset zoom on new render
  zoomLevel = 1;

  // Build combined tab list: researches + study journals (if present)
  const allTabs: TabNode[] = [...researches];
  if (studyJournals) {
    // Wrap studyJournals as a pseudo-research for consistent tab handling
    allTabs.push({
      ...studyJournals,
      name: 'Study Journals',
      isStudyJournals: true,
    });
  }

  const overall = calculatePlanProgress(planItems);

  container.innerHTML = `
    <div class="fc-header">
    <div class="fc-progress">
    <div class="fc-progress-bar">
    <div class="fc-progress-fill" style="width: ${overall.percent}%"></div>
    </div>
    <span class="fc-progress-pct">${overall.percent}%</span>
    </div>
    <div class="fc-progress-detail">${overall.completeCount}/${overall.totalItems} materials ready</div>
    <button class="fc-export" id="fc-export">Copy Task List</button>
    </div>
    <div class="fc-tabs" id="fc-tabs">
    ${allTabs
      .map(
        (r, i) => `
        <button class="fc-tab ${i === 0 ? 'active' : ''} ${r.isStudyJournals ? 'fc-tab-journals' : ''}" data-index="${i}">
        <span class="fc-tab-status ${r.status}"></span>
        ${formatTabName(r.name)}
        </button>
        `
      )
      .join('')}
        </div>
        <div class="fc-options">
        <label class="fc-toggle">
        <input type="checkbox" id="fc-hide-complete">
        <span>Hide completed branches</span>
        </label>
        </div>
        <div class="fc-viewport" id="fc-viewport">
        <div class="fc-zoom-controls">
        <button class="fc-zoom-btn" id="fc-zoom-out" title="Zoom out">&minus;</button>
        <span class="fc-zoom-level" id="fc-zoom-level">100%</span>
        <button class="fc-zoom-btn" id="fc-zoom-in" title="Zoom in">+</button>
        <button class="fc-zoom-btn fc-zoom-reset" id="fc-zoom-reset" title="Reset zoom">Reset</button>
        </div>
        <div class="fc-canvas" id="fc-canvas">
        <svg class="fc-svg" id="fc-svg"></svg>
        <div class="fc-tree" id="fc-tree"></div>
        </div>
        </div>
        <div class="fc-legend">
        <div class="fc-legend-item">
        <div class="fc-legend-color complete"></div>
        <span>Complete</span>
        </div>
        <div class="fc-legend-item">
        <div class="fc-legend-color partial"></div>
        <span>Partial</span>
        </div>
        <div class="fc-legend-item">
        <div class="fc-legend-color missing"></div>
        <span>Missing</span>
        </div>
        <div class="fc-legend-item fc-legend-spacer">
        <span class="fc-legend-dashed"></span>
        <span>Non-trackable</span>
        </div>
        </div>
        `;

  const fcTabContainer = container.querySelector<HTMLElement>('.fc-tabs');
  if (fcTabContainer) applyTabA11y(fcTabContainer, '.fc-tab');

  let activeIndex = 0;
  const treeEl = container.querySelector('#fc-tree') as HTMLElement;

  const renderTree = (): void => {
    treeEl.innerHTML = renderNode(allTabs[activeIndex], true, hideComplete);

    // Attach click handlers for collapsible nodes
    treeEl.querySelectorAll<HTMLElement>('.fc-node[data-key]').forEach((nodeEl) => {
      nodeEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = nodeEl.dataset.key;
        if (!key) return;

        if (collapsedNodes.has(key)) {
          collapsedNodes.delete(key);
        } else {
          collapsedNodes.add(key);
        }
        renderTree();
      });
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => drawConnections(container));
    });
  };

  // Initial render
  renderTree();

  // Tab switching
  container.querySelectorAll<HTMLElement>('.fc-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const index = parseInt(tab.dataset.index || '0', 10);
      if (index === activeIndex) return;

      activeIndex = index;
      container.querySelectorAll('.fc-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      renderTree();
    });
  });

  // Hide complete toggle
  container.querySelector('#fc-hide-complete')?.addEventListener('change', (e) => {
    hideComplete = (e.target as HTMLInputElement).checked;
    renderTree();
  });

  // Export button
  container.querySelector('#fc-export')?.addEventListener('click', () => {
    const text = generatePlanExportText(planItems, targetTier);
    navigator.clipboard.writeText(text).then(() => {
      const btn = container.querySelector('#fc-export');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => (btn.textContent = orig), 2000);
      }
    });
  });

  // Zoom controls
  const viewport = container.querySelector('#fc-viewport') as HTMLElement;
  const canvas = container.querySelector('#fc-canvas') as HTMLElement;
  const zoomLevelEl = container.querySelector('#fc-zoom-level') as HTMLElement;
  const { MIN, MAX, STEP, WHEEL_SENSITIVITY } = CONFIG.FLOWCHART_ZOOM;

  const applyZoom = (newZoom: number, smooth = true): void => {
    zoomLevel = Math.max(MIN, Math.min(MAX, newZoom));
    canvas.style.transition = smooth ? 'transform 0.15s ease' : 'none';
    canvas.style.transform = `scale(${zoomLevel})`;
    zoomLevelEl.textContent = `${Math.round(zoomLevel * 100)}%`;

    // Redraw connections after transform settles
    if (smooth) {
      setTimeout(() => drawConnections(container), 160);
    } else {
      requestAnimationFrame(() => drawConnections(container));
    }
  };

  container.querySelector('#fc-zoom-in')?.addEventListener('click', () => {
    applyZoom(zoomLevel + STEP);
  });

  container.querySelector('#fc-zoom-out')?.addEventListener('click', () => {
    applyZoom(zoomLevel - STEP);
  });

  container.querySelector('#fc-zoom-reset')?.addEventListener('click', () => {
    applyZoom(1);
  });

  // Wheel zoom (continuous, cursor-anchored)
  viewport.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      e.preventDefault();

      const oldZoom = zoomLevel;

      // Continuous zoom based on scroll delta magnitude
      // Normalize delta and scale for natural feel
      const delta = -e.deltaY * WHEEL_SENSITIVITY * oldZoom;
      const newZoom = Math.max(MIN, Math.min(MAX, zoomLevel + delta));

      if (newZoom === oldZoom) return;

      // Cursor position relative to viewport
      const rect = viewport.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      // Content point under cursor (in unscaled coordinates)
      const contentX = (viewport.scrollLeft + cursorX) / oldZoom;
      const contentY = (viewport.scrollTop + cursorY) / oldZoom;

      // Apply zoom
      applyZoom(newZoom, false);

      // Adjust scroll to keep content point under cursor
      viewport.scrollLeft = contentX * newZoom - cursorX;
      viewport.scrollTop = contentY * newZoom - cursorY;
    },
    { passive: false }
  );

  // Drag panning
  setupDragPan(viewport);

  // Redraw on resize
  window.addEventListener('resize', () => drawConnections(container));
}

/**
 * Format research name for tab display.
 */
function formatTabName(name: string): string {
  return name
    .replace(' Research', '')
    .replace(' Codex', '')
    .replace(/^(Novice|Apprentice|Journeyman|Expert|Master|Proficient) /, '');
}

/**
 * Render a node recursively.
 */
function renderNode(node: ProcessedNode, isRoot = false, hideComplete = false): string {
  const nodeKey = `${node.name}:${node.tier}`;
  const children = node.children || [];
  const hasChildren = children.length > 0;

  // Collapse completed non-root branches (existing behavior)
  if (hideComplete && node.status === 'complete' && !isRoot) {
    return `
        <div class="fc-node complete collapsed">
        <div class="fc-node-name">${node.name}</div>
        <div class="fc-node-meta">
        <span class="fc-node-tier">T${node.tier}</span>
        <span class="fc-node-check">&check;</span>
        </div>
        </div>
        `;
  }

  const pct =
    node.required > 0
      ? Math.round((Math.min(node.have, node.required) / node.required) * 100)
      : 100;
  const deficit = Math.max(0, node.required - node.have);

  // Check if this node is manually collapsed
  const isCollapsed = hasChildren && collapsedNodes.has(nodeKey);

  // Build classes and attributes
  const classes = [
    'fc-node',
    node.status,
    isRoot ? 'root' : '',
    !node.trackable ? 'non-trackable' : '',
    hasChildren ? 'collapsible' : '',
    isCollapsed ? 'is-collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const dataAttr = hasChildren ? `data-key="${nodeKey}"` : '';

  // Collapse indicator for nodes with children
  const collapseIndicator = hasChildren
    ? `<span class="fc-collapse-indicator">${isCollapsed ? '&#9654;' : '&#9660;'}</span>`
    : '';

  const nodeHtml = `
    <div class="${classes}" ${dataAttr}>
    ${deficit > 0 ? `<div class="fc-node-deficit">-${formatCompact(deficit)}</div>` : ''}
    <div class="fc-node-name">${collapseIndicator}${node.name}</div>
    <div class="fc-node-meta">
    <span class="fc-node-tier">T${node.tier}</span>
    <span class="fc-node-qty">
    <span class="fc-have">${formatCompact(node.have)}</span>
    <span class="fc-sep">/</span>
    <span class="fc-need">${formatCompact(node.required)}</span>
    </span>
    </div>
    <div class="fc-node-progress">
    <div class="fc-node-progress-fill" style="width: ${pct}%"></div>
    </div>
    </div>
    `;

  if (!hasChildren) {
    return nodeHtml;
  }

  // Filter children if hiding complete
  const visible = hideComplete
    ? children.filter((c) => c.status !== 'complete' || hasIncompleteDescendant(c))
    : children;

  if (visible.length === 0) {
    return nodeHtml;
  }

  // If collapsed, show summary cluster instead of children
  if (isCollapsed) {
    const summary = aggregateCollapsedChildren(visible);
    return `
        <div class="fc-group">
        ${nodeHtml}
        <div class="fc-children">
        ${renderCollapsedCluster(summary)}
        </div>
        </div>
        `;
  }

  return `
    <div class="fc-group">
    ${nodeHtml}
    <div class="fc-children">
    ${visible.map((c) => renderNode(c, false, hideComplete)).join('')}
    </div>
    </div>
    `;
}

/**
 * Check if a node has any incomplete descendants.
 */
function hasIncompleteDescendant(node: ProcessedNode): boolean {
  if (node.status !== 'complete') return true;
  return (node.children || []).some((c) => hasIncompleteDescendant(c));
}

/**
 * Aggregate stats from collapsed children for summary display.
 */
interface CollapsedSummary {
  totalItems: number;
  completeItems: number;
  totalRequired: number;
  totalHave: number;
  status: 'complete' | 'partial' | 'missing';
  types: Set<string>;
}

function aggregateCollapsedChildren(nodes: ProcessedNode[]): CollapsedSummary {
  const summary: CollapsedSummary = {
    totalItems: 0,
    completeItems: 0,
    totalRequired: 0,
    totalHave: 0,
    status: 'complete',
    types: new Set(),
  };

  function collect(node: ProcessedNode): void {
    summary.totalItems++;
    summary.totalRequired += node.required;
    summary.totalHave += Math.min(node.have, node.required);
    summary.types.add(node.mappingType || 'unknown');

    if (node.status === 'complete') {
      summary.completeItems++;
    } else if (node.status === 'missing') {
      summary.status = 'missing';
    } else if (node.status === 'partial' && summary.status !== 'missing') {
      summary.status = 'partial';
    }

    for (const child of node.children || []) {
      collect(child);
    }
  }

  for (const node of nodes) {
    collect(node);
  }

  // Determine final status
  if (summary.completeItems === summary.totalItems) {
    summary.status = 'complete';
  } else if (summary.totalHave > 0) {
    summary.status = 'partial';
  }

  return summary;
}

/**
 * Render a collapsed cluster summary node.
 */
function renderCollapsedCluster(summary: CollapsedSummary): string {
  const pct =
    summary.totalRequired > 0 ? Math.round((summary.totalHave / summary.totalRequired) * 100) : 100;

  const typeLabel = summary.types.has('gathered')
    ? summary.types.has('intermediate')
      ? 'Materials'
      : 'Gathered'
    : 'Intermediate';

  return `
    <div class="fc-node fc-cluster ${summary.status}">
    <div class="fc-cluster-icon">&hellip;</div>
    <div class="fc-node-name">${summary.totalItems} ${typeLabel}</div>
    <div class="fc-node-meta">
    <span class="fc-node-qty">${summary.completeItems}/${summary.totalItems} ready</span>
    </div>
    <div class="fc-node-progress">
    <div class="fc-node-progress-fill" style="width: ${pct}%"></div>
    </div>
    </div>
    `;
}

/**
 * Draw SVG connection lines.
 * Accounts for CSS transform scale on canvas.
 */
function drawConnections(container: HTMLElement): void {
  const svg = container.querySelector('#fc-svg');
  const canvas = container.querySelector('#fc-canvas');
  if (!svg || !canvas) return;

  svg.innerHTML = '';
  const canvasRect = canvas.getBoundingClientRect();

  // getBoundingClientRect returns scaled dimensions, so divide by zoomLevel
  // to get coordinates in the untransformed SVG space
  const scale = zoomLevel;

  container.querySelectorAll('.fc-group').forEach((group) => {
    const parent = group.querySelector(':scope > .fc-node');
    const childContainer = group.querySelector(':scope > .fc-children');
    if (!parent || !childContainer) return;

    const children = childContainer.querySelectorAll(
      ':scope > .fc-node, :scope > .fc-group > .fc-node'
    );
    if (children.length === 0) return;

    const parentRect = parent.getBoundingClientRect();
    const px = (parentRect.left + parentRect.width / 2 - canvasRect.left) / scale;
    const py = (parentRect.bottom - canvasRect.top) / scale;

    // Check if parent is collapsed
    const isParentCollapsed = parent.classList.contains('is-collapsed');

    children.forEach((child) => {
      const childRect = child.getBoundingClientRect();
      const cx = (childRect.left + childRect.width / 2 - canvasRect.left) / scale;
      const cy = (childRect.top - canvasRect.top) / scale;

      // Determine connector class based on child status and collapse state
      const statusClass = child.classList.contains('complete')
        ? 'complete'
        : child.classList.contains('partial')
          ? 'partial'
          : '';

      // Add collapsed class if parent is collapsed
      const collapsedClass = isParentCollapsed ? 'collapsed-connector' : '';

      const midY = (py + cy) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${px} ${py} C ${px} ${midY}, ${cx} ${midY}, ${cx} ${cy}`);
      path.classList.add('fc-connector');
      if (statusClass) path.classList.add(statusClass);
      if (collapsedClass) path.classList.add(collapsedClass);
      svg.appendChild(path);
    });
  });
}

/**
 * Setup click-and-drag panning.
 */
function setupDragPan(el: HTMLElement): void {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let scrollLeft = 0;
  let scrollTop = 0;

  el.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, input')) return;
    dragging = true;
    el.classList.add('dragging');
    startX = e.pageX - el.offsetLeft;
    startY = e.pageY - el.offsetTop;
    scrollLeft = el.scrollLeft;
    scrollTop = el.scrollTop;
    e.preventDefault();
  });

  el.addEventListener('mousemove', (e: MouseEvent) => {
    if (!dragging) return;
    const x = e.pageX - el.offsetLeft;
    const y = e.pageY - el.offsetTop;
    el.scrollLeft = scrollLeft - (x - startX) * 1.5;
    el.scrollTop = scrollTop - (y - startY) * 1.5;
  });

  el.addEventListener('mouseup', () => {
    dragging = false;
    el.classList.remove('dragging');
  });

  el.addEventListener('mouseleave', () => {
    dragging = false;
    el.classList.remove('dragging');
  });
}
