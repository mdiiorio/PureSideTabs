const DEFAULT_MRU_LIMIT = 10;

const mruInput = document.getElementById('mru-limit');
const newTabInGroupInput = document.getElementById('new-tab-in-group');

async function load() {
    const { mruLimit = DEFAULT_MRU_LIMIT, newTabInGroup = false } =
        await chrome.storage.sync.get(['mruLimit', 'newTabInGroup']);
    mruInput.value = mruLimit;
    newTabInGroupInput.checked = newTabInGroup;
}

mruInput.addEventListener('change', async () => {
    const value = Math.max(1, Math.min(10, parseInt(mruInput.value) || DEFAULT_MRU_LIMIT));
    mruInput.value = value;
    await chrome.storage.sync.set({ mruLimit: value });
});

newTabInGroupInput.addEventListener('change', async () => {
    await chrome.storage.sync.set({ newTabInGroup: newTabInGroupInput.checked });
});

load();
