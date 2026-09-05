import { UndockCore, SiteAdapter } from '../adapters/base';
import { globalAdapterRegistry } from '../adapters';
import { WindowManager } from './window-manager';
import { StyleCloner } from './style-cloner';
import { SyncObserver } from './sync-observer';
import { KeyboardBroker } from './keyboard-broker';
import { UndockState } from '../types';
import { Toast } from '../ui/toast';

export class UndockEngine implements UndockCore {
  private _isUndocked: boolean = false;
  private _activeAdapter: SiteAdapter | null = null;

  private windowManager: WindowManager | null = null;
  private styleCloner: StyleCloner = new StyleCloner();
  private syncObserver: SyncObserver = new SyncObserver();
  private keyboardBroker: KeyboardBroker;

  private currentDetailEl: HTMLElement | null = null;
  private stateChangeListeners: Set<(state: UndockState) => void> = new Set();
  private reactiveObserver: MutationObserver | null = null;
  private boundHashChangeHandler: () => void;

  constructor() {
    this.boundHashChangeHandler = () => {
      if (this._isUndocked) {
        this.checkAndSyncSelection();
      }
    };

    this.keyboardBroker = new KeyboardBroker({
      onToggleTheme: () => {
        this.windowManager?.toggleThemeDrawer();
      },
      onReply: () => {
        // Reply opens in popup style in main window; reading pane in secondary window remains stationary
      },
      onTriageAction: (actionKey) => {
        if (actionKey === 'u') {
          this.dock();
        }
      },
      onEscape: () => {
        // Pressing escape can optionally dock or refocus
      },
    });
  }

  get isUndocked(): boolean {
    return this._isUndocked;
  }

  get activeAdapter(): SiteAdapter | null {
    return this._activeAdapter;
  }

  /**
   * Initializes the engine by matching hostname against registered adapters.
   */
  async init(hostname: string = window.location.hostname): Promise<boolean> {
    const adapter = globalAdapterRegistry.findAdapterForHost(hostname);
    if (!adapter) {
      return false;
    }

    this._activeAdapter = adapter;

    this.windowManager = new WindowManager({
      siteName: adapter.name,
      onClose: () => {
        if (this._isUndocked) {
          this.dock();
        }
      },
      onNanoAction: (key) => {
        this.keyboardBroker.triggerKey(key);
      },
    });

    if (adapter.onInit) {
      adapter.onInit(this);
    }

    return true;
  }

  get isSplitMode(): boolean {
    return this.checkIsSplitMode();
  }

  /**
   * Undocks the detail pane into a secondary OS window.
   * Only functions when split reading pane mode is active in Gmail.
   */
  async undock(): Promise<boolean> {
    if (!this._activeAdapter || !this.windowManager) {
      console.warn('[Undock] No active adapter or window manager initialized.');
      return false;
    }

    if (this._isUndocked) {
      this.windowManager.focus();
      return true;
    }

    // 0. Undock only functions in Gmail Split Reading Pane mode
    if (!this.checkIsSplitMode()) {
      Toast.show(
        'Undock requires Gmail Reading Pane (Split mode). Please enable Split mode (⚙️ Settings → Reading pane → Right of inbox) to undock.',
        5000
      );
      return false;
    }

    try {
      // 1. Open secondary window immediately
      const childWin = await this.windowManager.open();
      const childDoc = childWin.document;

      // 2. Clone stylesheets, inline styles, CSS vars and attributes
      this.styleCloner.cloneStylesTo(childDoc);
      this.styleCloner.startWatching(childDoc);

      // 3. Attach keyboard broker for single-stroke triage hotkeys
      this.keyboardBroker.attach(childWin);

      this._isUndocked = true;
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.add('undock-engine-active');
      }
      this.notifyState();

      // 4. Check if an email thread is currently selected in the split pane
      const detailEl = this.findDetailElement();
      if (detailEl && this.isElementThreadActive(detailEl)) {
        this.activateDetailSync(detailEl);
        Toast.show('Reading pane undocked to secondary window.');
      } else {
        // Show Standby UI in child window for split mode
        this.windowManager.renderStandbyScreen({ isSplitModeActive: true });
        Toast.show('Undock window ready on secondary display. Select any email to view.');
      }

      // 5. Start reactive observer to automatically detect email selections
      this.startReactiveWatcher();

      return true;
    } catch (err) {
      console.error('[Undock] Error during undock sequence:', err);
      await this.dock();
      return false;
    }
  }

  /**
   * Re-docks the detail pane back into the primary window.
   */
  async dock(): Promise<boolean> {
    if (!this._isUndocked && !this.windowManager?.isOpen) {
      return true;
    }

    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('undock-engine-active');
    }

    // 1. Stop reactive watcher
    this.stopReactiveWatcher();

    // 2. Detach keyboard broker
    this.keyboardBroker.detach();

    // 3. Disconnect DOM sync & scroll observer
    this.syncObserver.disconnect();

    // 4. Disconnect style observers
    this.styleCloner.disconnect();

    // 5. Restore suppressed detail pane in parent DOM
    if (this._activeAdapter && this.currentDetailEl) {
      this._activeAdapter.restoreDetailPane(this.currentDetailEl);
    }

    // 6. Close child window
    if (this.windowManager?.isOpen) {
      this.windowManager.close();
    }

    this.currentDetailEl = null;
    this._isUndocked = false;
    this.notifyState();

    Toast.show('Reading pane re-docked to main window.');

    return true;
  }

  /**
   * Toggles between docked and undocked states.
   */
  async toggle(): Promise<boolean> {
    if (this._isUndocked) {
      return this.dock();
    } else {
      return this.undock();
    }
  }

  onStateChange(listener: (state: UndockState) => void): () => void {
    this.stateChangeListeners.add(listener);
    listener(this.getState());
    return () => this.stateChangeListeners.delete(listener);
  }

  getState(): UndockState {
    return {
      isUndocked: this._isUndocked,
      activeAdapterName: this._activeAdapter?.name || null,
      lastSyncTimestamp: Date.now(),
    };
  }

  private notifyState(): void {
    const state = this.getState();
    for (const listener of this.stateChangeListeners) {
      try {
        listener(state);
      } catch (e) {
        console.error('[Undock] Error in state change listener:', e);
      }
    }
  }

  /**
   * Activates DOM mirror and event proxying for a specific detail element.
   */
  private activateDetailSync(detailEl: HTMLElement): void {
    if (!this._activeAdapter || !this.windowManager?.isOpen) return;

    // If already syncing this element, do nothing
    if (this.currentDetailEl === detailEl) return;

    // If another element was suppressed, restore it first
    if (this.currentDetailEl && this.currentDetailEl !== detailEl) {
      this._activeAdapter.restoreDetailPane(this.currentDetailEl);
    }

    this.currentDetailEl = detailEl;

    const childDoc = this.windowManager.getDocument();
    const childRoot = childDoc?.getElementById('undock-root');
    if (!childRoot) return;

    // Suppress native reading pane offscreen
    this._activeAdapter.suppressDetailPane(detailEl);

    // Mirror DOM into detached window
    this.syncObserver.startSync(
      detailEl,
      childRoot,
      this._activeAdapter.onBeforeSync?.bind(this._activeAdapter),
      this._activeAdapter.handleActionProxy?.bind(this._activeAdapter),
      {
        onReply: () => {
          this.keyboardBroker.triggerToolbarAction('reply');
          Toast.show('Reply opened in main window popup.');
          if (typeof window !== 'undefined' && typeof window.focus === 'function') {
            window.focus();
          }
        },
        onForward: () => {
          this.keyboardBroker.triggerToolbarAction('forward');
          Toast.show('Forward draft opened in main window popup.');
          if (typeof window !== 'undefined' && typeof window.focus === 'function') {
            window.focus();
          }
        },
        onDelete: () => {
          this.keyboardBroker.triggerToolbarAction('delete');
        },
        onMarkUnread: () => {
          this.keyboardBroker.triggerToolbarAction('markUnread');
        },
        onStar: () => {
          this.keyboardBroker.triggerToolbarAction('star');
        },
        onPrint: () => {
          this.windowManager?.getWindow()?.print();
        },
        onSpam: () => {
          this.keyboardBroker.triggerToolbarAction('spam');
        },
      }
    );
  }

  /**
   * Reverts secondary window to standby mode when email is deselected.
   */
  private revertToStandby(): void {
    if (!this._isUndocked || !this.windowManager?.isOpen) return;

    if (this.currentDetailEl && this._activeAdapter) {
      this._activeAdapter.restoreDetailPane(this.currentDetailEl);
      this.currentDetailEl = null;
    }

    this.syncObserver.disconnect();
    const isSplit = this.checkIsSplitMode();
    this.windowManager.renderStandbyScreen({ isSplitModeActive: isSplit });
  }

  /**
   * Checks current DOM and reactively switches between active thread and standby screen.
   */
  private checkAndSyncSelection(): void {
    if (!this._isUndocked || !this.windowManager?.isOpen) return;

    const detailEl = this.findDetailElement();
    if (detailEl && this.isElementThreadActive(detailEl)) {
      if (this.currentDetailEl !== detailEl) {
        this.activateDetailSync(detailEl);
      }
    } else {
      if (this.currentDetailEl !== null) {
        this.revertToStandby();
      }
    }
  }

  private startReactiveWatcher(): void {
    this.stopReactiveWatcher();

    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', this.boundHashChangeHandler);
      window.addEventListener('popstate', this.boundHashChangeHandler);
    }

    if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
      const target = document.querySelector('[role="main"]') || document.body;
      if (target) {
        this.reactiveObserver = new MutationObserver(() => {
          this.checkAndSyncSelection();
        });
        this.reactiveObserver.observe(target, {
          childList: true,
          subtree: true,
        });
      }
    }
  }

  private stopReactiveWatcher(): void {
    if (this.reactiveObserver) {
      this.reactiveObserver.disconnect();
      this.reactiveObserver = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('hashchange', this.boundHashChangeHandler);
      window.removeEventListener('popstate', this.boundHashChangeHandler);
    }
  }

  private isElementThreadActive(el: HTMLElement): boolean {
    // Check if element contains thread headers, subjects, or message items
    return Boolean(
      el.getAttribute('data-thread-perm-id') ||
      el.getAttribute('data-thread-id') ||
      el.querySelector(
        '[data-thread-perm-id], [data-thread-id], h2[data-thread-perm-id], h2.hP, .hP, [role="listitem"], .adn, .ads, .ii.gt, div.gs, [data-message-id], .a3s'
      )
    );
  }

  private checkIsSplitMode(): boolean {
    if (this._activeAdapter && 'isSplitModeActive' in this._activeAdapter) {
      return (this._activeAdapter as any).isSplitModeActive();
    }
    return true;
  }

  private findDetailElement(): HTMLElement | null {
    if (!this._activeAdapter || typeof document === 'undefined') return null;

    // 1. If adapter provides a custom resolver (e.g. GmailAdapter.findDetailContainer), use it
    if (typeof (this._activeAdapter as any).findDetailContainer === 'function') {
      const customEl = (this._activeAdapter as any).findDetailContainer();
      if (customEl) return customEl;
    }

    // 2. Query selectors
    const selectors = this._activeAdapter.selectors.detailContainer.split(',').map((s) => s.trim());
    for (const sel of selectors) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) return el;
    }

    // 3. Fallback: Check if there's an already suppressed container
    const suppressed = document.querySelector<HTMLElement>('[data-undock-suppressed="true"]');
    if (suppressed) return suppressed;

    return null;
  }
}

export const undockEngine = new UndockEngine();
