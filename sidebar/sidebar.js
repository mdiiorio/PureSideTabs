const tabTree = document.getElementById('tab-tree');

// --- State ---
let allTabs = [];
let allGroups = [];

// --- Drag and drop state ---
let dragState = null;       // { tabId, sourceGroupId }
let dragLocked = false;     // suppresses loadTabs() while a drag is in flight
let dropPromise = Promise.resolve();
let lastDragTarget = null;  // { targetTabId, position, groupId } — updated on each dragover
let hoverExpandTimer = null;

const dropIndicator = document.createElement('div');
dropIndicator.className = 'drop-indicator';

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

// --- Drag and drop logic ---

function getDropPosition(event, element) {
    const { top, height } = element.getBoundingClientRect();
    return event.clientY < top + height / 2 ? 'before' : 'after';
}

function positionIndicator(row, position) {
    const treeRect = tabTree.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const y = (position === 'before' ? rowRect.top : rowRect.bottom) - treeRect.top + tabTree.scrollTop - 1;
    dropIndicator.style.top = `${y}px`;
    dropIndicator.style.left = `${rowRect.left - treeRect.left}px`;
    dropIndicator.style.right = `${treeRect.right - rowRect.right}px`;
    if (!dropIndicator.isConnected) tabTree.appendChild(dropIndicator);
}

async function executeDrop(targetTabId, position, targetGroupId) {
    const { tabId, sourceGroupId } = dragState;
    if (tabId === targetTabId) return;

    const targetTab = allTabs.find(t => t.id === targetTabId);
    if (!targetTab) return;

    const draggedTab = allTabs.find(t => t.id === tabId);
    let index = position === 'before' ? targetTab.index : targetTab.index + 1;
    // Chrome removes the dragged tab before inserting, shifting subsequent indices down
    if (draggedTab && draggedTab.index < targetTab.index) index -= 1;

    try {
        if (targetGroupId !== -1) {
            // Group first so Chrome places it inside the group, then position precisely
            await chrome.tabs.group({ tabIds: [tabId], groupId: targetGroupId });
            await chrome.tabs.move(tabId, { index });
        } else {
            await chrome.tabs.move(tabId, { index });
            if (sourceGroupId !== -1) await chrome.tabs.ungroup([tabId]);
        }
    } catch (e) {
        console.error('executeDrop failed:', e);
    }
}

async function executeDropOnGroup(groupId) {
    const { tabId } = dragState;
    try {
        await chrome.tabs.group({ tabIds: [tabId], groupId });

        // chrome.tabs.group() places the tab wherever it wants, so query fresh
        // positions and move to end if needed
        const currentWindow = await chrome.windows.getCurrent({ populate: true });
        const freshGroupTabs = currentWindow.tabs
            .filter(t => t.groupId === groupId)
            .sort((a, b) => a.index - b.index);
        const lastTab = freshGroupTabs[freshGroupTabs.length - 1];

        if (lastTab && lastTab.id !== tabId) {
            const draggedFreshTab = freshGroupTabs.find(t => t.id === tabId);
            let index = lastTab.index + 1;
            if (draggedFreshTab && draggedFreshTab.index < lastTab.index) index -= 1;
            await chrome.tabs.move(tabId, { index });
        }
    } catch (e) {
        console.error('executeDropOnGroup failed:', e);
    }
}

async function executeGroupDrop(targetTabId, position) {
    const { groupId } = dragState;
    const groupTabs = allTabs
        .filter(t => t.groupId === groupId)
        .sort((a, b) => a.index - b.index);
    if (!groupTabs.length) return;

    const targetTab = allTabs.find(t => t.id === targetTabId);
    if (!targetTab || targetTab.groupId === groupId) return;

    let index = position === 'before' ? targetTab.index : targetTab.index + 1;
    // Chrome removes the group tabs before inserting, shifting subsequent indices down
    if (groupTabs[0].index < targetTab.index) index -= groupTabs.length;

    const wasCollapsed = allGroups.find(g => g.id === groupId)?.collapsed ?? false;

    try {
        await chrome.tabGroups.move(groupId, { index });
        if (wasCollapsed) await chrome.tabGroups.update(groupId, { collapsed: true });
    } catch (e) {
        console.error('executeGroupDrop failed:', e);
    }
}

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

    row.draggable = true;

    row.addEventListener('dragstart', (e) => {
        dragState = { type: 'tab', tabId: tab.id, sourceGroupId: tab.groupId ?? -1 };
        dragLocked = true;
        e.dataTransfer.effectAllowed = 'move';
        // rAF so Chrome captures the un-dimmed element as the drag ghost
        requestAnimationFrame(() => row.classList.add('dragging'));
    });

    row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        dropIndicator.remove();
        tabTree.querySelector('.drop-target')?.classList.remove('drop-target');
        lastDragTarget = null;
        clearTimeout(hoverExpandTimer);
        hoverExpandTimer = null;
        dropPromise.finally(() => {
            dragState = null;
            dragLocked = false;
            loadTabs();
        });
    });

    row.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (tab.pinned) {
            const draggedTab = dragState?.type === 'tab' ? allTabs.find(t => t.id === dragState.tabId) : null;
            if (!draggedTab?.pinned) return; // don't allow dropping non-pinned or groups into pinned section
        }
        if (dragState?.type === 'group') {
            if (tab.groupId === dragState.groupId) return; // skip rows in the dragged group
            const groupSection = row.closest('.tab-group');
            if (groupSection) {
                // Snap indicator to the boundary of the hovered group, not between individual rows
                const pos = getDropPosition(e, groupSection);
                const groupTabsSorted = allTabs
                    .filter(t => t.groupId === parseInt(groupSection.dataset.groupId))
                    .sort((a, b) => a.index - b.index);
                if (!groupTabsSorted.length) return;
                const targetTabId = pos === 'before'
                    ? groupTabsSorted[0].id
                    : groupTabsSorted[groupTabsSorted.length - 1].id;
                lastDragTarget = { targetTabId, position: pos };
                positionIndicator(groupSection, pos);
            } else {
                const pos = getDropPosition(e, row);
                lastDragTarget = { targetTabId: tab.id, position: pos };
                positionIndicator(row, pos);
            }
            return;
        }
        const pos = getDropPosition(e, row);
        const groupSection = row.closest('.tab-group');
        const groupId = groupSection ? parseInt(groupSection.dataset.groupId) : -1;
        lastDragTarget = { targetTabId: tab.id, position: pos, groupId };
        positionIndicator(row, pos);
    });

    row.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!lastDragTarget) return;
        const { targetTabId, position, groupId } = lastDragTarget;
        if (dragState?.type === 'group') {
            dropPromise = executeGroupDrop(targetTabId, position);
        } else {
            dropPromise = executeDrop(targetTabId, position, groupId);
        }
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
    section.dataset.groupId = group.id;
    section.style.setProperty('--group-color', color);
    section.style.setProperty('--group-bg', bg);

    const header = document.createElement('div');
    header.className = 'tab-group-header';
    header.addEventListener('click', () => {
        chrome.tabGroups.update(group.id, { collapsed: !group.collapsed })
            .then(loadTabs)
            .catch(console.error);
    });

    header.draggable = true;

    header.addEventListener('dragstart', (e) => {
        dragState = { type: 'group', groupId: group.id };
        dragLocked = true;
        e.dataTransfer.effectAllowed = 'move';
        requestAnimationFrame(() => section.classList.add('dragging'));
    });

    header.addEventListener('dragend', () => {
        section.classList.remove('dragging');
        dropIndicator.remove();
        tabTree.querySelector('.drop-target')?.classList.remove('drop-target');
        lastDragTarget = null;
        clearTimeout(hoverExpandTimer);
        hoverExpandTimer = null;
        dropPromise.finally(() => {
            dragState = null;
            dragLocked = false;
            loadTabs();
        });
    });

    header.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (dragState?.type === 'group') {
            if (dragState.groupId === group.id) return; // skip own header
            const pos = getDropPosition(e, section);
            const groupTabsSorted = allTabs
                .filter(t => t.groupId === group.id)
                .sort((a, b) => a.index - b.index);
            if (!groupTabsSorted.length) return;
            const targetTabId = pos === 'before'
                ? groupTabsSorted[0].id
                : groupTabsSorted[groupTabsSorted.length - 1].id;
            lastDragTarget = { targetTabId, position: pos };
            positionIndicator(section, pos);
        } else {
            // Tab drag: highlight the group to show the tab will be added to it
            dropIndicator.remove();
            section.classList.add('drop-target');

            // Hover for 1s over a collapsed group to expand it
            if (group.collapsed && hoverExpandTimer === null) {
                hoverExpandTimer = setTimeout(async () => {
                    hoverExpandTimer = null;
                    await chrome.tabGroups.update(group.id, { collapsed: false });
                    const g = allGroups.find(ag => ag.id === group.id);
                    if (g) g.collapsed = false;
                    render();
                }, 1000);
            }
        }
    });

    header.addEventListener('dragleave', (e) => {
        if (header.contains(e.relatedTarget)) return;
        section.classList.remove('drop-target');
        clearTimeout(hoverExpandTimer);
        hoverExpandTimer = null;
    });

    header.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        section.classList.remove('drop-target');
        if (dragState?.type === 'group') {
            if (!lastDragTarget) return;
            dropPromise = executeGroupDrop(lastDragTarget.targetTabId, lastDragTarget.position);
        } else {
            dropPromise = executeDropOnGroup(group.id);
        }
    });

    const chevron = document.createElement('span');
    chevron.className = 'group-chevron';
    header.appendChild(chevron);

    const name = document.createElement('span');
    name.className = 'group-name';
    name.textContent = group.title || '';
    header.appendChild(name);

    const count = document.createElement('span');
    count.className = 'group-count';
    count.textContent = `${totalCount} tab${totalCount !== 1 ? 's' : ''}`;
    header.appendChild(count);

    section.appendChild(header);

    for (const tab of tabsToShow) {
        section.appendChild(renderTabRow(tab));
    }

    return section;
}

function render() {
    tabTree.innerHTML = '';

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

    let renderedPinned = false;
    let separatorInserted = false;

    for (const { groupId, tabs } of segments) {
        const group = groupById[groupId];
        if (group) {
            // Groups can't contain pinned tabs — insert separator before first group after pinned section
            if (renderedPinned && !separatorInserted) {
                const sep = document.createElement('div');
                sep.className = 'pinned-separator';
                tabTree.appendChild(sep);
                separatorInserted = true;
            }
            const collapsed = group.collapsed;
            const tabsToShow = collapsed ? [] : tabs;
            tabTree.appendChild(renderGroupSection(group, tabsToShow, tabs.length, collapsed));
        } else {
            for (const tab of tabs) {
                if (tab.pinned) {
                    renderedPinned = true;
                } else if (renderedPinned && !separatorInserted) {
                    const sep = document.createElement('div');
                    sep.className = 'pinned-separator';
                    tabTree.appendChild(sep);
                    separatorInserted = true;
                }
                tabTree.appendChild(renderTabRow(tab));
            }
        }
    }

    tabTree.querySelector('.tab-row.active')?.scrollIntoView({ block: 'nearest' });
}

// Fallback handlers on the container so drops in gaps between rows still land
tabTree.addEventListener('dragover', (e) => {
    if (!dragState) return;
    e.preventDefault();
});

tabTree.addEventListener('drop', (e) => {
    if (!dragState || !lastDragTarget) return;
    e.preventDefault();
    const { targetTabId, position, groupId } = lastDragTarget;
    if (dragState.type === 'group') {
        dropPromise = executeGroupDrop(targetTabId, position);
    } else {
        dropPromise = executeDrop(targetTabId, position, groupId);
    }
});

// --- Data fetching ---

async function loadTabs() {
    if (dragLocked) return;
    const currentWindow = await chrome.windows.getCurrent({ populate: true });
    allGroups = await chrome.tabGroups.query({ windowId: currentWindow.id });
    allTabs = currentWindow.tabs.sort((a, b) => a.index - b.index);
    render();
}

// --- Patch updates (in-place DOM mutation, no full re-render) ---

function patchTab(tabId, changeInfo) {
    const tab = allTabs.find(t => t.id === tabId);
    if (tab) Object.assign(tab, changeInfo);

    const row = tabTree.querySelector(`[data-tab-id="${tabId}"]`);
    if (!row) return; // tab may be inside a collapsed group — in-memory update is enough

    if ('title' in changeInfo) {
        const titleEl = row.querySelector('.tab-title');
        if (titleEl) {
            titleEl.textContent = changeInfo.title || tab?.url || '(New Tab)';
            titleEl.title = changeInfo.title || tab?.url || '';
        }
    }

    if ('favIconUrl' in changeInfo) {
        const img = row.querySelector('.tab-favicon');
        const updatedTab = allTabs.find(t => t.id === tabId);
        if (img && updatedTab) img.replaceWith(renderFavicon(updatedTab));
    }
}

// --- Event listeners ---

chrome.tabs.onCreated.addListener(loadTabs);
chrome.tabs.onRemoved.addListener(loadTabs);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if ('groupId' in changeInfo) {
        loadTabs();
    } else if ('title' in changeInfo || 'favIconUrl' in changeInfo) {
        patchTab(tabId, changeInfo);
    }
});
chrome.tabs.onActivated.addListener(({ tabId }) => {
    allTabs.forEach(t => { t.active = t.id === tabId; });
    tabTree.querySelector('.tab-row.active')?.classList.remove('active');
    tabTree.querySelector(`[data-tab-id="${tabId}"]`)?.classList.add('active');
});
chrome.tabs.onMoved.addListener(loadTabs);
chrome.tabGroups.onCreated.addListener(loadTabs);
chrome.tabGroups.onRemoved.addListener(loadTabs);
chrome.tabGroups.onUpdated.addListener(loadTabs);

// Initial load
loadTabs();
