const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    use: {
        headless: false,
        screenshot: 'only-on-failure',
    },
    workers: 1, // extensions require a persistent context, can't parallelize
});
