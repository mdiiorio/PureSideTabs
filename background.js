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

// Track the active tab per window synchronously so onCreated can read it
// without a race against onActivated firing for the new tab
const activeTabByWindow = new Map();

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
    activeTabByWindow.set(windowId, tabId);
    pushMru(tabId);
});

// --- New tab group placement ---

chrome.tabs.onCreated.addListener(async (tab) => {
    // Only intercept new tab pages, not link-opened tabs
    if (tab.pendingUrl !== 'chrome://newtab/') return;

    // Capture synchronously before any await — onActivated for the new tab
    // may fire before async operations complete, overwriting activeTabByWindow
    const prevTabId = activeTabByWindow.get(tab.windowId);

    const { newTabInGroup = false } = await chrome.storage.sync.get('newTabInGroup');
    if (!newTabInGroup) return;

    if (!prevTabId || prevTabId === tab.id) return;

    let prevTab;
    try {
        prevTab = await chrome.tabs.get(prevTabId);
    } catch {
        return;
    }
    if (prevTab.groupId === -1) return;

    const groupTabs = await chrome.tabs.query({ groupId: prevTab.groupId });
    groupTabs.sort((a, b) => a.index - b.index);
    const lastGroupTab = groupTabs[groupTabs.length - 1];
    if (!lastGroupTab) return;

    const index = lastGroupTab.index + (tab.index > lastGroupTab.index ? 1 : 0);
    await chrome.tabs.move(tab.id, { index });
    await chrome.tabs.group({ tabIds: [tab.id], groupId: prevTab.groupId });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
    const { mruTabIds = [] } = await chrome.storage.session.get('mruTabIds');
    await chrome.storage.session.set({ mruTabIds: mruTabIds.filter(id => id !== tabId) });
});
