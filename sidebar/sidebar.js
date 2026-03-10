const tabTree = document.getElementById('tab-tree');
const contextMenu = document.getElementById('context-menu');
const submenu = document.getElementById('submenu');
const groupDialog = document.getElementById('group-dialog');
const groupNameInput = document.getElementById('group-name-input');
const groupCreateBtn = document.getElementById('group-create-btn');
const groupCancelBtn = document.getElementById('group-cancel-btn');
const colorSwatchesEl = document.getElementById('color-swatches');

// --- State ---
let allTabs = [];
let allGroups = [];
let splitPositions = new Map(); // tabId -> 'first' | 'middle' | 'last'

const HOVER_EXPAND_DELAY_MS = 1000;

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

// --- Group dialog ---

const CHROME_GROUP_COLORS = [
    { key: 'grey',   hex: '#9aa0a6' },
    { key: 'blue',   hex: '#4e8ef7' },
    { key: 'red',    hex: '#e8453c' },
    { key: 'yellow', hex: '#f9ab00' },
    { key: 'green',  hex: '#34a853' },
    { key: 'pink',   hex: '#e91e8c' },
    { key: 'purple', hex: '#a142f4' },
    { key: 'cyan',   hex: '#00acc1' },
    { key: 'orange', hex: '#fa7b17' },
];

let groupDialogTabId = null;
let selectedColor = 'grey';

for (const { key, hex } of CHROME_GROUP_COLORS) {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch' + (key === 'grey' ? ' selected' : '');
    swatch.dataset.color = key;
    swatch.style.background = hex;
    swatch.title = key;
    swatch.addEventListener('click', () => {
        selectedColor = key;
        colorSwatchesEl.querySelectorAll('.color-swatch').forEach(s => {
            s.classList.toggle('selected', s.dataset.color === key);
        });
    });
    colorSwatchesEl.appendChild(swatch);
}

function showGroupDialog(tabId) {
    groupDialogTabId = tabId;
    selectedColor = 'grey';
    groupNameInput.value = '';
    colorSwatchesEl.querySelectorAll('.color-swatch').forEach(s => {
        s.classList.toggle('selected', s.dataset.color === 'grey');
    });
    groupDialog.classList.add('visible');
    groupNameInput.focus();
}

function hideGroupDialog() {
    groupDialog.classList.remove('visible');
    groupDialogTabId = null;
}

groupCreateBtn.addEventListener('click', async () => {
    if (!groupDialogTabId) return;
    const groupId = await chrome.tabs.group({ tabIds: [groupDialogTabId] });
    await chrome.tabGroups.update(groupId, { title: groupNameInput.value, color: selectedColor });
    hideGroupDialog();
});

groupCancelBtn.addEventListener('click', hideGroupDialog);

groupNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') groupCreateBtn.click();
    if (e.key === 'Escape') { e.stopPropagation(); hideGroupDialog(); }
});

// --- Context menu ---

let submenuHideTimer = null;

function hideSubmenu() {
    submenu.classList.remove('visible');
    clearTimeout(submenuHideTimer);
    submenuHideTimer = null;
}

function showSubmenu(triggerEl, items) {
    submenu.innerHTML = '';

    for (const item of items) {
        if (item.separator) {
            const sep = document.createElement('div');
            sep.className = 'context-menu-separator';
            submenu.appendChild(sep);
        } else {
            const el = document.createElement('div');
            el.className = 'context-menu-item';
            if (item.color) {
                const swatch = document.createElement('span');
                swatch.className = 'context-menu-color-swatch';
                swatch.style.background = item.color;
                el.appendChild(swatch);
            }
            el.appendChild(document.createTextNode(item.label));
            el.addEventListener('click', () => {
                hideSubmenu();
                hideContextMenu();
                item.action();
            });
            submenu.appendChild(el);
        }
    }

    submenu.classList.add('visible');
    const triggerRect = triggerEl.getBoundingClientRect();
    let left = triggerRect.right + 2;
    let top = triggerRect.top;
    submenu.style.left = `${left}px`;
    submenu.style.top = `${top}px`;

    const w = submenu.offsetWidth;
    const h = submenu.offsetHeight;
    if (left + w > window.innerWidth) left = triggerRect.left - w - 2;
    if (top + h > window.innerHeight) top = window.innerHeight - h - 4;
    submenu.style.left = `${Math.max(0, left)}px`;
    submenu.style.top = `${Math.max(0, top)}px`;
}

submenu.addEventListener('mouseenter', () => {
    clearTimeout(submenuHideTimer);
    submenuHideTimer = null;
});
submenu.addEventListener('mouseleave', () => {
    submenuHideTimer = setTimeout(hideSubmenu, 150);
});
submenu.addEventListener('contextmenu', (e) => e.preventDefault());

function hideContextMenu() {
    contextMenu.classList.remove('visible');
    hideSubmenu();
}

function showContextMenu(tabId, x, y) {
    const tab = allTabs.find(t => t.id === tabId);
    if (!tab) return;

    contextMenu.innerHTML = '';

    const addItem = (label, action) => {
        const el = document.createElement('div');
        el.className = 'context-menu-item';
        el.textContent = label;
        el.addEventListener('mouseenter', hideSubmenu);
        el.addEventListener('click', () => { hideContextMenu(); action(); });
        contextMenu.appendChild(el);
    };

    const addSeparator = () => {
        const el = document.createElement('div');
        el.className = 'context-menu-separator';
        contextMenu.appendChild(el);
    };

    const addSubmenuItem = (label, buildItems) => {
        const el = document.createElement('div');
        el.className = 'context-menu-item context-menu-submenu';
        el.textContent = label;
        el.addEventListener('mouseenter', () => {
            clearTimeout(submenuHideTimer);
            submenuHideTimer = null;
            showSubmenu(el, buildItems());
        });
        el.addEventListener('mouseleave', () => {
            submenuHideTimer = setTimeout(hideSubmenu, 150);
        });
        contextMenu.appendChild(el);
    };

    addItem('Reload', () => chrome.tabs.reload(tab.id));
    addItem('Duplicate', () => chrome.tabs.duplicate(tab.id));
    addSeparator();
    addItem(tab.pinned ? 'Unpin tab' : 'Pin tab',
        () => chrome.tabs.update(tab.id, { pinned: !tab.pinned }));
    const muted = tab.mutedInfo?.muted ?? false;
    addItem(muted ? 'Unmute tab' : 'Mute tab',
        () => chrome.tabs.update(tab.id, { muted: !muted }));
    addSeparator();
    addItem('Move to new window', () => chrome.windows.create({ tabId: tab.id }));
    addSubmenuItem('Add to group', () => {
        const items = [{ label: 'New group…', action: () => showGroupDialog(tab.id) }];
        const otherGroups = allGroups.filter(g => g.id !== tab.groupId);
        if (otherGroups.length) {
            items.push({ separator: true });
            for (const g of otherGroups) {
                items.push({
                    label: g.title || 'Unnamed group',
                    color: GROUP_COLORS[g.color]?.color ?? GROUP_COLORS.grey.color,
                    action: () => chrome.tabs.group({ tabIds: [tab.id], groupId: g.id }),
                });
            }
        }
        return items;
    });
    if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
        addItem('Remove from group', () => chrome.tabs.ungroup([tab.id]));
    }
    addSeparator();
    addItem('Close tab', () => chrome.tabs.remove(tab.id));
    const otherIds = allTabs.filter(t => t.id !== tab.id).map(t => t.id);
    if (otherIds.length) {
        addItem('Close other tabs', () => chrome.tabs.remove(otherIds));
    }
    const belowIds = allTabs.filter(t => t.index > tab.index).map(t => t.id);
    if (belowIds.length) {
        addItem('Close all tabs below', () => chrome.tabs.remove(belowIds));
    }

    contextMenu.classList.add('visible');
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;

    const w = contextMenu.offsetWidth;
    const h = contextMenu.offsetHeight;
    if (x + w > window.innerWidth)  contextMenu.style.left  = `${Math.max(0, window.innerWidth  - w - 4)}px`;
    if (y + h > window.innerHeight) contextMenu.style.top   = `${Math.max(0, window.innerHeight - h - 4)}px`;
}

document.addEventListener('click', (e) => {
    if (!groupDialog.contains(e.target)) hideContextMenu();
    if (groupDialog.classList.contains('visible') &&
        !groupDialog.contains(e.target) &&
        !contextMenu.contains(e.target) &&
        !submenu.contains(e.target)) {
        hideGroupDialog();
    }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hideContextMenu(); hideGroupDialog(); } });
contextMenu.addEventListener('contextmenu', (e) => e.preventDefault());

// --- Helpers ---

function getGroupTabsSorted(groupId) {
    return allTabs.filter(t => t.groupId === groupId).sort((a, b) => a.index - b.index);
}

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
    const groupTabs = getGroupTabsSorted(groupId);
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

function createAudioIcon() {
    const el = document.createElement('span');
    el.className = 'tab-audio';
    el.title = 'Playing audio';
    el.textContent = '🔊';
    return el;
}

function renderTabRow(tab) {
    const row = document.createElement('div');
    const splitPos = splitPositions.get(tab.id);
    row.className = 'tab-row' + (tab.active ? ' active' : '') + (splitPos ? ` split-${splitPos}` : '');
    row.dataset.tabId = tab.id;

    row.appendChild(renderFavicon(tab));

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title || tab.url || '(New Tab)';
    title.title = tab.title || tab.url || '';
    row.appendChild(title);

    if (tab.audible) row.appendChild(createAudioIcon());

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

    row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(tab.id, e.clientX, e.clientY);
    });

    row.draggable = splitPositions.get(tab.id) === undefined;

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
                const groupTabsSorted = getGroupTabsSorted(parseInt(groupSection.dataset.groupId));
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
            const groupTabsSorted = getGroupTabsSorted(group.id);
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
                }, HOVER_EXPAND_DELAY_MS);
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

    // Build split view position map
    splitPositions.clear();
    const splitGroups = new Map();
    const SPLIT_VIEW_ID_NONE = chrome.tabs.SPLIT_VIEW_ID_NONE ?? -1;
    for (const tab of allTabs) {
        if (tab.splitViewId !== SPLIT_VIEW_ID_NONE) {
            if (!splitGroups.has(tab.splitViewId)) splitGroups.set(tab.splitViewId, []);
            splitGroups.get(tab.splitViewId).push(tab.id);
        }
    }
    for (const ids of splitGroups.values()) {
        if (ids.length < 2) continue;
        ids.forEach((id, i) => {
            splitPositions.set(id, i === 0 ? 'first' : i === ids.length - 1 ? 'last' : 'middle');
        });
    }

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

    if (!tabTree.hasChildNodes()) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No tabs open.';
        tabTree.appendChild(empty);
        return;
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

    if ('audible' in changeInfo) {
        const audioEl = row.querySelector('.tab-audio');
        if (changeInfo.audible && !audioEl) {
            row.insertBefore(createAudioIcon(), row.querySelector('.tab-close'));
        } else if (!changeInfo.audible && audioEl) {
            audioEl.remove();
        }
    }
}

// --- Event listeners ---

chrome.tabs.onCreated.addListener(loadTabs);
chrome.tabs.onRemoved.addListener(loadTabs);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if ('groupId' in changeInfo || 'splitViewId' in changeInfo || 'pinned' in changeInfo) {
        loadTabs();
    } else if ('title' in changeInfo || 'favIconUrl' in changeInfo || 'audible' in changeInfo) {
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
