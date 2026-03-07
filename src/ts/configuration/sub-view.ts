// Profession sub-view configuration.
// Declarative definitions -- the transformer reads these to produce SubViewConfig.
// Adding a profession = adding a ProfessionDef. No transformer changes needed.

import type { RowSemantic } from '../components/sub-view';

export interface RowDef {
  source: 'tag' | 'name'; // tag matches by inventory tag, name matches exact item name
  key: string;
  label?: string; // display override, defaults to key.toLowerCase()
  cls?: RowSemantic;
}

export interface SectionDef {
  label: string;
  rows: RowDef[];
}

export interface ConsumableDef {
  name: string; // exact item name
  hint?: string;
}

export interface ProfessionDef {
  id: string; // matches data-view attribute on the tab button
  title: string; // used in copy text
  cargo: { name: string; tag: string } | null;
  consumables: ConsumableDef[];
  sections: SectionDef[];
  packages: string[]; // package names after tier specifier stripping
}

// shorthand builders
function tag(key: string, cls?: RowSemantic, label?: string): RowDef {
  return { source: 'tag', key, cls, label };
}

function name(key: string, cls?: RowSemantic, label?: string): RowDef {
  return { source: 'name', key, cls, label };
}

export const WOODWORKING: ProfessionDef = {
  id: 'woodworking-view',
  title: 'Woodworking',
  cargo: { name: 'trunk', tag: 'Trunk' },
  consumables: [{ name: 'Empty Bucket' }, { name: 'Water Bucket', hint: '-> provisions' }],
  sections: [
    {
      label: 'materials',
      rows: [
        tag('Wood Log'),
        tag('Stripped Wood'),
        tag('Plank'),
        tag('Nail'),
        tag('Timber', 'output'),
        name('Refined Plank', 'output'),
        tag('Bark', 'output'),
      ],
    },
    {
      label: 'planting',
      rows: [
        tag('Pebbles'),
        tag('Clay'),
        tag("Potter's Mix"),
        tag("Unfired Forester's Pot"),
        tag("Forester's Pot"),
        tag('Sapling'),
      ],
    },
    {
      label: 'cross-domain',
      rows: [
        // wood products consumed by other professions' recipes
        // TODO: derive from recipe data instead of hardcoding
        name('-> masonry logs', 'cross-domain'),
        name('-> masonry planks', 'cross-domain'),
        name('-> leather bark', 'cross-domain'),
        name('-> smithing logs', 'cross-domain'),
      ],
    },
    {
      label: 'packages',
      rows: [name('Wood Log Package'), name('Plank Package'), name('Bark Package')],
    },
  ],
  packages: ['Wood Log Package', 'Plank Package', 'Bark Package'],
};

export const FARMING: ProfessionDef = {
  id: 'farming-view',
  title: 'Farming',
  cargo: null,
  consumables: [{ name: 'Water Bucket', hint: '-> provisions' }],
  sections: [
    {
      label: 'seeds',
      rows: [tag('Filament Seeds'), tag('Grain Seeds'), tag('Vegetable Seeds')],
    },
    {
      label: 'crops',
      rows: [tag('Grain'), tag('Vegetable'), tag('Filament')],
    },
    {
      label: 'rares',
      rows: [tag('Straw'), tag('Crop Oil')],
    },
    {
      label: 'supplies',
      rows: [tag('Fertilizer')],
    },
  ],
  packages: [],
};

export const TAILORING: ProfessionDef = {
  id: 'tailor-view',
  title: 'Tailoring',
  cargo: null,
  consumables: [{ name: "Clothmaker's Mordant" }, { name: 'Water Bucket' }],
  sections: [
    {
      label: 'materials',
      rows: [
        tag('Plant Fiber'),
        tag('Filament'),
        tag('Roots'),
        tag('Cloth Strip'),
        tag('Cloth', 'output'),
        tag('Rope', 'output'),
      ],
    },
    {
      label: 'rares',
      rows: [tag('Animal Hair'), tag('Straw'), tag('Refined Cloth', 'output')],
    },
  ],
  packages: [],
};

export const LEATHERWORKING: ProfessionDef = {
  id: 'leatherworking-view',
  title: 'Leatherworking',
  cargo: null,
  consumables: [
    { name: 'Water Bucket', hint: '-> provisions' },
    { name: 'Hideworking Salt' },
    { name: 'Leather Treatment' },
  ],
  sections: [
    {
      label: 'materials',
      rows: [tag('Pelt'), tag('Cleaned Pelt'), tag('Tanned Pelt'), tag('Leather', 'output')],
    },
    {
      label: 'process',
      rows: [tag('Bark'), tag('Tannin'), tag('Raw Meat')],
    },
    {
      label: 'rares',
      rows: [tag('Animal Hair', 'output')],
    },
  ],
  packages: [],
};

export const MASONRY: ProfessionDef = {
  id: 'masonry-view',
  title: 'Masonry',
  cargo: { name: 'stone chunk', tag: 'Stone Chunk' },
  consumables: [{ name: 'Brickworking Ash' }],
  sections: [
    {
      label: 'materials',
      rows: [
        tag('Stone Chunk'),
        tag('Pebbles'),
        tag('Clay'),
        tag("Potter's Mix"),
        tag('Unfired Brick'),
        tag('Sand'),
        tag('Glass'),
        tag('Brickworking Ash'),
        tag('Braxite'),
        tag('Vial', 'output'),
        tag('Brick', 'output'),
        tag('Stone Slab', 'output'),
        name('Refined Brick', 'output'),
      ],
    },
  ],
  packages: [],
};

export const SMITHING: ProfessionDef = {
  id: 'smithing-view',
  title: 'Smithing',
  cargo: { name: 'ore chunk', tag: 'Ore Chunk' },
  consumables: [{ name: 'Metalsmelting Flux' }],
  sections: [
    {
      label: 'materials',
      rows: [
        tag('Ore Piece'),
        tag('Ore Concentrate'),
        tag('Molten Ingot'),
        tag('Ingot', 'output'),
        tag('Nail', 'output'),
        name('Refined Ingot', 'output'),
        // cross-domain inputs consumed by smithing recipes
        tag('Wood Log'),
        tag('Plank'),
        tag('Leather'),
        tag('Cloth'),
        tag('Rope'),
      ],
    },
  ],
  packages: ['Ore Piece Package'],
};

export const FISHING: ProfessionDef = {
  id: 'fishing-view',
  title: 'Fishing',
  cargo: null,
  consumables: [],
  sections: [
    {
      label: 'catches',
      rows: [tag('Lake Fish'), tag('Ocean Fish'), tag('Baitfish')],
    },
    {
      label: 'processed',
      rows: [
        tag('Lake Fish Filet'),
        tag('Ocean Fish Filet'),
        tag('Chum'),
        tag('Fish Oil'),
        tag('Crushed Shells'),
        tag('Bait'),
        tag('Raw Meat'),
      ],
    },
  ],
  packages: [],
};

export const SCHOLAR: ProfessionDef = {
  id: 'scholar-view',
  title: 'Scholar',
  cargo: null,
  consumables: [{ name: 'Water Bucket', hint: '-> provisions' }, { name: 'Sugar' }],
  sections: [
    {
      label: 'codex materials',
      rows: [
        tag('Pigment'),
        tag('Ink'),
        tag('Parchment', 'output'),
        tag('Journal', 'output'),
        tag('Ancient Hieroglyphs'),
        tag('Stone Diagram'),
        tag('Metal Solvent', 'output'),
        tag('Leather Treatment', 'output'),
        tag('Wood Polish', 'output'),
        tag('Vial'),
        tag('Sugar'),
      ],
    },
    {
      label: 'refining',
      rows: [tag('Pebble'), tag('Braxite'), tag('Gypsite'), tag('Fish Oil'), tag('Citric Berry')],
    },
    {
      label: 'potions',
      rows: [
        tag('Vegetable Seed'),
        tag('Grain Seed'),
        tag('Wispweave Seed'),
        tag('Catalyst'),
        tag('Flower'),
        tag('Mushroom'),
        tag('Raw Meat'),
        tag('Crop Oil'),
        tag('Pitch'),
        tag('Amber Resin'),
      ],
    },
    {
      label: 'packages',
      rows: [name('Bark Package')],
    },
  ],
  packages: ['Bark Package'],
};

export const COOKING: ProfessionDef = {
  id: 'cooking-view',
  title: 'Cooking',
  cargo: null,
  consumables: [{ name: 'Sugar' }, { name: 'Salt' }],
  sections: [
    {
      label: 'ingredients',
      rows: [
        tag('Grain'),
        tag('Vegetable'),
        tag('Lake Fish Filet'),
        tag('Ocean Fish Filet'),
        tag('Dough'),
      ],
    },
    {
      label: 'meals',
      rows: [tag('Food')],
    },
  ],
  packages: [],
};
export const JEWELRY: ProfessionDef = {
  id: 'jewelry-view',
  title: 'Jewelry',
  cargo: null,
  consumables: [],
  sections: [
    {
      label: 'Gems',
      rows: [
        tag('Ruby'),
        tag('Ruby Fragment'),
        tag('Emerald'),
        tag('Emerald Fragment'),
        tag('Diamond'),
        tag('Diamond Fragment'),
        tag('Sapphire'),
        tag('Sapphire Fragment'),
        tag('Ingot'),
      ],
    },
    {
      label: 'Monster Materials',
      rows: [
        name('Jakyl Fang'),
        name('Hardened Shell'),
        name('Crystalized Slime'),
        name('Glittering Junk'),
        name('Umbura Fang'),
        name('Umbura Fur'),
        name('Jakyl Fur'),
        name('Chitin'),
        name('Eye of the Sentinal'),
      ],
    },
  ],
  packages: [],
};

// tab order
export const ALL_PROFESSIONS: ProfessionDef[] = [
  FARMING,
  TAILORING,
  WOODWORKING,
  LEATHERWORKING,
  MASONRY,
  JEWELRY,
  SMITHING,
  FISHING,
  SCHOLAR,
  COOKING,
];
