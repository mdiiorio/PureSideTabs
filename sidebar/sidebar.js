const tabTree = document.getElementById('tab-tree');
const searchInput = document.getElementById('search-input');

// --- State ---
let allTabs = [];

// --- Render ---

function renderTabRow(tab) {
    const row = document.createElement('div');
    row.className = 'tab-row' + (tab.active ? ' active' : '');
    row.dataset.tabId = tab.id;

    row.appendChild(renderFavicon(tab));

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title || tab.url || '(New Tab)';
    title.title = tab.title || tab.url || '';
    row.appendChild(title);

    const closeBtn = document.createElement('span');
    closeBtn.className = 'tab-close';
    closeBtn.textContent = '×';
    closeBtn.title = 'Close tab';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.tabs.remove(tab.id);
    });
    row.appendChild(closeBtn);

    row.addEventListener('click', () => {
        chrome.tabs.update(tab.id, { active: true });
    });

    return row;
}

function render(query = '') {
    tabTree.innerHTML = '';

    const q = query.toLowerCase();
    const filtered = q
        ? allTabs.filter(
            (t) =>
                (t.title || '').toLowerCase().includes(q) ||
                (t.url || '').toLowerCase().includes(q)
        )
        : allTabs;

    if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No tabs found.';
        tabTree.appendChild(empty);
        return;
    }

    filtered.forEach((tab) => tabTree.appendChild(renderTabRow(tab)));

    tabTree.querySelector('.tab-row.active')?.scrollIntoView({ block: 'nearest' });
}

// --- Data fetching ---

async function loadTabs() {
    const currentWindow = await chrome.windows.getCurrent({ populate: true });
    allTabs = currentWindow.tabs.sort((a, b) => a.index - b.index);
    render(searchInput.value);
}

// --- Event listeners ---

searchInput.addEventListener('input', () => render(searchInput.value));

chrome.tabs.onCreated.addListener(loadTabs);
chrome.tabs.onRemoved.addListener(loadTabs);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if ('title' in changeInfo || 'favIconUrl' in changeInfo || 'status' in changeInfo) loadTabs();
});
chrome.tabs.onActivated.addListener(loadTabs);
chrome.tabs.onMoved.addListener(loadTabs);

// Initial load
loadTabs();
