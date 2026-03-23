// active-crafts.ts -- polls /api/crafts for in-progress work on this claim
//
// lifecycle: start(el, claimId) -> poll -> render -> wait -> repeat
// stop() is idempotent. pauses when tab is hidden, resumes when visible.

import { API } from './api.js';
import { createLogger } from './logger.js';
import * as Overview from './overview.js';

const log = createLogger('ActiveCrafts');

const POLL_MS = 60_000;
const JITTER_MS = 10_000;
const MIN_POLL_MS = 15_000;
const FINISHING_SOON_MS = 10 * 60 * 1000;

// game skill IDs. same source as Jaruud's Google Apps Script.
// skillMap in the API response is sometimes empty so keep this one.
const SKILL_NAMES: Record<number, string> = {
  2: 'Forestry',
  3: 'Carpentry',
  4: 'Masonry',
  5: 'Mining',
  6: 'Smithing',
  7: 'Scholar',
  8: 'Leatherwork',
  9: 'Hunting',
  10: 'Tailoring',
  11: 'Farming',
  12: 'Fishing',
  13: 'Cooking',
  14: 'Foraging',
  15: 'Construction',
  17: 'Taming',
  18: 'Slayer',
  19: 'Merchant',
  21: 'Sailing',
};

// -- types matching real API response from /api/crafts --

interface CraftResult {
  entityId: string;
  buildingEntityId: string;
  ownerEntityId: string;
  regionId: number;
  progress: number;
  recipeId: number;
  craftCount: number;
  lockExpiration: string;
  actionsRequiredPerItem: number;
  craftedItem: { item_id: number; quantity: number; item_type: string }[];
  levelRequirements: { level: number; skill_id: number }[];
  toolRequirements: { level: number; power: number; tool_type: number }[];
  experiencePerProgress: { quantity: number; skill_id: number }[];
  buildingName: string;
  ownerUsername: string;
  claimEntityId: string;
  claimName: string;
  totalActionsRequired: number;
  completed: boolean;
  isPublic: boolean;
}

interface CraftsApiItem {
  id: number;
  name: string;
  iconAssetName?: string;
  rarity?: number;
  rarityStr?: string;
  tier?: number;
  tag?: string;
}

interface CraftsResponse {
  craftResults: CraftResult[];
  items: CraftsApiItem[];
  cargos: unknown[];
  claims: unknown[];
  skillMap: Record<string, never>;
}

// what is actually render
interface CraftRow {
  outputName: string;
  tier: number;
  craftCount: number;
  building: string;
  worker: string;
  progress: number; // 0-1
  lockExpiry: number; // unix ms
  skillName: string;
}

// -- state --

let timer: ReturnType<typeof setTimeout> | null = null;
let polling = false;
let lastPoll = 0;
let claimId: string | null = null;
let container: HTMLElement | null = null;

// -- public --

export function start(el: HTMLElement, claim: string): void {
  stop();
  container = el;
  claimId = claim;
  polling = true;
  lastPoll = 0;
  container.innerHTML = '<div class="ac-loading">fetching active crafts...</div>';
  poll();
  document.addEventListener('visibilitychange', onVisibility);
  log.info(`Started for claim ${claim}`);
}

export function stop(): void {
  polling = false;
  killTimer();
  document.removeEventListener('visibilitychange', onVisibility);
}

// -- polling --

function killTimer(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

function scheduleNext(): void {
  if (!polling) return;
  const jitter = Math.round((Math.random() - 0.5) * 2 * JITTER_MS);
  timer = setTimeout(poll, Math.max(MIN_POLL_MS, POLL_MS + jitter));
}

async function poll(): Promise<void> {
  if (!polling || !claimId || !container) return;
  killTimer();
  lastPoll = Date.now();

  try {
    // the API returns crafts across all claims in the region.
    // filter client-side by claimEntityId.
    const data = await API.fetch<CraftsResponse>(`/crafts?completed=false`);
    if (!polling) return;

    const rows = parse(data, claimId);
    render(rows);

    const soon = rows.filter((r) => r.lockExpiry - Date.now() < FINISHING_SOON_MS).length;
    Overview.updateCraftCount(rows.length, soon);
    Overview.updateStationCrafts(rows.map((r) => r.building));
  } catch (err) {
    log.error('Poll failed:', (err as Error).message);
    if (container) {
      container.innerHTML = `<div class="ac-error">craft poll failed: ${(err as Error).message}</div>`;
    }
  }

  scheduleNext();
}

function onVisibility(): void {
  if (document.hidden) {
    killTimer();
  } else if (polling) {
    if (Date.now() - lastPoll >= POLL_MS) poll();
    else scheduleNext();
  }
}

// -- parsing --
// filters to our claim, builds item name lookup from response,
// sorts soonest-done first.

function parse(data: CraftsResponse, forClaim: string): CraftRow[] {
  const itemNames = new Map<number, { name: string; tier: number }>();
  for (const item of data.items) {
    itemNames.set(item.id, { name: item.name, tier: item.tier ?? 0 });
  }

  return data.craftResults
    .filter((c) => c.claimEntityId === forClaim && !c.completed)
    .map((c) => {
      // first crafted item is the output
      const outputId = c.craftedItem[0]?.item_id ?? 0;
      const itemInfo = itemNames.get(outputId);
      // skill comes from levelRequirements -- first entry is the primary skill
      const skillId = c.levelRequirements[0]?.skill_id ?? 0;

      return {
        outputName: itemInfo?.name ?? `item #${outputId}`,
        tier: itemInfo?.tier ?? 0,
        craftCount: c.craftCount,
        building: c.buildingName,
        worker: c.ownerUsername,
        progress: c.totalActionsRequired > 0 ? c.progress / c.totalActionsRequired : 0,
        lockExpiry: new Date(c.lockExpiration).getTime(),
        skillName: SKILL_NAMES[skillId] ?? `skill ${skillId}`,
      };
    })
    .sort((a, b) => a.lockExpiry - b.lockExpiry);
}

// -- rendering --

function formatRemaining(expiryMs: number): string {
  const diff = expiryMs - Date.now();
  if (diff <= 0) return 'done';
  const sec = Math.floor(diff / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function progressClass(pct: number): string {
  if (pct >= 1) return 'complete';
  if (pct >= 0.75) return 'almost';
  return '';
}

// specifier index -> tier number for buildings
const SPECIFIER_TIER: Record<string, number> = {
  rough: 1,
  basic: 2,
  simple: 3,
  sturdy: 4,
  fine: 5,
  exquisite: 6,
  peerless: 7,
  ornate: 8,
  pristine: 9,
  flawless: 10,
  magnificent: 11,
};

// "Fine Mining Station" -> "T5 Mining"
function shortStation(name: string): string {
  const words = name.split(/\s+/);
  let tier = 0;
  const kept: string[] = [];
  for (const w of words) {
    const t = SPECIFIER_TIER[w.toLowerCase()];
    if (t) {
      tier = t;
      continue;
    }
    if (w.toLowerCase() === 'station') continue;
    kept.push(w);
  }
  const prefix = tier > 0 ? `T${tier} ` : '';
  return prefix + kept.join(' ');
}

function render(rows: CraftRow[]): void {
  if (!container) return;

  if (rows.length === 0) {
    container.innerHTML = '<div class="ac-empty">no active crafts</div>';
    return;
  }

  const html = rows
    .map((r) => {
      const pct = Math.round(r.progress * 100);
      const cls = progressClass(r.progress);
      const tierBit = r.tier > 0 ? `T${r.tier} ` : '';
      const station = shortStation(r.building);

      // distinguish truly done (progress >= 100%) from idle (lock expired)
      let remaining: string;
      let timeCls: string;
      if (r.progress >= 1) {
        remaining = 'done';
        timeCls = 'ac-time done';
      } else {
        const diff = r.lockExpiry - Date.now();
        if (diff <= 0) {
          remaining = 'idle';
          timeCls = 'ac-time idle';
        } else {
          remaining = formatRemaining(r.lockExpiry);
          timeCls = 'ac-time';
        }
      }

      return `<tr>
      <td class="ac-vbar-cell">
        <div class="ac-vbar">
          <div class="ac-vbar-fill ${cls}" style="height:${pct}%"></div>
        </div>
      </td>
      <td class="ac-output">${tierBit}${r.outputName} <span class="ac-qty">x${r.craftCount}</span></td>
      <td class="ac-station">${station}</td>
      <td class="ac-worker">${r.worker || '\u2014'}</td>
      <td class="r ${timeCls}">${remaining}</td>
    </tr>`;
    })
    .join('');

  container.innerHTML = `
    <table class="ac-table">
      <thead><tr>
        <th style="width:6px"></th>
        <th>Output</th>
        <th>Station</th>
        <th>Worker</th>
        <th class="r">Time</th>
      </tr></thead>
      <tbody>${html}</tbody>
    </table>`;
}
