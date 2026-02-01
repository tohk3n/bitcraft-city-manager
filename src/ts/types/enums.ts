// Shared enums

/** Map link cell selection state */
export enum CELL_TYPE {
    FULL = "full",
    PART = "part",
    NONE = "none"
}

/** Map link URL parameter keys */
export enum LINK_PARAM {
    REGION_ID = "regionId",
    RESOURCE_ID = "resourceId",
    PLAYER_ID = "playerId",
    ENEMY_ID = "enemyId"
}

/** Keyboard keys for navigation components */
export enum KeyboardKey {
    ArrowDown = 'ArrowDown',
    ArrowUp = 'ArrowUp',
    Enter = 'Enter',
    Escape = 'Escape'
}
/** Dashboard filter types */
export enum FILTER_TYPE {
    FRIDGE,
    RARITY_RARE,
    NONE
}

export enum FOOD_BUFF{
    COMBAT = 'Combat',
    CRAFTING = 'Crafting',
    MOVEMENT = 'Movement',
    STAMINA = 'Stamina',
    NONE = 'none'
}
export enum SUPPLY_CAT{
    TIMBER = 'Wood',
    FRAMES = 'Metal',
    TARP = 'Cloth',
    LEATHER = 'Sheeting',
    SLAB = 'Stone',
    HEX = 'Hex',
    SCHOLAR = 'Scholar',
    NONE = 'none'
}