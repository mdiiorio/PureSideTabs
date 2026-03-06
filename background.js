// Disable automatic side panel on action click — the popup handles it instead
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

// --- Sidebar toggle ---

// Track open state per window (session memory only)
const sidebarOpen = new Map();

chrome.commands.onCommand.addListener((command, tab) => {
    if (command !== 'toggle-sidebar') return;
    const windowId = tab.windowId;
    const isOpen = sidebarOpen.get(windowId) ?? false;
    if (isOpen) {
        chrome.sidePanel.setOptions({ enabled: false });
        sidebarOpen.set(windowId, false);
    } else {
        // setOptions and open must not be awaited — any async gap
        // before open() destroys the user gesture context Chrome requires
        chrome.sidePanel.setOptions({ enabled: true });
        chrome.sidePanel.open({ windowId });
        sidebarOpen.set(windowId, true);
    }
});

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
