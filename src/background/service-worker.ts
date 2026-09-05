/**
 * Undock Engine - Service Worker (Manifest V3)
 * Tracks global extension state & tab tracking using chrome.storage.session
 */

// Handle action icon click on the toolbar
chrome.action?.onClicked?.addListener(async (tab) => {
  if (!tab.id) return;

  try {
    // Send toggle command to content script
    await chrome.tabs.sendMessage(tab.id, { type: 'UNDOCK_TOGGLE' });
  } catch (err) {
    console.warn('[Undock SW] Could not send message to tab:', err);
  }
});

// Tab removal listener: clean up session tracking
chrome.tabs?.onRemoved?.addListener(async (tabId) => {
  try {
    const session = await chrome.storage.session.get('undocked_tabs');
    const tabs: number[] = session.undocked_tabs || [];
    const updated = tabs.filter((id) => id !== tabId);
    await chrome.storage.session.set({ undocked_tabs: updated });
  } catch {
    // Ignore session errors
  }
});

// Runtime message listener for state sync and commands
chrome.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === 'UNDOCK_STATE_CHANGE' && sender.tab?.id) {
      const tabId = sender.tab.id;
      const isUndocked = Boolean(message.payload?.isUndocked);

      const session = await chrome.storage.session.get('undocked_tabs');
      const tabs: number[] = session.undocked_tabs || [];

      if (isUndocked && !tabs.includes(tabId)) {
        tabs.push(tabId);
        await chrome.action.setBadgeText({ tabId, text: 'OUT' });
        await chrome.action.setBadgeBackgroundColor({ tabId, color: '#1a73e8' });
      } else if (!isUndocked && tabs.includes(tabId)) {
        const filtered = tabs.filter((id) => id !== tabId);
        await chrome.storage.session.set({ undocked_tabs: filtered });
        await chrome.action.setBadgeText({ tabId, text: '' });
      }

      sendResponse({ status: 'ok' });
    } else if (message.type === 'UNDOCK_PING') {
      sendResponse({ type: 'UNDOCK_PONG', timestamp: Date.now() });
    }
  })();

  return true; // Keep message channel open for async response
});
