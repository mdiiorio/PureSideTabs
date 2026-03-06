const container = document.getElementById('recent-tabs');

function getFallbackSvg() {
    return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' rx='2' fill='%236c7086'/><rect x='3' y='5' width='10' height='1.5' rx='1' fill='%23cdd6f4'/><rect x='3' y='8' width='7' height='1.5' rx='1' fill='%23cdd6f4'/><rect x='3' y='11' width='9' height='1.5' rx='1' fill='%23cdd6f4'/></svg>`;
}

function renderRow(tab) {
    const row = document.createElement('div');
    row.className = 'tab-row';

    const img = document.createElement('img');
    img.className = 'tab-favicon';
    img.width = 16;
    img.height = 16;
    if (tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://')) {
        img.src = tab.favIconUrl;
        img.onerror = () => { img.src = getFallbackSvg(); };
    } else {
        img.src = getFallbackSvg();
    }
    row.appendChild(img);

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

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setSelected(selectedIndex + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setSelected(selectedIndex - 1);
    } else if (e.key === 'Enter') {
        rows[selectedIndex]?.click();
    }
});

// --- Render ---

async function render() {
    const { mruTabIds = [] } = await chrome.storage.session.get('mruTabIds');

    if (mruTabIds.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No recent tabs yet.';
        container.appendChild(empty);
        return;
    }

    // Fetch all tabs, then map by ID to preserve MRU order
    const tabs = await chrome.tabs.query({});
    const tabById = Object.fromEntries(tabs.map(t => [t.id, t]));

    for (const id of mruTabIds) {
        const tab = tabById[id];
        if (tab) {
            const row = renderRow(tab);
            rows.push(row);
            container.appendChild(row);
        }
    }

    // Select the second entry by default (first is the current tab)
    setSelected(rows.length > 1 ? 1 : 0);
}

render();
