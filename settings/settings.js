const DEFAULT_MRU_LIMIT = 10;

const mruInput = document.getElementById('mru-limit');
const newTabInGroupInput = document.getElementById('new-tab-in-group');
const tabGroupsAlwaysAtTopInput = document.getElementById('tab-groups-always-at-top');

async function load() {
    const { mruLimit = DEFAULT_MRU_LIMIT, newTabInGroup = false, tabGroupsAlwaysAtTop = false } =
        await chrome.storage.sync.get(['mruLimit', 'newTabInGroup', 'tabGroupsAlwaysAtTop']);
    mruInput.value = mruLimit;
    newTabInGroupInput.checked = newTabInGroup;
    tabGroupsAlwaysAtTopInput.checked = tabGroupsAlwaysAtTop;
}

mruInput.addEventListener('change', async () => {
    const value = Math.max(1, Math.min(10, parseInt(mruInput.value) || DEFAULT_MRU_LIMIT));
    mruInput.value = value;
    await chrome.storage.sync.set({ mruLimit: value });
});

newTabInGroupInput.addEventListener('change', async () => {
    await chrome.storage.sync.set({ newTabInGroup: newTabInGroupInput.checked });
});

tabGroupsAlwaysAtTopInput.addEventListener('change', async () => {
    await chrome.storage.sync.set({ tabGroupsAlwaysAtTop: tabGroupsAlwaysAtTopInput.checked });
});

load();
