import { WindowCoordinates } from '../types';

export interface WindowManagerOptions {
  siteName: string;
  defaultWidth?: number;
  defaultHeight?: number;
  onClose?: () => void;
  onFocusChange?: (isChildFocused: boolean) => void;
  onNanoAction?: (key: string) => void;
}

export class WindowManager {
  private siteName: string;
  private defaultWidth: number;
  private defaultHeight: number;
  private onNanoAction?: (key: string) => void;
  private childWindow: Window | null = null;
  private closeCallbacks: Set<() => void> = new Set();
  private focusCallbacks: Set<(isChildFocused: boolean) => void> = new Set();
  private pollIntervalId: number | null = null;
  private resizeDebounceTimer: number | null = null;

  constructor(options: WindowManagerOptions) {
    this.siteName = options.siteName;
    this.defaultWidth = options.defaultWidth ?? 1000;
    this.defaultHeight = options.defaultHeight ?? 850;
    this.onNanoAction = options.onNanoAction;
    if (options.onClose) this.closeCallbacks.add(options.onClose);
    if (options.onFocusChange) this.focusCallbacks.add(options.onFocusChange);

    this.bindParentUnload();
  }

  get isOpen(): boolean {
    return this.childWindow !== null && !this.childWindow.closed;
  }

  getWindow(): Window | null {
    if (this.childWindow && !this.childWindow.closed) {
      return this.childWindow;
    }
    return null;
  }

  getDocument(): Document | null {
    const win = this.getWindow();
    return win ? win.document : null;
  }

  /**
   * Retrieves stored coordinates or calculates initial centered placement.
   */
  async getStoredCoordinates(): Promise<WindowCoordinates> {
    const key = `undock_coords_${this.siteName}`;
    let coords: WindowCoordinates | null = null;

    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await chrome.storage.local.get(key);
        coords = result[key] || null;
      } else if (typeof localStorage !== 'undefined') {
        const item = localStorage.getItem(key);
        coords = item ? JSON.parse(item) : null;
      }
    } catch {
      // Fallback if storage fails
    }

    if (coords && coords.width > 200 && coords.height > 200) {
      return coords;
    }

    // Default placement: positioned adjacent to parent or centered
    const left = Math.max(0, (window.screen?.availWidth ?? 1920) - this.defaultWidth - 50);
    const top = 50;

    return {
      left,
      top,
      width: this.defaultWidth,
      height: this.defaultHeight,
    };
  }

  /**
   * Persists coordinates to storage.
   */
  async saveCoordinates(coords: WindowCoordinates): Promise<void> {
    const key = `undock_coords_${this.siteName}`;
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [key]: coords });
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(coords));
      }
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Opens the secondary detached window.
   */
  async open(): Promise<Window> {
    if (this.isOpen && this.childWindow) {
      this.childWindow.focus();
      return this.childWindow;
    }

    const coords = await this.getStoredCoordinates();
    const windowFeatures = [
      `left=${coords.left}`,
      `top=${coords.top}`,
      `width=${coords.width}`,
      `height=${coords.height}`,
      'menubar=no',
      'toolbar=no',
      'location=no',
      'status=no',
      'resizable=yes',
      'scrollbars=yes',
    ].join(',');

    const child = window.open('about:blank', `Undock_${this.siteName}`, windowFeatures);
    if (!child) {
      throw new Error('Failed to open detached window. Pop-up blocker may be active.');
    }

    this.childWindow = child;
    this.initChildDocument(child);
    this.bindChildEvents(child);
    this.startWindowWatcher();

    return child;
  }

  /**
   * Closes the child window.
   */
  close(): void {
    this.stopWindowWatcher();
    if (this.childWindow && !this.childWindow.closed) {
      this.childWindow.close();
    }
    this.childWindow = null;
  }

  /**
   * Focuses the child window.
   */
  focus(): void {
    if (this.isOpen && this.childWindow) {
      this.childWindow.focus();
    }
  }

  onClose(callback: () => void): () => void {
    this.closeCallbacks.add(callback);
    return () => this.closeCallbacks.delete(callback);
  }

  onFocusChange(callback: (isChildFocused: boolean) => void): () => void {
    this.focusCallbacks.add(callback);
    return () => this.focusCallbacks.delete(callback);
  }

  /**
   * Renders the standby / waiting screen inside the detached window.
   */
  renderStandbyScreen(options?: { isSplitModeActive?: boolean }): void {
    const doc = this.getDocument();
    if (!doc) return;

    const root = doc.getElementById('undock-root');
    if (!root) return;

    const isSplit = options?.isSplitModeActive !== false;

    root.innerHTML = `
      <div class="undock-standby-wrapper">
        <div class="undock-standby-card">
          <div class="undock-standby-icon">
            <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="#1a73e8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          </div>
          <h1 class="undock-standby-title">Reading Pane Ready</h1>
          <p class="undock-standby-subtitle">
            Select an email in your inbox to view it on this screen.
          </p>

          <div class="undock-standby-shortcuts">
            <div class="shortcut-tag"><kbd>j</kbd> / <kbd>k</kbd> <span>Next / Prev</span></div>
            <div class="shortcut-tag"><kbd>e</kbd> <span>Archive</span></div>
            <div class="shortcut-tag"><kbd>#</kbd> <span>Delete</span></div>
            <div class="shortcut-tag"><kbd>r</kbd> <span>Reply</span></div>
          </div>

          ${
            !isSplit
              ? `
            <div class="undock-standby-alert">
              <span class="alert-icon">💡</span>
              <div class="alert-text">
                <strong>Gmail Reading Pane is not detected</strong>
                <p>To enable multi-screen triage, open Gmail <strong>Settings (⚙️)</strong> → scroll to <strong>Reading pane</strong> → select <strong>Right of inbox</strong>.</p>
              </div>
            </div>
          `
              : ''
          }
        </div>
      </div>
    `;
  }

  /**
   * Toggles the collapsible theme side drawer in the detached window.
   */
  toggleThemeDrawer(): void {
    const doc = this.getDocument();
    if (!doc) return;
    const drawer = doc.getElementById('undock-theme-drawer');
    if (drawer) {
      drawer.classList.toggle('undock-drawer-open');
    }
  }

  /**
   * Smoothly scrolls the detached reading container to the bottom or active draft composer.
   */
  scrollToDraft(): void {
    const executeScroll = () => {
      if (!this.isOpen) return;
      const doc = this.getDocument();
      if (!doc) return;
      const root = doc.getElementById('undock-root');
      if (!root) return;

      const draftEl = root.querySelector<HTMLElement>(
        '[role="region"][aria-label*="Draft" i], [aria-label*="Draft" i], .M9, div[role="textbox"], [contenteditable="true"], .editable, [aria-label*="Message Body" i]'
      );

      if (draftEl) {
        if (typeof draftEl.scrollIntoView === 'function') {
          draftEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
        const editable = draftEl.querySelector<HTMLElement>('[contenteditable="true"], [role="textbox"], textarea') || draftEl;
        try {
          editable.focus();
        } catch {}
      } else {
        if (typeof root.scrollTo === 'function') {
          root.scrollTo({ top: root.scrollHeight, behavior: 'smooth' });
        } else {
          root.scrollTop = root.scrollHeight;
        }
      }
    };

    executeScroll();
    if (typeof window !== 'undefined') {
      window.setTimeout(executeScroll, 100);
      window.setTimeout(executeScroll, 250);
      window.setTimeout(executeScroll, 500);
      window.setTimeout(executeScroll, 900);
    }
  }

  private initChildDocument(child: Window): void {
    const doc = child.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Undock — Reading Pane</title>
          <style id="undock-base-style">
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              background-color: #ffffff;
              font-family: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
              overflow: hidden;
            }
            #undock-container {
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              overflow: hidden;
              position: relative;
            }
            #undock-main-layout {
              flex: 1 1 auto;
              width: 100%;
              height: calc(100% - 36px);
              display: flex;
              flex-direction: row;
              overflow: hidden;
              position: relative;
            }
            #undock-root {
              flex: 1 1 auto;
              width: 100%;
              height: 100%;
              overflow-y: auto;
              overflow-x: auto;
              box-sizing: border-box;
            }

            /* Width settings */
            body.width-full #undock-root .undock-cloned-detail {
              width: 100% !important;
              max-width: 100% !important;
            }
            body.width-1200 #undock-root .undock-cloned-detail {
              max-width: 1200px !important;
              margin: 0 auto !important;
            }
            body.width-950 #undock-root .undock-cloned-detail {
              max-width: 950px !important;
              margin: 0 auto !important;
            }

            /* Font size settings */
            body.font-small #undock-root,
            body.font-small #undock-root .undock-cloned-detail,
            body.font-small #undock-root .undock-cloned-detail p,
            body.font-small #undock-root .undock-cloned-detail span,
            body.font-small #undock-root .undock-cloned-detail div,
            body.font-small #undock-root .undock-cloned-detail td,
            body.font-small #undock-root .undock-cloned-detail th,
            body.font-small #undock-root .undock-cloned-detail li,
            body.font-small #undock-root .undock-cloned-detail font,
            body.font-small #undock-root .undock-cloned-detail blockquote,
            body.font-small #undock-root .a3s,
            body.font-small #undock-root .a3s * {
              font-size: 13px !important;
              line-height: 1.4 !important;
            }

            body.font-normal #undock-root,
            body.font-normal #undock-root .undock-cloned-detail,
            body.font-normal #undock-root .undock-cloned-detail p,
            body.font-normal #undock-root .undock-cloned-detail span,
            body.font-normal #undock-root .undock-cloned-detail div,
            body.font-normal #undock-root .undock-cloned-detail td,
            body.font-normal #undock-root .undock-cloned-detail th,
            body.font-normal #undock-root .undock-cloned-detail li,
            body.font-normal #undock-root .undock-cloned-detail font,
            body.font-normal #undock-root .undock-cloned-detail blockquote,
            body.font-normal #undock-root .a3s,
            body.font-normal #undock-root .a3s * {
              font-size: 15px !important;
              line-height: 1.5 !important;
            }

            body.font-large #undock-root,
            body.font-large #undock-root .undock-cloned-detail,
            body.font-large #undock-root .undock-cloned-detail p,
            body.font-large #undock-root .undock-cloned-detail span,
            body.font-large #undock-root .undock-cloned-detail div,
            body.font-large #undock-root .undock-cloned-detail td,
            body.font-large #undock-root .undock-cloned-detail th,
            body.font-large #undock-root .undock-cloned-detail li,
            body.font-large #undock-root .undock-cloned-detail font,
            body.font-large #undock-root .undock-cloned-detail blockquote,
            body.font-large #undock-root .a3s,
            body.font-large #undock-root .a3s * {
              font-size: 18px !important;
              line-height: 1.6 !important;
            }

            body.font-xl #undock-root,
            body.font-xl #undock-root .undock-cloned-detail,
            body.font-xl #undock-root .undock-cloned-detail p,
            body.font-xl #undock-root .undock-cloned-detail span,
            body.font-xl #undock-root .undock-cloned-detail div,
            body.font-xl #undock-root .undock-cloned-detail td,
            body.font-xl #undock-root .undock-cloned-detail th,
            body.font-xl #undock-root .undock-cloned-detail li,
            body.font-xl #undock-root .undock-cloned-detail font,
            body.font-xl #undock-root .undock-cloned-detail blockquote,
            body.font-xl #undock-root .a3s,
            body.font-xl #undock-root .a3s * {
              font-size: 22px !important;
              line-height: 1.7 !important;
            }

            body.font-small #undock-root h1, body.font-small #undock-root h2 { font-size: 16px !important; }
            body.font-normal #undock-root h1, body.font-normal #undock-root h2 { font-size: 20px !important; }
            body.font-large #undock-root h1, body.font-large #undock-root h2 { font-size: 25px !important; }
            body.font-xl #undock-root h1, body.font-xl #undock-root h2 { font-size: 30px !important; }

            /* Theme Presets */
            body.theme-dark {
              background-color: #121212 !important;
              color: #e0e0e0 !important;
            }
            body.theme-dark #undock-root,
            body.theme-dark .undock-cloned-detail,
            body.theme-dark .undock-cloned-detail div,
            body.theme-dark .undock-cloned-detail table,
            body.theme-dark .undock-cloned-detail tr,
            body.theme-dark .undock-cloned-detail td,
            body.theme-dark .undock-cloned-detail p,
            body.theme-dark .undock-cloned-detail span,
            body.theme-dark .undock-cloned-detail .a3s {
              background-color: #121212 !important;
              color: #e0e0e0 !important;
            }
            body.theme-dark .undock-cloned-detail h1,
            body.theme-dark .undock-cloned-detail h2,
            body.theme-dark .undock-cloned-detail h3 {
              color: #ffffff !important;
            }
            body.theme-dark #undock-root a,
            body.theme-dark #undock-root a * {
              color: #8ab4f8 !important;
            }

            body.theme-sepia {
              background-color: #fbf0d9 !important;
              color: #4a3b2c !important;
            }
            body.theme-sepia #undock-root,
            body.theme-sepia .undock-cloned-detail,
            body.theme-sepia .undock-cloned-detail div,
            body.theme-sepia .undock-cloned-detail table,
            body.theme-sepia .undock-cloned-detail tr,
            body.theme-sepia .undock-cloned-detail td,
            body.theme-sepia .undock-cloned-detail p,
            body.theme-sepia .undock-cloned-detail span,
            body.theme-sepia .undock-cloned-detail .a3s {
              background-color: #fbf0d9 !important;
              color: #4a3b2c !important;
            }
            body.theme-sepia #undock-root a,
            body.theme-sepia #undock-root a * {
              color: #1a73e8 !important;
            }

            body.theme-contrast {
              background-color: #000000 !important;
              color: #ffff00 !important;
            }
            body.theme-contrast #undock-root,
            body.theme-contrast .undock-cloned-detail,
            body.theme-contrast .undock-cloned-detail div,
            body.theme-contrast .undock-cloned-detail table,
            body.theme-contrast .undock-cloned-detail tr,
            body.theme-contrast .undock-cloned-detail td,
            body.theme-contrast .undock-cloned-detail th,
            body.theme-contrast .undock-cloned-detail p,
            body.theme-contrast .undock-cloned-detail span,
            body.theme-contrast .undock-cloned-detail h1,
            body.theme-contrast .undock-cloned-detail h2,
            body.theme-contrast .undock-cloned-detail h3,
            body.theme-contrast .undock-cloned-detail font,
            body.theme-contrast .undock-cloned-detail blockquote,
            body.theme-contrast .undock-cloned-detail li,
            body.theme-contrast .undock-cloned-detail .a3s,
            body.theme-contrast .undock-cloned-detail .adn,
            body.theme-contrast .undock-cloned-detail .ads {
              background-color: #000000 !important;
              color: #ffff00 !important;
              border-color: #333333 !important;
            }
            body.theme-contrast #undock-root a,
            body.theme-contrast #undock-root a *,
            body.theme-contrast .undock-cloned-detail a,
            body.theme-contrast .undock-cloned-detail a * {
              color: #00ffff !important;
              text-decoration: underline !important;
            }
            body.theme-contrast .undock-standby-wrapper,
            body.theme-contrast .undock-standby-card {
              background-color: #000000 !important;
              color: #ffff00 !important;
              border-color: #ffff00 !important;
            }
            body.theme-contrast .undock-standby-title,
            body.theme-contrast .undock-standby-subtitle,
            body.theme-contrast .shortcut-tag {
              background-color: #111111 !important;
              color: #ffff00 !important;
            }
            body.theme-contrast .shortcut-tag kbd {
              background-color: #000000 !important;
              color: #ffff00 !important;
              border-color: #ffff00 !important;
            }
            body.theme-contrast .undock-standby-alert {
              background-color: #1a1a00 !important;
              border-color: #ffff00 !important;
              color: #ffff00 !important;
            }
            body.theme-contrast .undock-standby-alert strong,
            body.theme-contrast .undock-standby-alert p {
              color: #ffff00 !important;
            }

            /* Draft composer clean layout in detached window */
            .undock-cloned-detail [role="region"][aria-label*="Draft" i],
            .undock-cloned-detail .M9 {
              margin-top: 24px !important;
              margin-bottom: 24px !important;
            }
            body.theme-contrast .undock-cloned-detail [role="region"][aria-label*="Draft" i],
            body.theme-contrast .undock-cloned-detail .M9 {
              border: 1px solid #ffff00 !important;
              border-radius: 8px !important;
            }

            /* Dropdown Menu (3-dot options) */
            .undock-menu {
              background-color: #ffffff;
              color: #202124;
              border-radius: 8px;
              box-shadow: 0 4px 20px rgba(60,64,67,0.22), 0 1px 4px rgba(60,64,67,0.12);
              border: 1px solid #dadce0;
              padding: 6px 0;
              min-width: 220px;
              max-width: 320px;
              font-family: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
              user-select: none;
            }
            .undock-menu-item {
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 9px 16px;
              font-size: 13px;
              color: #3c4043;
              cursor: pointer;
              transition: background 0.12s ease;
              white-space: nowrap;
            }
            .undock-menu-item:hover {
              background-color: #f1f3f4;
              color: #202124;
            }
            .undock-menu-icon {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 20px;
              height: 20px;
              flex-shrink: 0;
            }
            .undock-menu-icon svg {
              fill: #5f6368;
            }
            .undock-menu-item:hover .undock-menu-icon svg {
              fill: #202124;
            }
            .undock-menu-label {
              flex: 1 1 auto;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .undock-menu-separator {
              height: 1px;
              background-color: #e8eaed;
              margin: 6px 0;
            }

            /* Theme overrides for Dropdown Menu */
            body.theme-contrast .undock-menu {
              background-color: #000000 !important;
              color: #ffff00 !important;
              border: 2px solid #ffff00 !important;
              box-shadow: 0 4px 24px rgba(255,255,0,0.35) !important;
            }
            body.theme-contrast .undock-menu-item {
              color: #ffff00 !important;
            }
            body.theme-contrast .undock-menu-item:hover {
              background-color: #222200 !important;
              color: #ffffff !important;
            }
            body.theme-contrast .undock-menu-icon svg {
              fill: #ffff00 !important;
            }
            body.theme-contrast .undock-menu-item:hover .undock-menu-icon svg {
              fill: #ffffff !important;
            }
            body.theme-contrast .undock-menu-separator {
              background-color: #ffff00 !important;
            }

            body.theme-dark .undock-menu {
              background-color: #202124 !important;
              color: #e8eaed !important;
              border: 1px solid #3c4043 !important;
              box-shadow: 0 4px 20px rgba(0,0,0,0.6) !important;
            }
            body.theme-dark .undock-menu-item {
              color: #e8eaed !important;
            }
            body.theme-dark .undock-menu-item:hover {
              background-color: #35363a !important;
              color: #ffffff !important;
            }
            body.theme-dark .undock-menu-icon svg {
              fill: #9aa0a6 !important;
            }
            body.theme-dark .undock-menu-item:hover .undock-menu-icon svg {
              fill: #ffffff !important;
            }
            body.theme-dark .undock-menu-separator {
              background-color: #3c4043 !important;
            }

            body.theme-sepia .undock-menu {
              background-color: #fbf0d9 !important;
              color: #4a3b2c !important;
              border: 1px solid #d4c5a9 !important;
              box-shadow: 0 4px 16px rgba(74,59,44,0.15) !important;
            }
            body.theme-sepia .undock-menu-item {
              color: #4a3b2c !important;
            }
            body.theme-sepia .undock-menu-item:hover {
              background-color: #efe2c4 !important;
            }
            body.theme-sepia .undock-menu-icon svg {
              fill: #6d5843 !important;
            }
            body.theme-sepia .undock-menu-separator {
              background-color: #d4c5a9 !important;
            }

            /* Linux Nano-style Shortcut Bar */
            #undock-nano-bar {
              height: 36px;
              min-height: 36px;
              background-color: #202124;
              border-top: 1px solid #3c4043;
              display: flex;
              align-items: center;
              padding: 0 12px;
              gap: 4px;
              user-select: none;
              overflow-x: auto;
              z-index: 1000;
            }
            .nano-item {
              display: inline-flex;
              align-items: center;
              gap: 5px;
              background: transparent;
              border: none;
              color: #ffffff;
              padding: 4px 8px;
              border-radius: 4px;
              cursor: pointer;
              font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
              font-size: 12px;
              transition: background 0.15s ease;
              white-space: nowrap;
            }
            .nano-item:hover {
              background-color: #3c4043;
            }
            .nano-key {
              background-color: #ffffff;
              color: #202124;
              font-weight: 700;
              padding: 1px 4px;
              border-radius: 2px;
              font-size: 11px;
            }
            .nano-action {
              color: #e8eaed;
            }

            /* Collapsible Theme Side Drawer */
            #undock-theme-drawer {
              position: absolute;
              top: 0;
              right: 0;
              width: 290px;
              height: 100%;
              background: #ffffff;
              border-left: 1px solid #dadce0;
              box-shadow: -4px 0 16px rgba(0,0,0,0.12);
              transform: translateX(100%);
              transition: transform 0.25s cubic-bezier(0, 0, 0.2, 1);
              z-index: 2000;
              display: flex;
              flex-direction: column;
              padding: 20px;
              box-sizing: border-box;
              overflow-y: auto;
            }
            #undock-theme-drawer.undock-drawer-open {
              transform: translateX(0);
            }
            .drawer-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
              padding-bottom: 12px;
              border-bottom: 1px solid #eeeeee;
            }
            .drawer-title {
              font-size: 16px;
              font-weight: 600;
              color: #202124;
              margin: 0;
            }
            .drawer-close-btn {
              background: transparent;
              border: none;
              font-size: 18px;
              cursor: pointer;
              color: #5f6368;
              border-radius: 50%;
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .drawer-close-btn:hover {
              background: #f1f3f4;
            }
            .drawer-section {
              margin-bottom: 24px;
            }
            .drawer-label {
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #5f6368;
              margin-bottom: 10px;
            }
            .drawer-options-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 8px;
            }
            .drawer-btn {
              background: #f8f9fa;
              border: 1px solid #dadce0;
              border-radius: 6px;
              padding: 8px 10px;
              font-size: 13px;
              color: #3c4043;
              cursor: pointer;
              text-align: center;
              transition: all 0.15s ease;
            }
            .drawer-btn:hover {
              background: #e8eaed;
            }
            .drawer-btn.active {
              background: #e8f0fe;
              color: #1a73e8;
              border-color: #1a73e8;
              font-weight: 500;
            }

            /* Standby UI Styles */
            .undock-standby-wrapper {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100%;
              padding: 40px 24px;
              box-sizing: border-box;
              background-color: #f8f9fa;
            }
            .undock-standby-card {
              max-width: 520px;
              width: 100%;
              background: #ffffff;
              border: 1px solid #dadce0;
              border-radius: 12px;
              padding: 36px 32px;
              text-align: center;
              box-shadow: 0 4px 16px rgba(60,64,67,0.08);
            }
            .undock-standby-icon {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 72px;
              height: 72px;
              border-radius: 50%;
              background: #e8f0fe;
              margin-bottom: 20px;
            }
            .undock-standby-title {
              font-size: 22px;
              font-weight: 500;
              color: #202124;
              margin: 0 0 10px 0;
            }
            .undock-standby-subtitle {
              font-size: 14px;
              color: #5f6368;
              margin: 0 0 24px 0;
              line-height: 1.5;
            }
            .undock-standby-shortcuts {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              justify-content: center;
              margin-bottom: 24px;
            }
            .shortcut-tag {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              background: #f1f3f4;
              padding: 6px 10px;
              border-radius: 6px;
              font-size: 12px;
              color: #3c4043;
            }
            .shortcut-tag kbd {
              background: #ffffff;
              border: 1px solid #dadce0;
              border-radius: 4px;
              padding: 2px 6px;
              font-family: monospace;
              font-weight: bold;
              box-shadow: 0 1px 1px rgba(0,0,0,0.1);
            }
            .undock-standby-alert {
              display: flex;
              align-items: flex-start;
              gap: 12px;
              background: #fef7e0;
              border: 1px solid #f9ab00;
              border-radius: 8px;
              padding: 12px 16px;
              text-align: left;
              font-size: 13px;
              color: #3c4043;
            }
            .undock-standby-alert .alert-icon {
              font-size: 18px;
            }
            .undock-standby-alert strong {
              display: block;
              color: #202124;
              margin-bottom: 4px;
            }
            .undock-standby-alert p {
              margin: 0;
              line-height: 1.4;
            }
          </style>
        </head>
        <body class="undock-detached-body theme-contrast width-full font-normal">
          <div id="undock-container">
            <div id="undock-main-layout">
              <main id="undock-root"></main>

              <!-- Collapsible Theme Side Drawer -->
              <aside id="undock-theme-drawer" aria-label="Reading Settings">
                <div class="drawer-header">
                  <h3 class="drawer-title">Reading Appearance</h3>
                  <button type="button" class="drawer-close-btn" id="drawer-close" aria-label="Close settings">✕</button>
                </div>

                <div class="drawer-section">
                  <div class="drawer-label">Theme Mode</div>
                  <div class="drawer-options-grid">
                    <button type="button" class="drawer-btn" data-theme="theme-light">Light</button>
                    <button type="button" class="drawer-btn" data-theme="theme-dark">Dark</button>
                    <button type="button" class="drawer-btn" data-theme="theme-sepia">Sepia</button>
                    <button type="button" class="drawer-btn active" data-theme="theme-contrast">Contrast</button>
                  </div>
                </div>

                <div class="drawer-section">
                  <div class="drawer-label">Reading Width</div>
                  <div class="drawer-options-grid">
                    <button type="button" class="drawer-btn active" data-width="width-full">Full Width</button>
                    <button type="button" class="drawer-btn" data-width="width-1200">1200px</button>
                    <button type="button" class="drawer-btn" data-width="width-950">950px</button>
                  </div>
                </div>

                <div class="drawer-section">
                  <div class="drawer-label">Text Size</div>
                  <div class="drawer-options-grid">
                    <button type="button" class="drawer-btn" data-font="font-small">Small</button>
                    <button type="button" class="drawer-btn active" data-font="font-normal">Medium</button>
                    <button type="button" class="drawer-btn" data-font="font-large">Large</button>
                    <button type="button" class="drawer-btn" data-font="font-xl">Extra</button>
                  </div>
                </div>
              </aside>
            </div>

            <!-- Linux Nano-style Bottom Status Bar -->
            <footer id="undock-nano-bar" role="toolbar" aria-label="Keyboard Shortcuts">
              <button type="button" class="nano-item" data-key="j" title="Next Conversation (j)"><span class="nano-key">^J</span> <span class="nano-action">Next</span></button>
              <button type="button" class="nano-item" data-key="k" title="Previous Conversation (k)"><span class="nano-key">^K</span> <span class="nano-action">Prev</span></button>
              <button type="button" class="nano-item" data-key="e" title="Archive Conversation (e)"><span class="nano-key">^E</span> <span class="nano-action">Archive</span></button>
              <button type="button" class="nano-item" data-key="#" title="Delete Conversation (#)"><span class="nano-key">^#</span> <span class="nano-action">Delete</span></button>
              <button type="button" class="nano-item" data-key="s" title="Star Conversation (s)"><span class="nano-key">^S</span> <span class="nano-action">Star</span></button>
              <button type="button" class="nano-item" data-key="r" title="Reply to Thread (r)"><span class="nano-key">^R</span> <span class="nano-action">Reply</span></button>
              <button type="button" class="nano-item" data-key="u" title="Re-dock to Main Window (u)"><span class="nano-key">^U</span> <span class="nano-action">Re-dock</span></button>
              <button type="button" class="nano-item" id="nano-theme-btn" data-key="t" title="Reading Appearance (t)"><span class="nano-key">^T</span> <span class="nano-action">Theme</span></button>
            </footer>
          </div>
        </body>
      </html>
    `);
    doc.close();

    // Bind Nano bar clicks and theme drawer interactivity
    this.bindNanoBarAndThemeDrawer(child);

    this.renderStandbyScreen();
  }

  private bindNanoBarAndThemeDrawer(child: Window): void {
    const doc = child.document;
    if (!doc || typeof doc.querySelectorAll !== 'function') return;

    // Nano bar click handlers
    const nanoItems = doc.querySelectorAll<HTMLButtonElement>('.nano-item');
    nanoItems.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const key = btn.getAttribute('data-key');
        if (!key) return;

        if (key === 't') {
          this.toggleThemeDrawer();
        } else {
          if (this.onNanoAction) {
            this.onNanoAction(key);
          } else {
            // Fallback dispatch only if no onNanoAction handler registered
            try {
              const EventConstructor = (child as any).KeyboardEvent || KeyboardEvent;
              const event = new EventConstructor('keydown', {
                key,
                bubbles: true,
                cancelable: true,
              });
              child.dispatchEvent(event);
            } catch {}
          }
        }
      });
    });

    // Theme Drawer Close button
    const closeBtn = doc.getElementById('drawer-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.toggleThemeDrawer();
      });
    }

    // Theme Drawer Options
    const themeButtons = doc.querySelectorAll<HTMLButtonElement>('[data-theme]');
    themeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const themeClass = btn.getAttribute('data-theme')!;
        doc.body.classList.remove('theme-light', 'theme-dark', 'theme-sepia', 'theme-contrast');
        doc.body.classList.add(themeClass);
        themeButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        try {
          localStorage.setItem('undock_pref_theme', themeClass);
        } catch {}
      });
    });

    const widthButtons = doc.querySelectorAll<HTMLButtonElement>('[data-width]');
    widthButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const widthClass = btn.getAttribute('data-width')!;
        doc.body.classList.remove('width-full', 'width-1200', 'width-950');
        doc.body.classList.add(widthClass);
        widthButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        try {
          localStorage.setItem('undock_pref_width', widthClass);
        } catch {}
      });
    });

    const fontButtons = doc.querySelectorAll<HTMLButtonElement>('[data-font]');
    fontButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const fontClass = btn.getAttribute('data-font')!;
        doc.body.classList.remove('font-small', 'font-normal', 'font-large', 'font-xl');
        doc.body.classList.add(fontClass);
        fontButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        try {
          localStorage.setItem('undock_pref_font', fontClass);
        } catch {}
      });
    });

    // Restore saved preferences (defaulting to theme-contrast and width-full)
    try {
      const savedTheme = localStorage.getItem('undock_pref_theme') || 'theme-contrast';
      doc.body.classList.remove('theme-light', 'theme-dark', 'theme-sepia', 'theme-contrast');
      doc.body.classList.add(savedTheme);
      themeButtons.forEach((b) => b.classList.toggle('active', b.getAttribute('data-theme') === savedTheme));

      const savedWidth = localStorage.getItem('undock_pref_width') || 'width-full';
      doc.body.classList.remove('width-full', 'width-1200', 'width-950');
      doc.body.classList.add(savedWidth);
      widthButtons.forEach((b) => b.classList.toggle('active', b.getAttribute('data-width') === savedWidth));

      const savedFont = localStorage.getItem('undock_pref_font') || 'font-normal';
      doc.body.classList.remove('font-small', 'font-normal', 'font-large', 'font-xl');
      doc.body.classList.add(savedFont);
      fontButtons.forEach((b) => b.classList.toggle('active', b.getAttribute('data-font') === savedFont));
    } catch {}
  }

  private bindChildEvents(child: Window): void {
    child.addEventListener('focus', () => {
      this.notifyFocus(true);
    });

    child.addEventListener('blur', () => {
      this.notifyFocus(false);
    });

    const trackResize = () => {
      if (this.resizeDebounceTimer) {
        window.clearTimeout(this.resizeDebounceTimer);
      }
      this.resizeDebounceTimer = window.setTimeout(() => {
        if (child && !child.closed) {
          const coords: WindowCoordinates = {
            left: child.screenX ?? child.screenLeft ?? 0,
            top: child.screenY ?? child.screenTop ?? 0,
            width: child.outerWidth ?? child.innerWidth,
            height: child.outerHeight ?? child.innerHeight,
          };
          this.saveCoordinates(coords);
        }
      }, 500);
    };

    child.addEventListener('resize', trackResize);
    child.addEventListener('beforeunload', () => {
      this.notifyClose();
    });
  }

  private bindParentUnload(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('beforeunload', () => {
      this.close();
    });
  }

  private startWindowWatcher(): void {
    this.stopWindowWatcher();
    this.pollIntervalId = window.setInterval(() => {
      if (this.childWindow && this.childWindow.closed) {
        this.notifyClose();
      }
    }, 500);
  }

  private stopWindowWatcher(): void {
    if (this.pollIntervalId !== null) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  private notifyClose(): void {
    this.stopWindowWatcher();
    this.childWindow = null;
    for (const cb of this.closeCallbacks) {
      try {
        cb();
      } catch (e) {
        console.error('Error in window close callback:', e);
      }
    }
  }

  private notifyFocus(focused: boolean): void {
    for (const cb of this.focusCallbacks) {
      try {
        cb(focused);
      } catch (e) {
        console.error('Error in focus callback:', e);
      }
    }
  }
}
