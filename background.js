// Disable automatic side panel on action click — the popup handles it instead
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

// --- Recently used tab tracking ---

const MAX_MRU = 10;

async function pushMru(tabId) {
    const { mruTabIds = [] } = await chrome.storage.session.get('mruTabIds');
    const updated = [tabId, ...mruTabIds.filter(id => id !== tabId)].slice(0, MAX_MRU);
    await chrome.storage.session.set({ mruTabIds: updated });
}

chrome.tabs.onActivated.addListener(({ tabId }) => pushMru(tabId));

chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.session.get('mruTabIds').then(({ mruTabIds = [] }) => {
        chrome.storage.session.set({ mruTabIds: mruTabIds.filter(id => id !== tabId) });
    });
});
