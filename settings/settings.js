const DEFAULT_MRU_LIMIT = 10;

const input = document.getElementById('mru-limit');

async function load() {
    const { mruLimit = DEFAULT_MRU_LIMIT } = await chrome.storage.sync.get('mruLimit');
    input.value = mruLimit;
}

input.addEventListener('change', async () => {
    const value = Math.max(1, Math.min(10, parseInt(input.value) || DEFAULT_MRU_LIMIT));
    input.value = value;
    await chrome.storage.sync.set({ mruLimit: value });
});

load();
