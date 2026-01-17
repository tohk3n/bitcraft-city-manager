# Bitcraft City Manager

A basic dashboard for viewing a Bitcraft settlement's inventory, citizens, and equipment status.

## Features

- **Inventory View**: Using a matrix table to show quantities by category and tier
- **Citizens View**: Check your citizen's gear at a glance
- **ID Lookup**: Quick search and copy-to-clipboard for player and item IDs

## Usage

1. Enter a Claim ID, this can be retrieved from bitjita if you're not sure
2. Click Load
3. Switch between Inventory/Citizens/IDs tabs

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
- Player Lomacil for the original work and idea

## License

MIT
