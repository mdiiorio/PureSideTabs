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
