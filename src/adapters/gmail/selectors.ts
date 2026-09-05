export const GMAIL_SELECTORS = {
  // Main app root
  mainContainer: '[role="main"]',

  // Message list pane in split mode
  listContainer: '[role="main"] table[role="grid"]',

  detailContainer: 'h2.hP, .hP, [role="main"] [data-thread-perm-id], [role="main"] h2[data-thread-perm-id], [role="main"] div[role="listitem"], .adn, .ii.gt',

  // Fallback structural selectors for reading pane
  splitPaneWrapper: '[role="main"] > div',

  // Delegated action button selectors
  actionButtons: {
    archive: '[aria-label*="Archive" i], [data-tooltip*="Archive" i], [act="7"]',
    delete: '[aria-label*="Delete" i], [data-tooltip*="Delete" i], [act="10"]',
    markUnread: '[aria-label*="Mark as unread" i], [data-tooltip*="Mark as unread" i], [act="8"]',
    star: '[aria-label*="Not starred" i], [aria-label*="Starred" i], [data-tooltip*="Star" i]',
    reply: '[aria-label*="Reply" i], [role="button"][data-tooltip*="Reply" i]',
    forward: '[aria-label*="Forward" i], [role="button"][data-tooltip*="Forward" i]',
    snooze: '[aria-label*="Snooze" i], [data-tooltip*="Snooze" i]',
  },
};
