// Configuration constants - centralized magic values
export const CONFIG = {
    // Equipment slot identifiers (API field names)
    EQUIPMENT_SLOTS: [
        'head_clothing',
        'torso_clothing',
        'hand_clothing',
        'belt_clothing',
        'leg_clothing',
        'feet_clothing'
    ],

    // Display names for equipment slots
    SLOT_DISPLAY_NAMES: ['Head', 'Chest', 'Hands', 'Belt', 'Legs', 'Feet'],

    // Vault API type codes for each slot
    // type: 8=head, 9=belt, 10=torso, 11=hands, 12=legs, 13=feet
    SLOT_TYPE_CODES: {
        'head_clothing': 8,
        'torso_clothing': 10,
        'hand_clothing': 11,
        'belt_clothing': 9,
        'leg_clothing': 12,
        'feet_clothing': 13
    },

    // Armor/clothing categories
    GEAR_TYPES: ['Cloth Clothing', 'Leather Clothing', 'Metal Clothing'],

    // All clothing/armor tags (for vault filtering)
    CLOTHING_TAGS: [
        'Cloth Clothing', 'Leather Clothing', 'Metal Clothing',
        'Cloth Armor', 'Leather Armor', 'Metal Armor'
    ],

    // Rarity ordering (lowest to highest)
    RARITY_ORDER: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'],

    // Number of regions
    REGION_COUNT: 9,

    // Highest tier available
    MAX_TIER: 10,

    FLOWCHART_ZOOM: {
      MIN: 0.25,
      MAX: 2,
      STEP: 0.1,
      WHEEL_SENSITIVITY: 0.0005
    }
};

/**
 * Keyboard keys for navigation components
 */
export enum KeyboardKey {
    ArrowDown = 'ArrowDown',
    ArrowUp = 'ArrowUp',
    Enter = 'Enter',
    Escape = 'Escape'
}
