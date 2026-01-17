# Bitcraft City Manager

A lightweight dashboard for viewing your Bitcraft settlement's inventory, citizens, and equipment status.

Built with vanilla JS - no frameworks, no build step.

## Features

- **Inventory View**: Material matrix showing quantities by category and tier with heatmap visualization
- **Citizens View**: Overview of all settlement members with their equipment across cloth/leather/metal gear types
- **ID Lookup**: Quick search and copy-to-clipboard for player and item IDs (useful for bitcraftmap and other tools)

## Quick Start

### Option 1: Deploy to Vercel (Recommended)

1. Fork this repository
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click "New Project" and import your forked repo
4. Deploy - no configuration needed

### Option 2: Run Locally

```bash
# Install Vercel CLI
npm install -g vercel

# Clone and run
git clone https://github.com/YOUR_USERNAME/bitcraft-city-manager.git
cd bitcraft-city-manager
vercel dev
```

Opens at http://localhost:3000

## Usage

1. Enter a Claim ID (e.g., `504403158284115406`)
2. Click Load
3. Switch between Inventory/Citizens/IDs tabs

You can share URLs with claim IDs: `https://your-site.vercel.app/?claim=504403158284115406`

## Project Structure

```
/api
  proxy.js          # Serverless proxy to bitjita.com API
/public
  index.html        # Main page
  /js
    api.js          # API wrapper
    inventory.js    # Data processing and category mappings
    ui.js           # Rendering functions
    main.js         # Entry point and state management
  /css
    style.css       # All styles
```

## API Endpoints Used

All data comes from [bitjita.com](https://bitjita.com) API:

| Endpoint | Purpose |
|----------|---------|
| `/claims/{id}` | Claim name, tier, region, supplies |
| `/claims/{id}/inventories` | Building inventories with item metadata |
| `/claims/{id}/citizens` | Settlement members |
| `/players/{id}/equipment` | Player gear |
| `/items` | Full item database |

## Adding Item Categories

Item categories are defined in `inventory.js`. The `TAG_CATEGORIES` object maps high-level categories to item tags. The `RAW_MATERIAL_TAGS` set determines which items appear in the material matrix.

## Contributing

Pull requests welcome. Keep it simple:
- No build step
- No frameworks
- Vanilla JS only

## Credits

- Data provided by [bitjita.com](https://bitjita.com)
- Inspired by the Bitcraft community tools ecosystem

## License

MIT
