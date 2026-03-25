const { test, expect } = require('./fixtures');

test('sidebar shows tab groups', async ({ context, extensionId }) => {
    // Open two tabs to group
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    const page2 = await context.newPage();
    await page2.goto('https://playwright.dev');

    // Open the sidebar — use its extension context to call chrome APIs
    const sidebar = await context.newPage();
    await sidebar.goto(`chrome-extension://${extensionId}/sidebar/sidebar.html`);

    // Create a tab group via the Chrome API from within the extension page
    await sidebar.evaluate(async () => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const tabIds = tabs
            .filter(t => !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://'))
            .map(t => t.id);
        const groupId = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(groupId, { title: 'My Group', color: 'blue' });
    });

    // Sidebar listens to tabGroups.onUpdated so it re-renders automatically —
    // wait for the group header to appear
    await expect(sidebar.locator('.group-name', { hasText: 'My Group' })).toBeVisible();
    await expect(sidebar.locator('.tab-group')).toBeVisible();

    // Both tab titles should be visible inside the group
    await expect(sidebar.locator('.tab-title', { hasText: 'Example Domain' })).toBeVisible();
    await expect(sidebar.locator('.tab-title', { hasText: 'Playwright' })).toBeVisible();
});

test('close button removes the tab', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const sidebar = await context.newPage();
    await sidebar.goto(`chrome-extension://${extensionId}/sidebar/sidebar.html`);

    await expect(sidebar.locator('.tab-title', { hasText: 'Example Domain' })).toBeVisible();

    const row = sidebar.locator('.tab-row', { has: sidebar.locator('.tab-title', { hasText: 'Example Domain' }) });
    await row.hover();
    await row.locator('.tab-close').click();

    await expect(sidebar.locator('.tab-title', { hasText: 'Example Domain' })).not.toBeVisible();
});

test('right-click shows context menu with expected items', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const sidebar = await context.newPage();
    await sidebar.goto(`chrome-extension://${extensionId}/sidebar/sidebar.html`);

    const row = sidebar.locator('.tab-row', { has: sidebar.locator('.tab-title', { hasText: 'Example Domain' }) });
    await row.click({ button: 'right' });

    await expect(sidebar.locator('.context-menu.visible')).toBeVisible();
    await expect(sidebar.locator('.context-menu-item', { hasText: 'Reload' })).toBeVisible();
    await expect(sidebar.locator('.context-menu-item', { hasText: 'Duplicate' })).toBeVisible();
    await expect(sidebar.locator('.context-menu-item', { hasText: 'Close tab' })).toBeVisible();
});

test('context menu dismisses on outside click', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const sidebar = await context.newPage();
    await sidebar.goto(`chrome-extension://${extensionId}/sidebar/sidebar.html`);

    const row = sidebar.locator('.tab-row', { has: sidebar.locator('.tab-title', { hasText: 'Example Domain' }) });
    await row.click({ button: 'right' });
    await expect(sidebar.locator('.context-menu.visible')).toBeVisible();

    await sidebar.locator('#tab-tree').click();
    await expect(sidebar.locator('.context-menu.visible')).not.toBeVisible();
});

test('pinned tabs show separator before unpinned tabs', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const sidebar = await context.newPage();
    await sidebar.goto(`chrome-extension://${extensionId}/sidebar/sidebar.html`);

    await sidebar.evaluate(async () => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const target = tabs.find(t => t.url.includes('example.com'));
        if (target) await chrome.tabs.update(target.id, { pinned: true });
    });

    await expect(sidebar.locator('.pinned-separator')).toBeVisible();
});

test('tab group collapses and hides tab rows', async ({ context, extensionId }) => {
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    const page2 = await context.newPage();
    await page2.goto('https://playwright.dev');

    const sidebar = await context.newPage();
    await sidebar.goto(`chrome-extension://${extensionId}/sidebar/sidebar.html`);

    await sidebar.evaluate(async () => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const tabIds = tabs
            .filter(t => !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://'))
            .map(t => t.id);
        const groupId = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(groupId, { title: 'Collapsible', color: 'blue' });
    });

    await expect(sidebar.locator('.group-name', { hasText: 'Collapsible' })).toBeVisible();
    await expect(sidebar.locator('.tab-title', { hasText: 'Example Domain' })).toBeVisible();

    await sidebar.locator('.tab-group-header', { has: sidebar.locator('.group-name', { hasText: 'Collapsible' }) }).click();

    await expect(sidebar.locator('.tab-title', { hasText: 'Example Domain' })).not.toBeVisible();
    await expect(sidebar.locator('.tab-group.collapsed')).toBeVisible();
});

test('add to group submenu appears on hover', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const sidebar = await context.newPage();
    await sidebar.goto(`chrome-extension://${extensionId}/sidebar/sidebar.html`);

    const row = sidebar.locator('.tab-row', { has: sidebar.locator('.tab-title', { hasText: 'Example Domain' }) });
    await row.click({ button: 'right' });
    await sidebar.locator('.context-menu-item.context-menu-submenu', { hasText: 'Add to group' }).hover();

    await expect(sidebar.locator('#submenu.visible')).toBeVisible();
    await expect(sidebar.locator('#submenu .context-menu-item', { hasText: 'New group' })).toBeVisible();
});

test('new group dialog opens and creates a group', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const sidebar = await context.newPage();
    await sidebar.goto(`chrome-extension://${extensionId}/sidebar/sidebar.html`);

    const row = sidebar.locator('.tab-row', { has: sidebar.locator('.tab-title', { hasText: 'Example Domain' }) });
    await row.click({ button: 'right' });
    await sidebar.locator('.context-menu-item.context-menu-submenu', { hasText: 'Add to group' }).hover();
    await sidebar.locator('#submenu .context-menu-item', { hasText: 'New group' }).click();

    await expect(sidebar.locator('#group-dialog.visible')).toBeVisible();

    await sidebar.locator('#group-name-input').fill('My New Group');
    await sidebar.locator('#group-create-btn').click();

    await expect(sidebar.locator('#group-dialog.visible')).not.toBeVisible();
    await expect(sidebar.locator('.group-name', { hasText: 'My New Group' })).toBeVisible();
});

test('new group dialog cancel closes without creating', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const sidebar = await context.newPage();
    await sidebar.goto(`chrome-extension://${extensionId}/sidebar/sidebar.html`);

    const row = sidebar.locator('.tab-row', { has: sidebar.locator('.tab-title', { hasText: 'Example Domain' }) });
    await row.click({ button: 'right' });
    await sidebar.locator('.context-menu-item.context-menu-submenu', { hasText: 'Add to group' }).hover();
    await sidebar.locator('#submenu .context-menu-item', { hasText: 'New group' }).click();

    await expect(sidebar.locator('#group-dialog.visible')).toBeVisible();
    await sidebar.locator('#group-cancel-btn').click();

    await expect(sidebar.locator('#group-dialog.visible')).not.toBeVisible();
    await expect(sidebar.locator('.tab-group')).not.toBeVisible();
});

test('add to existing group from submenu', async ({ context, extensionId }) => {
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    const page2 = await context.newPage();
    await page2.goto('https://playwright.dev');

    const sidebar = await context.newPage();
    await sidebar.goto(`chrome-extension://${extensionId}/sidebar/sidebar.html`);

    // Create a group containing only the playwright tab
    await sidebar.evaluate(async () => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const target = tabs.find(t => t.url.includes('playwright.dev'));
        const groupId = await chrome.tabs.group({ tabIds: [target.id] });
        await chrome.tabGroups.update(groupId, { title: 'Existing Group', color: 'blue' });
    });

    await expect(sidebar.locator('.group-name', { hasText: 'Existing Group' })).toBeVisible();

    // Add the example.com tab to that group via the submenu
    const row = sidebar.locator('.tab-row', { has: sidebar.locator('.tab-title', { hasText: 'Example Domain' }) });
    await row.click({ button: 'right' });
    await sidebar.locator('.context-menu-item.context-menu-submenu', { hasText: 'Add to group' }).hover();
    await expect(sidebar.locator('#submenu .context-menu-item', { hasText: 'Existing Group' })).toBeVisible();
    await sidebar.locator('#submenu .context-menu-item', { hasText: 'Existing Group' }).click();

    // Both tabs should now be inside the group
    const group = sidebar.locator('.tab-group', { has: sidebar.locator('.group-name', { hasText: 'Existing Group' }) });
    await expect(group.locator('.tab-title', { hasText: 'Example Domain' })).toBeVisible();
    await expect(group.locator('.tab-title', { hasText: 'Playwright' })).toBeVisible();
});

test('tabGroupsAlwaysAtTop: new tab created before a group is moved after it', async ({ context, extensionId }) => {
    const page1 = await context.newPage();
    await page1.goto('https://playwright.dev');

    const sidebar = await context.newPage();
    await sidebar.goto(`chrome-extension://${extensionId}/sidebar/sidebar.html`);

    // Group the playwright tab
    await sidebar.evaluate(async () => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const target = tabs.find(t => t.url.includes('playwright.dev'));
        await chrome.tabs.group({ tabIds: [target.id] });
    });

    await expect(sidebar.locator('.tab-group')).toBeVisible();

    // Enable the setting
    await sidebar.evaluate(async () => {
        await chrome.storage.sync.set({ tabGroupsAlwaysAtTop: true });
    });

    // Force-create a new tab at index 0, before the group
    await sidebar.evaluate(async () => {
        await chrome.tabs.create({ index: 0, url: 'https://example.com' });
    });

    await expect(sidebar.locator('.tab-title', { hasText: 'Example Domain' })).toBeVisible();

    // Wait for the background to move the tab after the group — sidebar should
    // reflect the group before the ungrouped example.com row
    await sidebar.waitForFunction(() => {
        const children = [...document.getElementById('tab-tree').children];
        const groupIdx = children.findIndex(el => el.classList.contains('tab-group'));
        const tabIdx = children.findIndex(el =>
            el.classList.contains('tab-row') &&
            el.querySelector('.tab-title')?.textContent.includes('Example Domain')
        );
        return groupIdx !== -1 && tabIdx !== -1 && groupIdx < tabIdx;
    });
});

test('sidebar loads and shows the current tab', async ({ context, extensionId }) => {
    // Open a real tab so there's something to display
    const page = await context.newPage();
    await page.goto('https://example.com');

    // Open the sidebar directly as a page (bypasses needing to click the side panel UI)
    const sidebar = await context.newPage();
    await sidebar.goto(`chrome-extension://${extensionId}/sidebar/sidebar.html`);

    // At least one tab row should render (we opened example.com above)
    await expect(sidebar.locator('.tab-row').first()).toBeVisible();

    // The example.com tab title should appear somewhere
    await expect(sidebar.locator('.tab-title', { hasText: 'Example Domain' })).toBeVisible();
});

test('new tab in group scrolls into view when group is above the new tab\'s initial position', async ({ context, extensionId }) => {
    // The bug: when a new tab is created at the bottom of the tab list (initial position X)
    // and background.js moves it into a group near the top (final position Y << X),
    // the sidebar must scroll to Y — not stay at the scroll position that showed X.
    const sidebar = await context.newPage();
    await sidebar.goto(`chrome-extension://${extensionId}/sidebar/sidebar.html`);

    // Create 5 tabs and group them (setting is still off, so they won't auto-group)
    for (let i = 0; i < 5; i++) {
        const p = await context.newPage();
        await p.goto(`https://example.com?g=${i}`, { waitUntil: 'commit' });
    }
    await sidebar.evaluate(async () => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const tabIds = tabs.filter(t => t.url.includes('example.com')).map(t => t.id);
        const groupId = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(groupId, { title: 'Target Group', color: 'blue' });
    });

    // Create 15 filler tabs AFTER the group — these push the new tab's initial
    // creation position far below the group, maximising the X-vs-Y distance
    await sidebar.evaluate(async () => {
        for (let i = 0; i < 15; i++) await chrome.tabs.create({ url: 'about:blank' });
    });

    await expect(sidebar.locator('.group-name', { hasText: 'Target Group' })).toBeVisible();

    // Enable newTabInGroup and activate a group tab so background.js targets that group
    await sidebar.evaluate(async () => {
        await chrome.storage.sync.set({ newTabInGroup: true });
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const groupTab = tabs.find(t => t.groupId !== -1);
        await chrome.tabs.update(groupTab.id, { active: true });
    });

    // Small viewport so the sidebar is scrollable
    await sidebar.setViewportSize({ width: 400, height: 200 });

    // Create new tab — it appears at the end of the list first (initial position X),
    // then background.js moves and groups it near the top (final position Y)
    await sidebar.evaluate(async () => {
        await chrome.tabs.create({});
    });

    // Wait for the new tab to land inside the group, then let renders settle
    await sidebar.waitForFunction(() => {
        return document.querySelector('.tab-group .tab-row.active') !== null;
    }, { timeout: 10000 });
    await sidebar.waitForTimeout(500);

    // The active tab row (now in the group near the top) must be visible
    const isInView = await sidebar.evaluate(() => {
        const tree = document.getElementById('tab-tree');
        const activeRow = document.querySelector('.tab-row.active');
        if (!activeRow) return false;
        const treeRect = tree.getBoundingClientRect();
        const rowRect = activeRow.getBoundingClientRect();
        return rowRect.top >= treeRect.top - 1 && rowRect.bottom <= treeRect.bottom + 1;
    });
    expect(isInView).toBe(true);
});
