const tabTree = document.getElementById('tab-tree');
const searchInput = document.getElementById('search-input');

// --- State ---
let allTabs = [];
let allGroups = [];

// --- Group color map ---
const GROUP_COLORS = {
    grey:   { color: '#9aa0a6', bg: 'rgba(154, 160, 166, 0.12)' },
    blue:   { color: '#4e8ef7', bg: 'rgba( 78, 142, 247, 0.12)' },
    red:    { color: '#e8453c', bg: 'rgba(232,  69,  60, 0.12)' },
    yellow: { color: '#f9ab00', bg: 'rgba(249, 171,   0, 0.12)' },
    green:  { color: '#34a853', bg: 'rgba( 52, 168,  83, 0.12)' },
    pink:   { color: '#e91e8c', bg: 'rgba(233,  30, 140, 0.12)' },
    purple: { color: '#a142f4', bg: 'rgba(161,  66, 244, 0.12)' },
    cyan:   { color: '#00acc1', bg: 'rgba(  0, 172, 193, 0.12)' },
    orange: { color: '#fa7b17', bg: 'rgba(250, 123,  23, 0.12)' },
};

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

// tabsToShow: tabs to render as rows (empty when collapsed and not searching)
// totalCount: always the full tab count in the group (for the header label)
// collapsed: whether to apply the collapsed CSS class (affects chevron + padding)
function renderGroupSection(group, tabsToShow, totalCount, collapsed) {
    const { color, bg } = GROUP_COLORS[group.color] ?? GROUP_COLORS.grey;

    const section = document.createElement('div');
    section.className = 'tab-group' + (collapsed ? ' collapsed' : '');
    section.style.setProperty('--group-color', color);
    section.style.setProperty('--group-bg', bg);

    const header = document.createElement('div');
    header.className = 'tab-group-header';
    header.addEventListener('click', () => {
        chrome.tabGroups.update(group.id, { collapsed: !group.collapsed })
            .then(loadTabs)
            .catch(console.error);
    });

    const dot = document.createElement('span');
    dot.className = 'group-dot';
    header.appendChild(dot);

    const name = document.createElement('span');
    name.className = 'group-name';
    name.textContent = group.title || '';
    header.appendChild(name);

    const count = document.createElement('span');
    count.className = 'group-count';
    count.textContent = `${totalCount} tab${totalCount !== 1 ? 's' : ''}`;
    header.appendChild(count);

    const chevron = document.createElement('span');
    chevron.className = 'group-chevron';
    header.appendChild(chevron);

    section.appendChild(header);

    for (const tab of tabsToShow) {
        section.appendChild(renderTabRow(tab));
    }

    return section;
}

function render(query = '') {
    tabTree.innerHTML = '';

    const q = query.toLowerCase();
    const groupById = Object.fromEntries(allGroups.map(g => [g.id, g]));

    // Walk tabs in order, batching consecutive tabs that share a groupId
    const segments = [];
    for (const tab of allTabs) {
        const last = segments[segments.length - 1];
        if (last && last.groupId === tab.groupId) {
            last.tabs.push(tab);
        } else {
            segments.push({ groupId: tab.groupId, tabs: [tab] });
        }
    }

    let anyRendered = false;

    for (const { groupId, tabs } of segments) {
        const matchingTabs = q
            ? tabs.filter(t =>
                (t.title || '').toLowerCase().includes(q) ||
                (t.url || '').toLowerCase().includes(q))
            : tabs;

        if (matchingTabs.length === 0) continue;
        anyRendered = true;

        const group = groupById[groupId];
        if (group) {
            // When searching, always expand so matches are visible
            const collapsed = group.collapsed && !q;
            const tabsToShow = collapsed ? [] : matchingTabs;
            tabTree.appendChild(renderGroupSection(group, tabsToShow, tabs.length, collapsed));
        } else {
            for (const tab of matchingTabs) {
                tabTree.appendChild(renderTabRow(tab));
            }
        }
    }

    if (!anyRendered) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No tabs found.';
        tabTree.appendChild(empty);
        return;
    }

    tabTree.querySelector('.tab-row.active')?.scrollIntoView({ block: 'nearest' });
}

// --- Data fetching ---

async function loadTabs() {
    const currentWindow = await chrome.windows.getCurrent({ populate: true });
    allGroups = await chrome.tabGroups.query({ windowId: currentWindow.id });
    allTabs = currentWindow.tabs.sort((a, b) => a.index - b.index);
    render(searchInput.value);
}

// --- Event listeners ---

searchInput.addEventListener('input', () => render(searchInput.value));

chrome.tabs.onCreated.addListener(loadTabs);
chrome.tabs.onRemoved.addListener(loadTabs);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if ('title' in changeInfo || 'favIconUrl' in changeInfo || 'status' in changeInfo || 'groupId' in changeInfo) loadTabs();
});
chrome.tabs.onActivated.addListener(loadTabs);
chrome.tabs.onMoved.addListener(loadTabs);
chrome.tabGroups.onCreated.addListener(loadTabs);
chrome.tabGroups.onRemoved.addListener(loadTabs);
chrome.tabGroups.onUpdated.addListener(loadTabs);

// Initial load
loadTabs();
