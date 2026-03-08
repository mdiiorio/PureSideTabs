# SafeTreeTab

A Chrome extension that lists your open tabs in a vertical sidebar. Nothing more, nothing less.

## Why trust this extension?

Most tab manager extensions request broad permissions, bundle megabytes of third-party code, and phone home to remote servers. SafeTreeTab does none of that.

**Permissions requested — and why:**

| Permission | Why it's needed |
|------------|-----------------|
| `tabs` | Read tab titles, URLs, and favicons to display them; switch to or close a tab when you click |
| `tabGroups` | Read tab group names and colors to render grouped tabs in the sidebar |
| `sidePanel` | Open the sidebar panel in Chrome |
| `storage` | Remember recently used tab order across tab activations (session storage only); persist settings (sync storage) |

No other permissions are requested. The extension cannot access page content, make network requests, read cookies, manage history, or interact with any website.

**Zero dependencies.** No npm packages. No bundler. No external scripts or CDN resources. The code that runs is exactly the code you see in this repository — no build step, no minification, no obfuscation.

**No data leaves your browser.** The extension makes no network requests. Your tab titles and URLs are displayed locally and never sent anywhere.

## Features

- Vertical list of all open tabs in the current window
- Tab groups shown with color-coded headers, matching Chrome's built-in group colors
- Collapse and expand tab groups by clicking the group header
- Search/filter tabs by title or URL (collapsed groups expand automatically when searching)
- Click any tab to switch to it
- Close tabs with the × button
- Toolbar popup showing pinned tabs and recently used tabs, with keyboard navigation (↑/↓ or j/k, Enter to switch)
- Keyboard shortcut **Alt+Shift+S** to show/hide the sidebar
- Drag and drop to reorder tabs and tab groups; drop a tab onto a group header to add it to the group
- Automatically updates as tabs open, close, move, or change
- Respects your system light/dark mode preference

## Settings

Access settings via right-click on the extension icon → **Options**, or through `chrome://extensions` → SafeTreeTab → **Details** → **Extension options**.

| Setting | Default | Description |
|---------|---------|-------------|
| Recent tabs to show in popup | 10 | How many recently used tabs appear in the toolbar popup |
| Open new tabs inside current group | Off | When enabled, pressing Ctrl+T while on a grouped tab opens the new tab at the end of that group instead of at the end of the window |

