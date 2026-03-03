// Flat data shapes for profession sub-views.
// The caller builds these from ProcessedInventory; the view just renders.
// Kept dumb on purpose -- no circular deps, no rendering awareness.

export interface CellBottleneck {
  need: number;
  deficit: number;
}

// One material row in the tier matrix.
// tiers is sparse: index 0 = T1, index 9 = T10.
// bottlenecks is a sparse map: tier index to shortage info.
export interface SubViewRow {
  key: string; // unique id for DOM diffing (tag name or item name)
  label: string; // display text in the row header
  tiers: number[]; // supply quantities, index 0 = T1
  cls?: RowSemantic; // optional semantic styling
  bottlenecks?: Record<number, CellBottleneck>; // tier index to shortage
}

export type RowSemantic = 'output' | 'cross-domain';

export interface SubViewSection {
  label: string;
  rows: SubViewRow[];
}

export interface BottleneckSummary {
  name: string;
  tier: number;
  need: number;
  have: number;
  deficit: number;
}

export interface ConsumableStatus {
  name: string;
  value: number;
  hint?: string; // e.g. "-> provisions"
}

export interface CargoData {
  name: string;
  tiers: number[]; // same convention as SubViewRow
}

// Same config = same DOM. Always.
export interface SubViewConfig {
  title: string; // profession name, used in copy text
  cargo: CargoData | null;
  consumables: ConsumableStatus[];
  bottlenecks: BottleneckSummary[];
  sections: SubViewSection[];
}

export interface SubViewHandle {
  update: (config: SubViewConfig) => void;
  destroy: () => void;
}
