## TypeScript

The codebase is now TypeScript. **Yes, all of it.**

### For Java Refugees (Looking At You, Lomacil)

IT IS GOOD that you already understand static typing. **HOWEVER!** TypeScript has *opinions*.

**The Familiar Parts:**
- Interfaces work like you'd expect
- Generics exist and behave
- The compiler **YELLS** at you! **As it should**.

**The Weird Parts:**
- `null` and `undefined` are different things. *Both will hurt you*.
- Union types: `string | null` means **"string or null"** not *"supertype of both"*
- Type assertions (`as SomeType`) are your escape hatch. **Use sparingly**.

### The **NEW** Project Structure
```
src/ts/           # Source TypeScript
public/js/        # Compiled output (gitignored, don't edit)
```

Run `npm run build` to compile. The compiler will tell you what you broke.

### The Types ARE NOT HOMELESS

`src/ts/types.ts` - **THE OMNIKEY OF TYPES** All interfaces. All type definitions. This scroll must be KNOWN, brother.

Key types:
- `ClaimData` - The big state object
- `ProcessedNode` - Planner tree nodes
- `InventoryLookup` - Map of "name:tier" → quantity

### Known Incantions WORTH Knowing

**DOM Elements:**
```typescript
const el = document.getElementById('thing') as HTMLInputElement | null;
el?.value  // Optional chaining - won't explode if null
```

**Event Handlers:**
```typescript
btn.addEventListener('click', (e: MouseEvent) => { ... });
```

**Object.values() Needs Help:**
```typescript
// TypeScript forgets what's in there
const items = Object.values(foodItems) as FoodItem[];
```

**Array Iterations:**
```typescript
// Array iteration - TypeScript infers 'unknown' from Sets
const tiers = [...new Set(items.map(i => i.tier))];
// THE REMEDY: cast or type the intermediate
const tiers = [...new Set(items.map(i => i.tier))].sort((a, b) => a - b) as number[];
```

### When The Compiler SCREAMS

1. **"Property does not exist"** - Are you accessing something that might not be there? HMMM? Perhaps a null check...or use optional chaining (`?.`).

2. **"Type 'X' is not assignable to type 'Y'"** - Tsk tsk, the types do NOT match. Review the `types.ts` brother, for your knowing was not known enough.

3. **"Parameter implicitly has 'any' type"** - Naughty naughty. Add a type annotation. The compiler isn't psychic.

4. **"Cannot find module"** - Check the import path. Files in `planner/lib/` need `../../types.js` not `../types.js`.

### The Build
```bash
npm run build    # Compile once
npm run dev      # Watch mode (recompiles on save)
vercel dev       # Full local server with API proxy
```

TypeScript compiles to `public/js/`. The HTML loads the JS. Circle of life.

### Adding New Code

1. Define types in `types.ts` first
2. Import what you need: `import type { Thing } from './types.js'`
3. Annotate function parameters and return types
4. Let the compiler guide you to enlightenment (or frustration)

The `.js` extension in imports is intentional. TypeScript compiles to JS modules. The browser needs `.js`. Don't fight it.
