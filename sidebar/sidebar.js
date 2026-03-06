const tabTree = document.getElementById('tab-tree');
const searchInput = document.getElementById('search-input');

// --- State ---
let allTabs = [];

// --- Render ---

function getFaviconUrl(tab) {
    if (tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://')) {
        return tab.favIconUrl;
    }
    return null;
}

function renderFavicon(tab) {
    const img = document.createElement('img');
    img.className = 'tab-favicon';
    img.width = 16;
    img.height = 16;
    const src = getFaviconUrl(tab);
    if (src) {
        img.src = src;
        img.onerror = () => {
            img.src = getFallbackSvg();
            img.className = 'tab-favicon placeholder';
        };
    } else {
        img.src = getFallbackSvg();
        img.className = 'tab-favicon placeholder';
    }
    return img;
}

function getFallbackSvg() {
    return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' rx='2' fill='%236c7086'/><rect x='3' y='5' width='10' height='1.5' rx='1' fill='%23cdd6f4'/><rect x='3' y='8' width='7' height='1.5' rx='1' fill='%23cdd6f4'/><rect x='3' y='11' width='9' height='1.5' rx='1' fill='%23cdd6f4'/></svg>`;
}

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
    const [currentWindow] = await Promise.all([
        chrome.windows.getCurrent({ populate: true }),
    ]);
    allTabs = currentWindow.tabs.sort((a, b) => a.index - b.index);
    render(searchInput.value);
}

// --- Event listeners ---

searchInput.addEventListener('input', () => render(searchInput.value));

// Listen for tab changes and re-render
chrome.tabs.onCreated.addListener(loadTabs);
chrome.tabs.onRemoved.addListener(loadTabs);
chrome.tabs.onUpdated.addListener(loadTabs);
chrome.tabs.onActivated.addListener(loadTabs);
chrome.tabs.onMoved.addListener(loadTabs);

// Initial load
loadTabs();
