# Bitcraft City Manager

You have 47 chests. Are there enough rocks in them? **NOBODY KNOWS.**

Until now. Now we know **HOW MANY ROCKS**.

**WE STILL DO NOT IF IT IS ENOUGH!**

## The Sacred Features

**Inventory Dashboard** - All your stuff. One screen. Tier bars show the distribution of your hoarding. Finally answer "do we have food" without opening every container in the settlement.

**Upgrade Planner** - THE BIG ONE. Pick a target tier, behold the flowchart of REQUIREMENTS. Drag it around (it gets wide). When leadership asks "how many berries for T5" you can answer with actual numbers instead of vibes.

**Citizens View** - Who's wearing what. Find the naked ones. *You know who you are.*

**ID Lookup** - Entity IDs for API things. Quietly useful.

**Map Link Composer** - Generate bitcraftmap links with parameters.

## The Using Of It

1. Claim ID from bitjita.com (it's in the URL)
2. Paste, Load
3. Tabs

### Planner Specifics

The flowchart shows dependencies. Colors:
- **Green** = Sufficient
- **Yellow** = Partial  
- **Red** = Lacking
- **Dashed border** = Research goal, not an actual item
- **Red badge** = The deficit

Click and drag to pan. These trees get WIDE.

Codex count defaults to tier requirements but you can override it. Outposts rejoice.

"Copy Task List" exports a Discord-ready gathering list.

## Technical

Vanilla JS. No build step. No framework. Data from [bitjita.com](https://bitjita.com).

For planner implementation details, see `docs/PLANNER-INTERNALS.md`.

## Contributing

PRs welcome. Keep it simple. No frameworks.

## Credits

- Bitjita for the API
- Lomacil for the original work
- The Ardent City for testing
- Caffeine

## License

MIT
