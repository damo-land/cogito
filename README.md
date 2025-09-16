# cogito - WYSIWYG Markdown Editor

A privacy-first WYSIWYG markdown editor that replaces Chrome's new tab page with instant note-taking functionality.

## Features

- 🚀 **Instant Access**: Opens automatically on every new Chrome tab
- 🔒 **Privacy First**: All data stored locally with encryption
- ✍️ **WYSIWYG Editing**: Notion-like markdown editing experience
- 💨 **Fast Performance**: Sub-500ms load times
- 🎯 **Distraction-Free**: Clean, minimalist interface

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Chrome browser for testing

### Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the extension:

   ```bash
   npm run build:dev
   ```

4. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` directory

### Development Commands

- `npm run dev` - Build with watch mode for development
- `npm run build` - Production build
- `npm run build:dev` - Development build
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Project Structure

```
wysiwyg-md-editor/
├── src/extension/           # Chrome extension specific files
│   ├── manifest.json       # Extension manifest v3
│   ├── background.ts       # Background script
│   └── popup/             # Extension popup
├── public/                # Static assets
│   ├── icons/            # Extension icons
│   └── newtab.html       # New tab override page
├── tests/                # Test files
└── docs/                 # Documentation
```

## Tech Stack

- **Frontend**: React 18.2+ with TypeScript 5.0+
- **Build Tool**: Vite 4.0+ optimized for Chrome extensions
- **Testing**: Vitest + React Testing Library + Playwright
- **Chrome Extension**: Manifest V3

## Current Status

✅ **Story 1.1 Complete**: Chrome Extension Foundation Setup

- Extension manifest and basic structure
- Build configuration with Vite + TypeScript
- Background script with error handling
- Ready for Chrome developer mode loading

## License

MIT
