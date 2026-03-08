const { test: base, chromium } = require('@playwright/test');
const path = require('path');

const extensionPath = path.join(__dirname, '..');

const test = base.extend({
    context: async ({}, use) => {
        const context = await chromium.launchPersistentContext('', {
            headless: false,
            slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
            args: [
                `--disable-extensions-except=${extensionPath}`,
                `--load-extension=${extensionPath}`,
            ],
        });
        await use(context);
        await context.close();
    },

    extensionId: async ({ context }, use) => {
        let [background] = context.serviceWorkers();
        if (!background) background = await context.waitForEvent('serviceworker');
        const id = background.url().split('/')[2];
        await use(id);
    },
});

const expect = test.expect;
module.exports = { test, expect };
