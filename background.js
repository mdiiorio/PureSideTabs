// Open the side panel when the extension action is clicked
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

// Allow the side panel to be opened on every tab
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
