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

// Serialize pushMru calls to prevent read-modify-write races on rapid tab switching
let pushMruQueue = Promise.resolve();

function pushMru(tabId, windowId) {
    pushMruQueue = pushMruQueue.then(() => _pushMru(tabId, windowId));
}

async function _pushMru(tabId, windowId) {
    const key = `mru_${windowId}`;
    const { [key]: mruTabIds = [] } = await chrome.storage.session.get(key);
    const updated = [tabId, ...mruTabIds.filter(id => id !== tabId)].slice(0, MAX_MRU);
    await chrome.storage.session.set({ [key]: updated });
    persistMru(windowId); // fire and forget
}

function isUserUrl(url) {
    return url && url !== 'chrome://newtab/' && url !== 'about:blank' && url !== 'about:newtab';
}

async function persistMru(windowId) {
    const tokenKey = `windowToken_${windowId}`;
    let { [tokenKey]: windowToken } = await chrome.storage.session.get(tokenKey);
    if (!windowToken) {
        windowToken = crypto.randomUUID();
        await chrome.storage.session.set({ [tokenKey]: windowToken });
    }

    const mruKey = `mru_${windowId}`;
    const { [mruKey]: mruTabIds = [] } = await chrome.storage.session.get(mruKey);
    if (mruTabIds.length === 0) return;

    const tabs = await chrome.tabs.query({ windowId });
    const urlById = Object.fromEntries(tabs.map(t => [t.id, t.url || t.pendingUrl || '']));
    const fingerprint = [...new Set(tabs.map(t => t.url || t.pendingUrl || '').filter(isUserUrl))];
    const mruUrls = mruTabIds.map(id => urlById[id]).filter(isUserUrl);
    if (mruUrls.length === 0) return;

    const { persistedMru = {} } = await chrome.storage.local.get('persistedMru');
    persistedMru[windowToken] = { fingerprint, mruUrls, savedAt: Date.now() };

    const entries = Object.entries(persistedMru);
    if (entries.length > 10) {
        entries.sort((a, b) => b[1].savedAt - a[1].savedAt);
        await chrome.storage.local.set({ persistedMru: Object.fromEntries(entries.slice(0, 10)) });
    } else {
        await chrome.storage.local.set({ persistedMru });
    }
}

async function restoreMru() {
    const { persistedMru = {} } = await chrome.storage.local.get('persistedMru');
    if (Object.keys(persistedMru).length === 0) return;

    const windows = await chrome.windows.getAll({ populate: true });
    const usedTokens = new Set();

    for (const win of windows) {
        const tabByUrl = new Map();
        for (const tab of win.tabs) {
            const url = tab.url || tab.pendingUrl || '';
            if (isUserUrl(url)) tabByUrl.set(url, tab.id);
        }
        if (tabByUrl.size === 0) continue;

        // Skip windows that already have live session MRU data — this means the
        // service worker restarted mid-session (session storage persists across SW
        // restarts), so there's nothing to restore and we must not overwrite.
        const sessionKey = `mru_${win.id}`;
        const { [sessionKey]: existingMru } = await chrome.storage.session.get(sessionKey);
        if (existingMru && existingMru.length > 0) continue;

        let bestToken = null;
        let bestScore = 0;
        for (const [token, entry] of Object.entries(persistedMru)) {
            if (usedTokens.has(token)) continue;
            const score = entry.fingerprint.filter(url => tabByUrl.has(url)).length;
            if (score > bestScore) { bestScore = score; bestToken = token; }
        }
        if (!bestToken) continue;
        usedTokens.add(bestToken);

        const restoredIds = persistedMru[bestToken].mruUrls
            .map(url => tabByUrl.get(url))
            .filter(Boolean);
        if (restoredIds.length === 0) continue;

        await chrome.storage.session.set({
            [`mru_${win.id}`]: restoredIds,
            [`windowToken_${win.id}`]: bestToken,
        });

        const activeTab = win.tabs.find(t => t.active);
        if (activeTab) activeTabByWindow.set(win.id, activeTab.id);
    }
}

// Run immediately for extension restarts (tabs already exist, URLs available)
restoreMru();

// Also run on browser startup — onStartup fires after Chrome has restored
// the session, giving tabs time to have their URLs populated
chrome.runtime.onStartup.addListener(restoreMru);

// Track the active tab per window synchronously so onCreated can read it
// without a race against onActivated firing for the new tab
const activeTabByWindow = new Map();

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
    activeTabByWindow.set(windowId, tabId);
    pushMru(tabId, windowId);
});

// --- Session restore detection ---

// True once the startup restore burst has settled. Defaults to true so that
// mid-session service worker restarts (where no onStartup fires) are unaffected.
let restoreSettled = true;
let restoreSettleTimer = null;

function bumpRestoreSettleTimer() {
    clearTimeout(restoreSettleTimer);
    restoreSettleTimer = setTimeout(() => { restoreSettled = true; }, 500);
}

chrome.runtime.onStartup.addListener(() => {
    restoreSettled = false;
    bumpRestoreSettleTimer();
});

// --- New tab group placement ---

chrome.tabGroups.onCreated.addListener(async (group) => {
    if (!restoreSettled) { bumpRestoreSettleTimer(); return; }
    const { tabGroupsAlwaysAtTop = false } = await chrome.storage.sync.get(['tabGroupsAlwaysAtTop']);
    if (!tabGroupsAlwaysAtTop) return;

    const allTabs = await chrome.tabs.query({ windowId: group.windowId });

    const newGroupTabs = allTabs.filter(t => t.groupId === group.id).sort((a, b) => a.index - b.index);
    if (newGroupTabs.length === 0) return;

    const otherGroupedTabs = allTabs.filter(t => t.groupId !== -1 && t.groupId !== group.id)
        .sort((a, b) => a.index - b.index);

    let targetIndex;
    if (otherGroupedTabs.length > 0) {
        targetIndex = otherGroupedTabs[otherGroupedTabs.length - 1].index + 1;
    } else {
        const pinnedTabs = allTabs.filter(t => t.pinned);
        targetIndex = pinnedTabs.length;
    }

    if (newGroupTabs[0].index === targetIndex) return;

    // tabGroups.move uses the index in the post-removal array; adjust when the
    // new group's tabs sit before the target, since removing them shifts it down.
    if (newGroupTabs[0].index < targetIndex) {
        targetIndex -= newGroupTabs.length;
    }

    await chrome.tabGroups.move(group.id, { index: targetIndex });
});

chrome.tabs.onCreated.addListener(async (tab) => {
    if (!restoreSettled) { bumpRestoreSettleTimer(); return; }
    // Capture synchronously before any await — onActivated for the new tab
    // may fire before async operations complete, overwriting activeTabByWindow
    const prevTabId = activeTabByWindow.get(tab.windowId);

    const { newTabInGroup = false, tabGroupsAlwaysAtTop = false } =
        await chrome.storage.sync.get(['newTabInGroup', 'tabGroupsAlwaysAtTop']);

    if (tabGroupsAlwaysAtTop) {
        const allTabs = await chrome.tabs.query({ windowId: tab.windowId });
        const groupedTabs = allTabs.filter(t => t.groupId !== -1).sort((a, b) => a.index - b.index);
        if (groupedTabs.length > 0) {
            const firstGroupIndex = groupedTabs[0].index;
            const lastGroupIndex = groupedTabs[groupedTabs.length - 1].index;
            if (tab.index < firstGroupIndex || (tab.index <= lastGroupIndex && tab.groupId === -1)) {
                const targetIndex = lastGroupIndex + (tab.index > lastGroupIndex ? 1 : 0);
                try {
                    await chrome.tabs.move(tab.id, { index: targetIndex });
                } catch {
                    return;
                }
                return;
            }
        }
    }

    // Only intercept new tab pages for newTabInGroup feature
    if (tab.pendingUrl !== 'chrome://newtab/') return;

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
    try {
        await chrome.tabs.move(tab.id, { index });
        await chrome.tabs.group({ tabIds: [tab.id], groupId: prevTab.groupId });
    } catch {
        return;
    }
});

chrome.tabs.onRemoved.addListener((tabId, { windowId, isWindowClosing }) => {
    if (isWindowClosing) return; // window cleanup handles this
    pushMruQueue = pushMruQueue.then(async () => {
        const key = `mru_${windowId}`;
        const { [key]: mruTabIds = [] } = await chrome.storage.session.get(key);
        await chrome.storage.session.set({ [key]: mruTabIds.filter(id => id !== tabId) });
    });
});

chrome.windows.onRemoved.addListener(async (windowId) => {
    await chrome.storage.session.remove(`mru_${windowId}`);
    activeTabByWindow.delete(windowId);
});
