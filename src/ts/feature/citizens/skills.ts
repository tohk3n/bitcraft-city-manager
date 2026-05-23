// Skill ordering and abbreviations.
//
// IDs are hardcoded because column order matters, your eyes learn positions
// and stop reading labels. The API returns skills keyed by ID with a separate
// skillNames map for display names, but doesn't guarantee ordering.
//
// If a new skill is added to the game, it'll appear in the "unknown" bucket
// in the detail view and won't have a matrix column until added here.

// Professions: the crafting/gathering skills. These are the primary skills
// players level and the ones city managers care most about for workforce
// planning. Order matches the game's profession list.
export const PROFESSIONS: number[] = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
  // Forestry, Carpentry, Masonry, Mining, Blacksmithing, Scholar,
  // Leatherworking, Hunting, Tailoring, Farming, Fishing, Cooking, Foraging
];

// Non-profession skills. Separated because the detail view puts a visual
// gap between professions and these, and they're less relevant to city
// management (you don't assign someone to be your "Slayer").
export const SKILLS: number[] = [
  1, 15, 16, 17, 18,
  // Slayer, Sailing, Construction, Taming, Merchanting
];

// Abbreviations for matrix column headers.
// Constraints: 3-4 chars, no collisions, recognizable at a glance.
// "For" vs "Forg" distinguishes Forestry from Foraging.
// "Smth" for Blacksmithing because "Blck" reads like "Block".
// "Mrch" for Merchanting because "Merc" reads like "Mercenary".
export const SKILL_ABBREV: Record<string, string> = {
  Forestry: 'For',
  Carpentry: 'Carp',
  Masonry: 'Mas',
  Mining: 'Mine',
  Blacksmithing: 'Smth',
  Scholar: 'Schl',
  Leatherworking: 'Lthr',
  Hunting: 'Hunt',
  Tailoring: 'Tail',
  Farming: 'Farm',
  Fishing: 'Fish',
  Cooking: 'Cook',
  Foraging: 'Forg',
  Slayer: 'Slay',
  Sailing: 'Sail',
  Construction: 'Con',
  Taming: 'Tame',
  Merchanting: 'Mrch',
};
