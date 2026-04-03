A summarized list of features. Consider these invariants.

- All open tabs should appear in the sidebar, sorted and grouped as they are in the Chrome tab model.
- Any updates to tab state, position, or grouping should be reflected in the sidebar.
- The popup menu should show the most recently viewed tabs.
  - The "number of recent tabs" setting should apply to the list of recent tabs in the popup menu.
  - j/k and arrow keys move the selection in the popup menu, enter selects.
  - When shown, the second-to-last viewed tab should be selected. This enables ctrl-tab-like behavior.
  - The slash ("/") key should be used to enable searching through recent tabs.
  - When searching, allow searching across both currently open tabs and recently closed tabs.


