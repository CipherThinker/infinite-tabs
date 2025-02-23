# Infinite Tabs Chrome Extension

A powerful Chrome extension for efficiently managing and organizing your browser tabs.

## Features

- Store and manage tabs
- Context menu integration
- Free/Pro version with limits
- Dark mode support
- Favicon display
- Tab count tracking
- Responsive design
- Clean, gradient-based UI

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `infinite-tabs` directory

## Usage

- Right-click on any tab and select "Transfer to Infinite Tabs" to store it
- Click on any stored tab in the popup to open it
- Toggle dark mode using the moon icon
- Monitor your tab usage in the footer
- Upgrade to Pro for unlimited tab storage

## Development

The extension is built using vanilla JavaScript and follows Chrome Extension Manifest V3 guidelines.

### Project Structure
```
infinite-tabs/
├── manifest.json
├── background.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/
│   └── content.js
└── assets/
    └── logo.png (in sizes: 16, 48, 128)
```

### Required Assets

Before loading the extension, make sure to add the following logo files in the assets directory:
- logo-16.png (16x16)
- logo-48.png (48x48)
- logo-128.png (128x128)

## Testing

Test the following scenarios:
1. Adding tabs via context menu
2. Opening stored tabs
3. Free version limit (11 tabs)
4. Dark mode toggle
5. UI responsiveness
6. Tab persistence after browser restart

## License

MIT License
