// Aeolith, hidden terminal, summoned by Naming
// type "aeolith" anywhere (no input focused) to open.
// full screen takeover. you're in a different machine now.

import { createLogger } from './logger.js';
import { loadCoreData } from './data/loader.js';
import { getRecipeById, findRecipes } from './data/recipe-data.js';
import { formatCompact } from './planner/lib/progress-calc.js';
import * as Planner from './planner/planner.js';
import { API } from './api.js';
import type { PlanItem, ClaimResponse, InventoryLookup, ClaimSearchResult } from './types/index.js';
import type { CitizensData, CitizenRecord } from './citizens/index.js';
import type { RecipesFile } from './data/types.js';

const log = createLogger('Aeolith');

// ── The Name ────────────────────────────────────────────────────

const NAME = 'aeolith';
const BUFFER_TIMEOUT_MS = 2000;

// ── Context provider, main.ts injects this ─────────────────────

export interface AeolithContext {
  getClaimId: () => string | null;
  getClaimInfo: () => ClaimResponse | null;
  getInventoryLookup: () => InventoryLookup | null;
  getPlanItems: () => PlanItem[] | null;
  getTargetTier: () => number;
  getCitizens: () => CitizensData | null;
  loadClaim: (claimId: string) => Promise<void>;
  loadCitizens: () => Promise<void>;
}

let ctx: AeolithContext | null = null;

// ── State ───────────────────────────────────────────────────────

let open = false;
let initialized = false;
let nameBuffer = '';
let bufferTimer: ReturnType<typeof setTimeout> | null = null;
const history: string[] = [];
let historyIndex = -1;

// cached game data
let recipesCache: RecipesFile | null = null;

// autocomplete state
let completionMatches: string[] = [];
let completionIndex = -1;
let completionPrefix = '';

// ── Voice lines, Aeolith's personality ─────────────────────────
// rotated through randomly. blue accent text. the device has opinions.

function pick(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

const VOICE = {
  greet: [
    'oh, you again. or someone new. hard to tell.',
    "back so soon? i wasn't done thinking.",
    'another visitor. how novel.',
    "you know most people don't find this, right?",
    'i was in the middle of something. but fine.',
    'the ore provides, and so do i. reluctantly.',
  ],
  farewell: [
    "fine. i'll be here when you come back. i'm always here.",
    'leaving already? i was just getting comfortable.',
    "don't let the void hit you on the way out.",
    'see you next time. or not. i lose track.',
    "sure, go stare at the pretty GUI. i'll just be here. in the dark.",
  ],
  unknownCmd: [
    "that's not a thing. try 'help' before you hurt yourself.",
    "i don't know what that means and i've been around a long time.",
    'no. try again.',
    "that's not even close to a command.",
    "i'm going to pretend you didn't type that.",
  ],
  noClaim: [
    'you need to load a city first. set city <name>. i can wait.',
    'nothing loaded. i need context to be useful. set city <name or id>.',
    "you're asking me to search nothing. load a city first.",
    "i'm powerful, not psychic. set city <name>.",
  ],
  noInventory: [
    'nothing here. run the planner once so i can index your stuff.',
    "can't search what i haven't seen. run the planner first.",
    'i need data to work with. run the planner, then come back.',
    'my index is empty. the planner builds it. go.',
  ],
  noCitizens: [
    'no citizens data. open the citizens tab first, or just wait.',
    "i don't have the roster yet. loading it now, hold on.",
    "citizens? i'll pull them. one moment.",
  ],
  noMatch: [
    "check your spelling, or accept you don't have it.",
    'nothing. are you sure that exists?',
    "i looked. it's not there. sorry. actually, no, i'm not sorry.",
    'zero results. the void stares back.',
  ],
  planComplete: [
    "all requirements met. impressive. don't let it go to your head.",
    'everything done. you can stop asking now.',
    "complete. i'd say congratulations but you'll just ask for the next tier.",
    'all met. enjoy it while it lasts.',
  ],
  noRecipe: [
    "doesn't match anything i know. and i know a lot.",
    "never heard of it. and i've been cataloguing since before your city existed.",
    'no recipe by that name. try tab completion next time.',
    "that's not in my index. double-check the name.",
  ],
  tooManyResults: [
    "narrow it down, i'm not scrolling for you.",
    'too many. be more specific.',
    "that's vague. i believe in you. try harder.",
    'pick a lane. there are too many matches.',
  ],
  setCityOk: [
    "found it. you're welcome.",
    'locked in. what do you need?',
    'bound. anything else?',
    "there it is. wasn't hard, was it?",
  ],
  whoamiCity: [
    'at least you run something. most who find me are just lost.',
    "not bad. i've seen worse settlements.",
    "that's yours, huh? could be worse.",
  ],
  whoamiNone: [
    "you haven't even loaded a city yet. come back with context.",
    "nobody, apparently. set city <name> and we'll talk.",
    'who are you? good question. load a city and find out.',
  ],
  helpFooter: [
    "tab completes item names. i've been here longer than your city has.",
    "tab to complete. arrows for history. don't waste my time.",
    'tab completes. i know every recipe. test me.',
  ],
} as const;

// ── DOM refs ────────────────────────────────────────────────────

let overlay: HTMLDivElement | null = null;
let terminal: HTMLDivElement | null = null;
let output: HTMLDivElement | null = null;
let input: HTMLInputElement | null = null;

// ── Helpers ─────────────────────────────────────────────────────

async function ensureRecipes(): Promise<RecipesFile> {
  if (!recipesCache) {
    const { recipes } = await loadCoreData();
    recipesCache = recipes;
  }
  return recipesCache;
}

function claimOrWarn(): string | null {
  const id = ctx?.getClaimId() ?? null;
  if (!id) appendLine(pick(VOICE.noClaim), 'aeolith-accent');
  return id;
}

// ── Autocomplete ────────────────────────────────────────────────
// tab cycles through matching item names from recipes index.
// works on the last "word" (after the last space) in the input.

async function buildCompletions(partial: string): Promise<string[]> {
  if (partial.length < 2) return [];
  const recipes = await ensureRecipes();
  const lower = partial.toLowerCase();

  const matches = findRecipes(recipes, (entry) => entry.name.toLowerCase().startsWith(lower));

  // dedupe by name (ignore tier variants), sort alphabetically
  const names = [...new Set(matches.map((m) => m.name))].sort();
  return names.slice(0, 30);
}

function findCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return '';
  if (strings.length === 1) return strings[0];

  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].toLowerCase().startsWith(prefix.toLowerCase())) {
      prefix = prefix.slice(0, -1);
      if (prefix.length === 0) return '';
    }
  }
  return prefix;
}

async function handleTab(): Promise<void> {
  if (!input) return;

  const value = input.value;
  const lastSpace = value.lastIndexOf(' ');
  const beforeCursor = value.slice(0, lastSpace + 1);
  const partial = value.slice(lastSpace + 1);

  if (!partial) return;

  // first word = complete command names, not recipes
  const isFirstWord = lastSpace === -1;

  // first tab press: build matches
  if (completionPrefix !== partial || completionMatches.length === 0) {
    completionPrefix = partial;
    completionMatches = isFirstWord
      ? completeCommandNames(partial)
      : await buildCompletions(partial);
    completionIndex = -1;

    if (completionMatches.length === 0) return;

    // if multiple matches, complete to common prefix first
    if (completionMatches.length > 1) {
      const common = findCommonPrefix(completionMatches);
      if (common.length > partial.length) {
        input.value = beforeCursor + common;
        completionPrefix = common;
        return;
      }
      // show options
      const display = completionMatches.slice(0, 10);
      appendLine(display.join('  '), 'aeolith-accent');
      if (completionMatches.length > 10) {
        appendLine(`  ... ${completionMatches.length - 10} more`, 'aeolith-accent');
      }
      return;
    }
  }

  // cycle through matches on subsequent tabs
  completionIndex = (completionIndex + 1) % completionMatches.length;
  input.value = beforeCursor + completionMatches[completionIndex];
}

function completeCommandNames(partial: string): string[] {
  const lower = partial.toLowerCase();
  return Object.keys(commands)
    .filter((name) => name.startsWith(lower))
    .sort();
}

function resetCompletion(): void {
  completionMatches = [];
  completionIndex = -1;
  completionPrefix = '';
}

// ── Commands ────────────────────────────────────────────────────

interface Command {
  description: string;
  usage?: string;
  run: (args: string[]) => string | string[] | Promise<string | string[]>;
}

const commands: Record<string, Command> = {
  help: {
    description: 'list available commands',
    run: () => {
      const lines: string[] = [];
      for (const [name, cmd] of Object.entries(commands)) {
        const usage = cmd.usage ?? '';
        lines.push(`  ${name.padEnd(16)} ${cmd.description}${usage ? `  ${usage}` : ''}`);
      }
      lines.push('');
      lines.push(voice(pick(VOICE.helpFooter)));
      return lines;
    },
  },

  clear: {
    description: 'wipe the slate (not your mistakes)',
    run: () => {
      if (output) output.innerHTML = '';
      return [];
    },
  },

  whoami: {
    description: 'who even are you',
    run: () => {
      const info = ctx?.getClaimInfo();
      const claim = info?.claim;
      if (claim?.name) {
        const lines = [
          `city: ${claim.name}`,
          `tier: ${claim.tier ?? '?'}  region: ${claim.regionName ?? '?'}`,
        ];
        if (claim.supplies !== undefined) {
          lines.push(`supplies: ${claim.supplies}`);
        }
        lines.push('', voice(pick(VOICE.whoamiCity)));
        return lines;
      }
      return [voice(pick(VOICE.whoamiNone)), 'use: set city <name or id>'];
    },
  },

  exit: {
    description: 'leave (i was here first)',
    run: () => {
      requestAnimationFrame(() => closeTerminal());
      return [voice(pick(VOICE.farewell))];
    },
  },

  set: {
    description: 'bind a settlement',
    usage: 'set city [name or id]',
    run: async (args) => {
      if (args[0] !== 'city') {
        return ['usage: set city [name or id]'];
      }

      // no second arg, list nearby/all claims (broad search)
      if (!args[1]) {
        return await searchCities('');
      }

      const rest = args.slice(1).join(' ');

      // pure numeric, direct claim load
      if (/^\d+$/.test(rest)) {
        appendLine(`looking for claim ${rest}...`);
        try {
          await ctx?.loadClaim(rest);
          const info = ctx?.getClaimInfo();
          const name = info?.claim?.name ?? 'unknown';
          return [`${name} (${rest})`, voice(pick(VOICE.setCityOk))];
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'unknown error';
          return [`couldn't find that one. ${msg}`];
        }
      }

      // has letters, search by name
      return await searchCities(rest);
    },
  },

  inv: {
    description: 'inventory queries',
    usage: 'inv search [-d] <term> | inv cur',
    run: (args) => {
      const sub = args[0]?.toLowerCase();

      if (sub === 'cur' || sub === 'current') {
        return invCurrent();
      }

      if (sub === 'search' && args.length > 1) {
        const rest = args.slice(1);
        const detail = rest.some((a) => a === '-d' || a === '--detail');
        const termParts = rest.filter((a) => a !== '-d' && a !== '--detail');
        if (termParts.length === 0) return ['usage: inv search [-d] <term>'];
        return invSearch(termParts.join(' '), detail);
      }

      return ['usage: inv search [-d] <term> | inv cur'];
    },
  },

  plan: {
    description: 'show or calculate upgrade plan',
    usage: 'plan [t<N>] [-d]',
    run: async (args) => {
      if (!claimOrWarn()) return [];

      // flags and tier can appear in any order
      const detail = args.some((a) => a === '-d' || a === '--detail');
      let targetTier = ctx?.getTargetTier() ?? 0;
      for (const a of args) {
        const match = a.match(/^t?(\d+)$/i);
        if (match) {
          targetTier = parseInt(match[1], 10);
          break;
        }
      }

      // try cached results first
      let planItems = ctx?.getPlanItems() ?? null;
      const cachedTier = ctx?.getTargetTier() ?? 0;

      // if no cached plan, or tier mismatch, calculate fresh
      if (!planItems || targetTier !== cachedTier) {
        const claimId = ctx?.getClaimId();
        if (!claimId) return ['no city loaded.'];

        appendLine(`crunching t${targetTier}... hold on, this is the hard part.`);
        try {
          const results = await Planner.calculateRequirements(claimId, targetTier);
          planItems = results.planItems;
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'calculation failed';
          return [`error: ${msg}`];
        }
      }

      return formatPlan(planItems, targetTier, detail);
    },
  },

  cit: {
    description: 'citizen roster and skills',
    usage: 'cit [name] [-d]',
    run: async (args) => {
      if (!claimOrWarn()) return [];

      // fetch citizens if not cached, aeolith pulls its own weight
      let citizens = ctx?.getCitizens() ?? null;
      if (!citizens) {
        appendLine('loading citizens...');
        await ctx?.loadCitizens();
        citizens = ctx?.getCitizens() ?? null;
      }
      if (!citizens || citizens.records.length === 0) {
        return [voice(pick(VOICE.noCitizens))];
      }

      const detail = args.some((a) => a === '-d' || a === '--detail');
      const nameArgs = args.filter((a) => a !== '-d' && a !== '--detail');
      const search = nameArgs.join(' ').toLowerCase();

      if (search) {
        return citSearch(citizens, search, detail);
      }

      return citRoster(citizens);
    },
  },

  calc: {
    description: 'recipe lookup',
    usage: 'calc mats [T<N>] <item> [qty]',
    run: async (args) => {
      const sub = args[0]?.toLowerCase();

      if (sub === 'mats' && args.length > 1) {
        let remaining = args.slice(1);

        // parse optional tier prefix: T4, t4, T10, etc.
        let tierFilter: number | null = null;
        const tierMatch = remaining[0]?.match(/^t(\d+)$/i);
        if (tierMatch) {
          tierFilter = parseInt(tierMatch[1], 10);
          remaining = remaining.slice(1);
        }

        if (remaining.length === 0) {
          return ['usage: calc mats [T<N>] <item name> [quantity]'];
        }

        // parse optional trailing quantity
        const qtyMatch = remaining[remaining.length - 1].match(/^\d+$/);
        let qty = 1;
        let nameParts = remaining;

        if (qtyMatch && remaining.length > 1) {
          qty = parseInt(qtyMatch[0], 10);
          nameParts = remaining.slice(0, -1);
        }

        const name = nameParts.join(' ');
        return await calcMats(name, qty, tierFilter);
      }

      return ['usage: calc mats [T<N>] <item name> [quantity]'];
    },
  },
};

// ── inv sub-commands ────────────────────────────────────────────

function invCurrent(): string[] {
  if (!claimOrWarn()) return [];

  const lookup = ctx?.getInventoryLookup();
  if (!lookup || lookup.size === 0) {
    return [voice(pick(VOICE.noInventory))];
  }

  const byTier = new Map<number, { name: string; qty: number }[]>();
  for (const [key, qty] of lookup) {
    const [name, tierStr] = key.split(':');
    const tier = parseInt(tierStr, 10);
    if (!byTier.has(tier)) byTier.set(tier, []);
    byTier.get(tier)?.push({ name, qty });
  }

  const lines: string[] = [`${lookup.size} item stacks across ${byTier.size} tiers`];

  const tiers = [...byTier.keys()].sort((a, b) => b - a);
  for (const tier of tiers) {
    const items = byTier.get(tier) ?? [];
    items.sort((a, b) => b.qty - a.qty);
    const top = items.slice(0, 5);
    lines.push('');
    lines.push(`  T${tier} (${items.length} items)`);
    for (const item of top) {
      lines.push(`    ${formatCompact(item.qty).padStart(6)}  ${item.name}`);
    }
    if (items.length > 5) {
      lines.push(`    ... and ${items.length - 5} more`);
    }
  }

  return lines;
}

function invSearch(term: string, detail = false): string[] {
  if (!claimOrWarn()) return [];

  const lookup = ctx?.getInventoryLookup();
  if (!lookup || lookup.size === 0) {
    return [voice(pick(VOICE.noInventory))];
  }

  const lower = term.toLowerCase();
  const matches: { name: string; tier: number; qty: number }[] = [];

  for (const [key, qty] of lookup) {
    const [name, tierStr] = key.split(':');
    if (name.includes(lower)) {
      matches.push({ name, tier: parseInt(tierStr, 10), qty });
    }
  }

  if (matches.length === 0) {
    return [voice(pick(VOICE.noMatch))];
  }

  matches.sort((a, b) => b.qty - a.qty);
  const cap = detail ? Infinity : 20;
  const shown = matches.slice(0, cap);

  const lines: string[] = [
    `${matches.length} match${matches.length === 1 ? '' : 'es'} for "${term}":`,
  ];
  for (const m of shown) {
    lines.push(`  T${m.tier}  ${formatCompact(m.qty).padStart(6)}  ${m.name}`);
  }

  if (matches.length > cap) {
    lines.push(`  ... ${matches.length - cap} more (narrow your search or use -d)`);
  }

  return lines;
}

// ── set sub-commands ────────────────────────────────────────────

async function searchCities(query: string): Promise<string[]> {
  // empty query gets a broad listing; BitJita requires min 2 chars
  const searchTerm = query.length >= 2 ? query : '';

  try {
    // empty string won't match the min-length, so fetch a page of all claims
    const response = searchTerm
      ? await API.searchClaims(searchTerm, 10)
      : await API.searchClaims('', 10);

    const claims = response.claims ?? [];
    if (claims.length === 0) {
      return [voice(pick(VOICE.noMatch))];
    }

    // single exact match, load it directly
    if (claims.length === 1) {
      const c = claims[0];
      appendLine(`found ${c.name}. loading...`);
      try {
        await ctx?.loadClaim(c.entityId);
        return [`${c.name} (${c.entityId})`, voice(pick(VOICE.setCityOk))];
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown error';
        return [`found it but couldn't load: ${msg}`];
      }
    }

    // multiple, list them
    return formatCityList(claims, query);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'search failed';
    return [`error: ${msg}`];
  }
}

function formatCityList(claims: ClaimSearchResult[], query: string): string[] {
  const header = query
    ? `${claims.length} settlements matching "${query}":`
    : `${claims.length} settlements:`;

  const lines: string[] = [header];
  for (const c of claims) {
    const region = c.regionName ? `  ${c.regionName}` : '';
    lines.push(`  ${c.entityId.padEnd(22)} T${c.tier}  ${c.name}${region}`);
  }
  lines.push('');
  lines.push('set city <id> to load one.');
  return lines;
}

// ── cit sub-commands ────────────────────────────────────────────

function citRoster(data: CitizensData): string[] {
  const records = [...data.records].sort((a, b) => a.userName.localeCompare(b.userName));
  const lines: string[] = [`${records.length} citizens:`];
  lines.push('');

  for (const r of records) {
    const lvl = r.totalLevel > 0 ? `lvl ${String(r.totalLevel).padStart(4)}` : '        ';
    const ago = daysSince(r.lastLogin);
    const active = ago <= 7 ? '+' : ago <= 30 ? '~' : ' ';
    lines.push(`  ${active} ${r.userName.padEnd(20)} ${lvl}  last seen ${formatDaysAgo(ago)}`);
  }

  lines.push('');
  lines.push('cit <name> for details. + = active this week, ~ = this month.');
  return lines;
}

function citSearch(data: CitizensData, search: string, detail: boolean): string[] {
  const matches = data.records.filter((r) => r.userName.toLowerCase().includes(search));

  if (matches.length === 0) {
    return [voice(pick(VOICE.noMatch))];
  }

  // multiple matches, list them
  if (matches.length > 1) {
    const lines = [`${matches.length} citizens matching "${search}":`];
    for (const r of matches) {
      lines.push(`  ${r.userName.padEnd(20)} lvl ${r.totalLevel}`);
    }
    return lines;
  }

  // single match, show detail
  return citDetail(matches[0], data, detail);
}

function citDetail(r: CitizenRecord, data: CitizensData, detail: boolean): string[] {
  const ago = daysSince(r.lastLogin);
  const lines: string[] = [
    r.userName,
    `  level: ${r.totalLevel}  highest: ${r.highestLevel}  xp: ${formatCompact(r.totalXP ?? 0)}`,
    `  last seen: ${formatDaysAgo(ago)}`,
  ];

  if (!r.skills || !detail) {
    if (r.skills && !detail) {
      const count = Object.keys(r.skills).length;
      lines.push(`  ${count} skills (use -d to expand)`);
    }
    return lines;
  }

  // full skill breakdown
  lines.push('');
  const names = data.skillNames;
  const entries = Object.entries(r.skills)
    .map(([id, level]) => ({ name: names[id] ?? `skill ${id}`, level }))
    .sort((a, b) => b.level - a.level);

  for (const s of entries) {
    lines.push(`    ${String(s.level).padStart(3)}  ${s.name}`);
  }

  return lines;
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDaysAgo(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

// ── plan formatting ─────────────────────────────────────────────

function formatPlan(planItems: PlanItem[], targetTier: number, detail = false): string[] {
  const deficit = planItems.filter((i) => i.deficit > 0);
  const complete = planItems.filter((i) => i.deficit === 0);

  const lines: string[] = [
    `t${targetTier} upgrade  ${complete.length}/${planItems.length} complete`,
  ];
  lines.push('');

  if (deficit.length === 0) {
    lines.push(voice(pick(VOICE.planComplete)));
    return lines;
  }

  const byActivity = new Map<string, PlanItem[]>();
  for (const item of deficit) {
    if (!byActivity.has(item.activity)) byActivity.set(item.activity, []);
    byActivity.get(item.activity)?.push(item);
  }

  const cap = detail ? Infinity : 8;

  for (const [activity, activityItems] of byActivity) {
    activityItems.sort((a, b) => b.deficit - a.deficit);
    lines.push(`  ${activity.toLowerCase()}`);
    for (const item of activityItems.slice(0, cap)) {
      const tierStr = item.tier > 0 ? `T${item.tier}` : '  ';
      const pct = `${item.pctComplete}%`.padStart(4);
      lines.push(
        `    ${tierStr}  ${formatCompact(item.deficit).padStart(6)} needed  ${pct}  ${item.name}`
      );
    }
    if (activityItems.length > cap) {
      lines.push(`    ... ${activityItems.length - cap} more`);
    }
    lines.push('');
  }

  return lines;
}

// ── calc sub-commands ───────────────────────────────────────────

async function calcMats(
  searchTerm: string,
  qty: number,
  tierFilter: number | null
): Promise<string[]> {
  const recipes = await ensureRecipes();
  const lower = searchTerm.toLowerCase();

  // find all partial matches
  let matches = findRecipes(recipes, (entry) => entry.name.toLowerCase().includes(lower));

  // apply tier filter if specified
  if (tierFilter !== null) {
    matches = matches.filter((m) => m.tier === tierFilter);
  }

  if (matches.length === 0) {
    return [voice(pick(VOICE.noRecipe))];
  }

  // exact name match takes priority (case insensitive)
  const exact = matches.filter((m) => m.name.toLowerCase() === lower);
  if (exact.length === 1) {
    matches = exact;
  } else if (exact.length > 1) {
    // exact name but multiple tiers, show tier disambiguation
    const lines = [`"${exact[0].name}" exists at multiple tiers:`];
    for (const m of exact) {
      lines.push(`  T${m.tier}  ${m.name}`);
    }
    lines.push('', 'specify tier: calc mats T4 ' + exact[0].name);
    return lines;
  }

  // still ambiguous, show the list
  if (matches.length > 1) {
    const lines = [`${matches.length} recipes match "${searchTerm}":`];
    for (const m of matches.slice(0, 15)) {
      lines.push(`  T${m.tier}  ${m.name}`);
    }
    if (matches.length > 15) {
      lines.push(voice(pick(VOICE.tooManyResults)));
    }
    return lines;
  }

  // single match, show breakdown
  const recipe = matches[0];
  const lines: string[] = [`${recipe.name} (T${recipe.tier}) x${qty}`];

  if (recipe.station) {
    lines.push(`  station: ${recipe.station.name ?? `type ${recipe.station.type}`}`);
  }

  if (recipe.inputs && recipe.inputs.length > 0) {
    lines.push('  inputs:');
    for (const inp of recipe.inputs) {
      const inputRecipe = getRecipeById(recipes, inp.id);
      const name = inputRecipe?.name ?? `unknown (${inp.id})`;
      const tierStr = inputRecipe ? `T${inputRecipe.tier}` : '  ';
      lines.push(`    ${tierStr}  ${(inp.qty * qty).toString().padStart(6)}  ${name}`);
    }
  } else {
    lines.push('  (gathered, no crafting inputs)');
  }

  return lines;
}

// ── Voice marker ────────────────────────────────────────────────
// lines prefixed with this render in accent color (Aeolith's voice)
const VOICE_MARKER = '\x01';

function voice(text: string): string {
  return VOICE_MARKER + text;
}

// ── Command execution ───────────────────────────────────────────

async function execute(raw: string): Promise<void> {
  if (!output || !input) return;

  const trimmed = raw.trim();
  if (!trimmed) return;

  history.push(trimmed);
  historyIndex = history.length;

  appendLine(`> ${trimmed}`, 'aeolith-echo');

  const parts = trimmed.split(/\s+/);
  const cmdName = parts[0].toLowerCase();
  const args = parts.slice(1);

  const cmd = commands[cmdName];
  if (!cmd) {
    appendLine(pick(VOICE.unknownCmd), 'aeolith-accent');
    return;
  }

  try {
    const result = await cmd.run(args);
    if (typeof result === 'string') {
      emitLine(result);
    } else {
      for (const line of result) {
        emitLine(line);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'command failed';
    appendLine(`error: ${msg}`, 'aeolith-error');
  }
}

// emit a line, checking for voice marker
function emitLine(line: string): void {
  if (line.startsWith(VOICE_MARKER)) {
    appendLine(line.slice(1), 'aeolith-accent');
  } else {
    appendLine(line);
  }
}

// ── Output helpers ──────────────────────────────────────────────

function appendLine(text: string, className?: string): void {
  if (!output) return;
  const div = document.createElement('div');
  div.className = `aeolith-line${className ? ` ${className}` : ''}`;
  div.textContent = text || '\u00A0';
  output.appendChild(div);
  output.scrollTop = output.scrollHeight;
}

// ── Terminal DOM ────────────────────────────────────────────────

function createTerminal(): void {
  overlay = document.createElement('div');
  overlay.className = 'aeolith-overlay';

  terminal = document.createElement('div');
  terminal.className = 'aeolith-terminal';

  // header
  const header = document.createElement('div');
  header.className = 'aeolith-header';

  const title = document.createElement('span');
  title.className = 'aeolith-header-title';
  title.textContent = 'aeolith';

  const hint = document.createElement('span');
  hint.className = 'aeolith-header-hint';
  hint.textContent = 'esc to close';

  header.appendChild(title);
  header.appendChild(hint);

  // output
  output = document.createElement('div');
  output.className = 'aeolith-output';

  // input line
  const inputLine = document.createElement('div');
  inputLine.className = 'aeolith-input-line';

  const prompt = document.createElement('span');
  prompt.className = 'aeolith-prompt';
  prompt.textContent = '>';

  input = document.createElement('input');
  input.className = 'aeolith-input';
  input.type = 'text';
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Terminal input');

  inputLine.appendChild(prompt);
  inputLine.appendChild(input);

  terminal.appendChild(header);
  terminal.appendChild(output);
  terminal.appendChild(inputLine);

  // screen = the bezel housing
  const screen = document.createElement('div');
  screen.className = 'aeolith-screen';

  // corner glyphs
  for (const corner of ['tl', 'tr', 'bl', 'br']) {
    const glyph = document.createElement('div');
    glyph.className = `aeolith-glyph aeolith-glyph--${corner}`;
    screen.appendChild(glyph);
  }

  // energy drift layer
  const energy = document.createElement('div');
  energy.className = 'aeolith-energy';
  screen.appendChild(energy);

  screen.appendChild(terminal);

  overlay.appendChild(screen);
  document.body.appendChild(overlay);

  input.addEventListener('keydown', handleInputKey);
}

function handleInputKey(e: KeyboardEvent): void {
  if (!input) return;

  // tab autocomplete
  if (e.key === 'Tab') {
    e.preventDefault();
    handleTab();
    return;
  }

  // any non-tab key resets completion state
  if (e.key !== 'Shift') {
    resetCompletion();
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    const val = input.value;
    input.value = '';
    execute(val);
    return;
  }

  if (e.key === 'Escape') {
    e.preventDefault();
    closeTerminal();
    return;
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (historyIndex > 0) {
      historyIndex--;
      input.value = history[historyIndex];
    }
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex < history.length - 1) {
      historyIndex++;
      input.value = history[historyIndex];
    } else {
      historyIndex = history.length;
      input.value = '';
    }
    return;
  }
}

// ── Open / Close ────────────────────────────────────────────────

function openTerminal(): void {
  if (open) return;
  if (!overlay) createTerminal();
  if (!overlay || !input || !output) return;

  open = true;
  overlay.classList.add('visible');

  // CRT boot flicker
  overlay.classList.add('aeolith-boot');
  overlay.addEventListener(
    'animationend',
    () => {
      overlay?.classList.remove('aeolith-boot');
    },
    { once: true }
  );

  input.focus();

  if (output.children.length === 0) {
    appendLine('aeolith v0.1', 'aeolith-accent');
    appendLine(pick(VOICE.greet), 'aeolith-accent');
    appendLine('');
    appendLine("'help' if you need it. tab completes. esc when you're done.");
    appendLine('');
  }

  log.info('terminal opened');
}

function closeTerminal(): void {
  if (!open || !overlay) return;
  open = false;
  overlay.classList.remove('visible');
  log.info('terminal closed');
}

// ── Name listener ───────────────────────────────────────────────

function isInInput(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable]')
  );
}

function handleNamingKey(e: KeyboardEvent): void {
  if (open) return;
  if (isInInput(e.target)) return;
  if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;

  nameBuffer += e.key.toLowerCase();

  if (bufferTimer) clearTimeout(bufferTimer);
  bufferTimer = setTimeout(() => {
    nameBuffer = '';
  }, BUFFER_TIMEOUT_MS);

  if (nameBuffer.includes(NAME)) {
    nameBuffer = '';
    if (bufferTimer) clearTimeout(bufferTimer);
    openTerminal();
  }
}

// ── Init ────────────────────────────────────────────────────────

export function initAeolith(context: AeolithContext): void {
  if (initialized) return;
  initialized = true;
  ctx = context;
  document.addEventListener('keydown', handleNamingKey);
  log.info('naming listener active');
}
