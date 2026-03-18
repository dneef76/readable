# Readable

A lightweight macOS app for reading and editing Markdown files. Renders `.md` files as clean, styled documents — like Google Docs, but for Markdown.

Built with [Tauri](https://tauri.app), [React](https://react.dev), and [ProseMirror](https://prosemirror.net).

## Features

- **WYSIWYG editing** — click anywhere and type. No markdown syntax visible.
- **Clean rendering** — headings, tables, bold, code blocks, links, lists, blockquotes all styled beautifully
- **Light & dark mode** — follows your macOS system setting
- **Finder integration** — double-click any `.md` file to open it in Readable
- **Drag & drop** — drag `.md` files onto the window
- **File watching** — if the file changes on disk, Readable detects it and reloads
- **Tiny footprint** — ~5MB app, low memory usage (not Electron)

## Screenshot

<!-- TODO: Add screenshot -->

## Install

### From DMG (easiest)

1. Download the latest `.dmg` from [Releases](../../releases)
2. Open the DMG and drag **Readable** to your Applications folder
3. On first launch, macOS will warn about an unidentified developer (see below)

### From source

Requires [Rust](https://rustup.rs) and [Node.js](https://nodejs.org).

```bash
git clone https://github.com/dneef-ai/readable.git
cd readable
npm install
npm run tauri build
```

The built app will be at `src-tauri/target/release/bundle/macos/Readable.app`.

## macOS security warning

Since Readable is not signed with an Apple Developer certificate, macOS will show a warning the first time you open it:

> "Readable can't be opened because it is from an unidentified developer"

**To bypass this (one time only):**

1. **Right-click** (or Control-click) on Readable in your Applications folder
2. Click **Open** from the context menu
3. Click **Open** again in the dialog that appears

After doing this once, Readable will open normally from then on.

Alternatively: **System Settings → Privacy & Security → scroll down → click "Open Anyway"** next to the Readable message.

## Setting Readable as your default Markdown viewer

1. Right-click any `.md` file in Finder
2. Click **Get Info**
3. Under "Open with", select **Readable**
4. Click **Change All...**

Now all `.md` files will open in Readable when double-clicked.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘O | Open file |
| ⌘S | Save |
| ⌘W | Close window |
| ⌘Q | Quit |
| ⌘Z | Undo |
| ⌘⇧Z | Redo |
| ⌘+click | Open link in browser |

## Tech stack

| Component | Technology |
|-----------|-----------|
| App shell | [Tauri v2](https://tauri.app) |
| Backend | Rust |
| Frontend | React + TypeScript |
| Editor | [ProseMirror](https://prosemirror.net) |
| Build tool | Vite |

## Architecture

Readable is a Tauri desktop app with two layers:

- **Rust backend** — file I/O, macOS file association, native menus, file watching
- **React frontend** — ProseMirror WYSIWYG editor running in a webview

Markdown files are the source of truth. The app parses them into ProseMirror's document model for display, and serializes back to clean Markdown on save.

## License

MIT
