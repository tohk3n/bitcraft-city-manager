export const CITIZEN_CONFIG = {
    // Rarity ordering (lowest to highest)
    RARITY_ORDER: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'],
    // All clothing/armor tags (for vault filtering)
    CLOTHING_TAGS: [
        'Cloth Clothing', 'Leather Clothing', 'Metal Clothing',
        'Cloth Armor', 'Leather Armor', 'Metal Armor'
    ],
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
    // Display names for equipment slots
    SLOT_DISPLAY_NAMES: ['Head', 'Chest', 'Hands', 'Belt', 'Legs', 'Feet'],

    // Equipment slot identifiers (API field names)
    EQUIPMENT_SLOTS: [
        'head_clothing',
        'torso_clothing',
        'hand_clothing',
        'belt_clothing',
        'leg_clothing',
        'feet_clothing'
    ],
    // Armor/clothing categories
    GEAR_TYPES: ['Cloth Clothing', 'Leather Clothing', 'Metal Clothing']

}