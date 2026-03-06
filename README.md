# SafeTreeTab

A Chrome extension that lists your open tabs in a vertical sidebar. Nothing more, nothing less.

## Why trust this extension?

Most tab manager extensions request broad permissions, bundle megabytes of third-party code, and phone home to remote servers. SafeTreeTab does none of that.

**The entire extension is four files you can read in under 10 minutes:**

| File | What it does |
|------|--------------|
| `manifest.json` | Declares the extension's name, permissions, and entry points |
| `background.js` | Opens the side panel when you click the toolbar icon (4 lines) |
| `sidebar/sidebar.html` | The sidebar UI structure |
| `sidebar/sidebar.js` | Reads your tabs, renders them, listens for changes |
| `sidebar/sidebar.css` | Visual styling |

**Permissions requested — and why:**

| Permission | Why it's needed |
|------------|-----------------|
| `tabs` | Read tab titles, URLs, and favicons to display them; switch to or close a tab when you click |
| `sidePanel` | Open the sidebar panel in Chrome |

No other permissions are requested. The extension cannot access page content, make network requests, read cookies, manage history, or interact with any website.

**Zero dependencies.** No npm packages. No bundler. No external scripts or CDN resources. The code that runs is exactly the code you see in this repository — no build step, no minification, no obfuscation.

**No data leaves your browser.** The extension makes no network requests. Your tab titles and URLs are displayed locally and never sent anywhere.

## Installation

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select this folder.
5. Click the SafeTreeTab icon in the toolbar to open the sidebar.

## Features

- Vertical list of all open tabs in the current window
- Click any tab to switch to it
- Close tabs with the x button
- Search/filter tabs by title or URL
- Automatically updates as tabs open, close, or change
- Respects your system light/dark mode preference

## Auditing the code yourself

Because there are no dependencies and no build step, auditing is straightforward:

```
manifest.json     — check permissions
background.js     — 7 lines, opens the side panel
sidebar/sidebar.js — all tab logic, ~115 lines
sidebar/sidebar.html — UI structure
sidebar/sidebar.css  — styles only
```

If you want to verify no outbound network requests are made, open Chrome DevTools on the sidebar panel (`Inspect` from the extensions page) and check the Network tab while using the extension.
