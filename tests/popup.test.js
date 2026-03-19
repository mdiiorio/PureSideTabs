const { test, expect } = require('./fixtures');

test('pressing / opens search mode', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);

    // Wait for normal render to settle before pressing /
    await expect(popup.locator('.tab-row').first()).toBeVisible();

    await popup.keyboard.press('/');
    await expect(popup.locator('.search-input')).toBeVisible();
    await expect(popup.locator('.search-input')).toBeFocused();
});

test('search filters open tabs by title', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await expect(popup.locator('.tab-row').first()).toBeVisible();

    await popup.keyboard.press('/');
    await popup.locator('.search-input').fill('Example');

    await expect(popup.locator('.tab-title', { hasText: 'Example Domain' })).toBeVisible();
});

test('search excludes non-matching tabs', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await expect(popup.locator('.tab-row').first()).toBeVisible();

    await popup.keyboard.press('/');
    await popup.locator('.search-input').fill('zzznomatch');

    await expect(popup.locator('.tab-row')).toHaveCount(0);
});

test('escape exits search mode and restores normal view', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await expect(popup.locator('.tab-row').first()).toBeVisible();

    await popup.keyboard.press('/');
    await expect(popup.locator('.search-input')).toBeVisible();

    await popup.keyboard.press('Escape');
    await expect(popup.locator('.search-input')).not.toBeVisible();
    await expect(popup.locator('.tab-row').first()).toBeVisible();
});

test('recently closed tabs appear in search with restore marker', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.close();

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await expect(popup.locator('.section-label').first()).toBeVisible();

    await popup.keyboard.press('/');
    await popup.locator('.search-input').fill('Example');

    await expect(popup.locator('.closed-tab .tab-title', { hasText: 'Example Domain' })).toBeVisible();
    await expect(popup.locator('.closed-tab .closed-tab-marker')).toBeVisible();
});
