const container = document.getElementById('recent-tabs');

// --- Keyboard navigation ---

let rows = [];
let selectedIndex = -1;

function setSelected(index) {
    if (rows[selectedIndex]) rows[selectedIndex].classList.remove('selected');
    selectedIndex = Math.max(0, Math.min(index, rows.length - 1));
    if (rows[selectedIndex]) {
        rows[selectedIndex].classList.add('selected');
        rows[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
}

// --- Search ---

let searchMode = false;
let searchInput = null;
let allWindowTabs = [];
let recentlyClosedTabs = [];

async function enterSearchMode() {
    searchMode = true;
    const currentWindow = await chrome.windows.getCurrent();
    const sessions = await chrome.sessions.getRecentlyClosed();

    allWindowTabs = await chrome.tabs.query({ windowId: currentWindow.id });
    recentlyClosedTabs = sessions.map(s => s.tab).filter(Boolean);

    container.innerHTML = '';
    rows = [];
    selectedIndex = -1;

    searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'search-input';
    searchInput.placeholder = 'Search tabs…';
    container.appendChild(searchInput);
    searchInput.addEventListener('input', renderSearchResults);
    searchInput.focus();
}

function renderClosedRow(tab) {
    const row = document.createElement('div');
    row.className = 'tab-row closed-tab';

    row.appendChild(renderFavicon(tab));

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title || tab.url || '(New Tab)';
    title.title = tab.title || tab.url || '';
    row.appendChild(title);

    const marker = document.createElement('span');
    marker.className = 'closed-tab-marker';
    marker.textContent = '↩';
    row.appendChild(marker);

    row.addEventListener('click', () => {
        chrome.sessions.restore(tab.sessionId);
        window.close();
    });

    return row;
}

function renderSearchResults() {
    [...container.children].forEach(el => { if (el !== searchInput) el.remove(); });
    rows = [];
    selectedIndex = -1;

    const q = searchInput.value.toLowerCase();
    if (!q) return;

    const openMatches = allWindowTabs.filter(t =>
        t.title?.toLowerCase().includes(q) || t.url?.toLowerCase().includes(q)
    );
    const closedMatches = recentlyClosedTabs.filter(t =>
        t.title?.toLowerCase().includes(q) || t.url?.toLowerCase().includes(q)
    );

    for (const tab of openMatches) {
        const row = renderRow(tab);
        rows.push(row);
        container.appendChild(row);
    }

    for (const tab of closedMatches) {
        const row = renderClosedRow(tab);
        rows.push(row);
        container.appendChild(row);
    }

    if (rows.length > 0) setSelected(0);
}

function exitSearchMode() {
    searchMode = false;
    searchInput = null;
    allWindowTabs = [];
    recentlyClosedTabs = [];
    container.innerHTML = '';
    rows = [];
    selectedIndex = -1;
    render();
}

document.addEventListener('keydown', (e) => {
    if (!searchMode && e.key === '/') {
        e.preventDefault();
        enterSearchMode();
        return;
    }
    if (searchMode && e.key === 'Escape') {
        exitSearchMode();
        return;
    }
    if (e.key === 'ArrowDown' || (!searchMode && e.key === 'j')) {
        e.preventDefault();
        setSelected(selectedIndex + 1);
    } else if (e.key === 'ArrowUp' || (!searchMode && e.key === 'k')) {
        e.preventDefault();
        setSelected(selectedIndex - 1);
    } else if (e.key === 'Enter') {
        rows[selectedIndex]?.click();
    }
});

// --- Render ---

function renderHeading(text) {
    const heading = document.createElement('div');
    heading.className = 'section-label';
    heading.textContent = text;
    return heading;
}

function renderRow(tab) {
    const row = document.createElement('div');
    row.className = 'tab-row';

    row.appendChild(renderFavicon(tab));

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title || tab.url || '(New Tab)';
    title.title = tab.title || tab.url || '';
    row.appendChild(title);

    row.addEventListener('click', () => {
        chrome.tabs.update(tab.id, { active: true });
        window.close();
    });

    return row;
}

const DEFAULT_MRU_LIMIT = 10;

async function render() {
    const currentWindow = await chrome.windows.getCurrent();
    const mruKey = `mru_${currentWindow.id}`;

    const [{ [mruKey]: mruTabIds = [] }, allTabs, { mruLimit = DEFAULT_MRU_LIMIT }] = await Promise.all([
        chrome.storage.session.get(mruKey),
        chrome.tabs.query({ windowId: currentWindow.id }),
        chrome.storage.sync.get('mruLimit'),
    ]);

    const tabById = Object.fromEntries(allTabs.map(t => [t.id, t]));
    const pinnedTabs = allTabs.filter(t => t.pinned).sort((a, b) => a.index - b.index);

    // Pinned section
    if (pinnedTabs.length > 0) {
        container.appendChild(renderHeading('Pinned Tabs'));
        for (const tab of pinnedTabs) {
            const row = renderRow(tab);
            rows.push(row);
            container.appendChild(row);
        }
    }

    // MRU section (filter out stale IDs, then limit to configured count)
    const mruTabs = mruTabIds.map(id => tabById[id]).filter(Boolean).slice(0, mruLimit);

    if (mruTabs.length === 0 && pinnedTabs.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No recent tabs yet.';
        container.appendChild(empty);
        return;
    }

    container.appendChild(renderHeading('Recent Tabs'));

    const mruStartIndex = rows.length;
    for (const tab of mruTabs) {
        const row = renderRow(tab);
        rows.push(row);
        container.appendChild(row);
    }

    // Default selection: second item in MRU section
    const defaultIndex = mruTabs.length > 1 ? mruStartIndex + 1 : mruStartIndex;
    setSelected(defaultIndex);
}

render();
