function getFallbackSvg() {
    return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' rx='2' fill='%236c7086'/><rect x='3' y='5' width='10' height='1.5' rx='1' fill='%23cdd6f4'/><rect x='3' y='8' width='7' height='1.5' rx='1' fill='%23cdd6f4'/><rect x='3' y='11' width='9' height='1.5' rx='1' fill='%23cdd6f4'/></svg>`;
}

function renderFavicon(tab) {
    const img = document.createElement('img');
    img.className = 'tab-favicon';
    img.width = 16;
    img.height = 16;
    if (tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://')) {
        img.src = tab.favIconUrl;
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
