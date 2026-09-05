import { undockEngine } from './core/engine';
import { UndockButton } from './ui/undock-button';
import { CommandPalette } from './ui/palette';

async function bootstrap() {
  const initialized = await undockEngine.init(window.location.hostname);
  if (!initialized) {
    return;
  }

  // Inject UI Button
  const button = new UndockButton(undockEngine);
  button.mount();

  // Initialize Command Palette
  new CommandPalette(undockEngine);

  // Sync state changes with background service worker
  undockEngine.onStateChange((state) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'UNDOCK_STATE_CHANGE',
          payload: state,
        });
      }
    } catch {
      // SW might be inactive or reloading
    }
  });

  // Listen for messages from background service worker or popup
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'UNDOCK_TOGGLE') {
        undockEngine.toggle().then((success) => {
          sendResponse({ success, isUndocked: undockEngine.isUndocked });
        });
        return true;
      }
      return false;
    });
  }

}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
