// Sub-View -- single import point
//
// Usage:
//   import { createSubView } from './components/sub-view/index.js';
//   import type { SubViewConfig } from './components/sub-view/index.js';

export { createSubView } from './sub-view.js';

export type {
  SubViewConfig,
  SubViewHandle,
  SubViewRow,
  SubViewSection,
  BottleneckSummary,
  ConsumableStatus,
  CargoData,
  CellBottleneck,
  RowSemantic,
} from './sub-view.types.js';
