// Configuration constants - centralized magic values
export const CONFIG = {
  // Number of regions
  REGION_COUNT: 25,

  // Highest tier available
  MAX_TIER: 10,

  FLOWCHART_ZOOM: {
    MIN: 0.25,
    MAX: 2,
    STEP: 0.1,
    WHEEL_SENSITIVITY: 0.0005,
  },

  PLANNER: {
    /** Display order for activity groups (dashboard, export, CSV). */
    ACTIVITY_ORDER: [
      'Mining',
      'Logging',
      'Foraging',
      'Farming',
      'Fishing',
      'Hunting',
      'Crafting',
    ] as const,
  },

  ENABLED_REGIONS: new Set([7, 8, 9, 12, 13, 14, 17, 18, 19]),
};
