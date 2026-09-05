import { UndockEngine } from '../core/engine';

export class UndockButton {
  private engine: UndockEngine;
  private toolbarContainerEl: HTMLElement | null = null;
  private toolbarBtnEl: HTMLButtonElement | null = null;
  private unsubscribeState?: () => void;
  private mountObserver: MutationObserver | null = null;
  private updateTimer: number | null = null;
  private isUpdating = false;

  constructor(engine: UndockEngine) {
    this.engine = engine;
  }

  /**
   * Mounts the undock trigger button into Gmail's top toolbar.
   */
  mount(targetSelector?: string): void {
    if (typeof document === 'undefined') return;

    this.injectStyles();
    this.ensureElements();

    if (targetSelector) {
      const customTarget = document.querySelector<HTMLElement>(targetSelector);
      if (customTarget && this.toolbarContainerEl) {
        customTarget.appendChild(this.toolbarContainerEl);
      }
    } else {
      this.updateMounts();
    }

    if (!this.unsubscribeState) {
      this.unsubscribeState = this.engine.onStateChange((state) => {
        this.updateState(state.isUndocked);
      });
    }

    // Debounced observer on body to handle late Gmail loading and SPA view changes
    if (!this.mountObserver && document.body) {
      this.mountObserver = new MutationObserver((mutations) => {
        // Filter out mutations caused by our own button container to avoid self-triggering
        let relevant = false;
        for (const m of mutations) {
          if (
            this.toolbarContainerEl &&
            (m.target === this.toolbarContainerEl || this.toolbarContainerEl.contains(m.target as Node))
          ) {
            continue;
          }
          relevant = true;
          break;
        }

        if (relevant) {
          this.scheduleUpdate();
        }
      });

      this.mountObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  destroy(): void {
    if (this.updateTimer !== null) {
      window.clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
    if (this.mountObserver) {
      this.mountObserver.disconnect();
      this.mountObserver = null;
    }
    if (this.unsubscribeState) {
      this.unsubscribeState();
      this.unsubscribeState = undefined;
    }
    this.toolbarContainerEl?.remove();
    this.toolbarContainerEl = null;
    this.toolbarBtnEl = null;
  }

  /**
   * Schedules a throttled update to prevent CPU pegging during Gmail's boot phase.
   */
  scheduleUpdate(): void {
    if (this.updateTimer !== null) {
      return;
    }
    this.updateTimer = window.setTimeout(() => {
      this.updateTimer = null;
      this.updateMounts();
    }, 200);
  }

  /**
   * Evaluates current DOM and attaches/relocates the toolbar button to ideal visible position.
   */
  updateMounts(): void {
    if (typeof document === 'undefined' || this.isUpdating) return;
    this.isUpdating = true;
    try {
      this.ensureElements();
      this.mountToolbarButton();
    } finally {
      this.isUpdating = false;
    }
  }

  private mountToolbarButton(): void {
    if (!this.toolbarContainerEl) return;

    // 1. Primary preference: right beside Gmail's native Split Pane toggle button
    const splitBtn = this.findSplitButton();
    if (splitBtn && splitBtn.parentElement) {
      // If already positioned right before the split button, do not touch the DOM
      if (this.toolbarContainerEl.nextElementSibling === splitBtn) {
        return;
      }
      splitBtn.parentElement.insertBefore(this.toolbarContainerEl, splitBtn);
      return;
    }

    // 2. Secondary preference: inside top action toolbar right group or main toolbar
    const fallbackToolbar = this.findFallbackToolbar();
    if (fallbackToolbar) {
      // If already inside the fallback toolbar and connected, do not touch the DOM
      if (this.toolbarContainerEl.parentElement === fallbackToolbar && this.toolbarContainerEl.isConnected) {
        return;
      }
      fallbackToolbar.appendChild(this.toolbarContainerEl);
    }
  }

  private findSplitButton(): HTMLElement | null {
    const selectors = [
      '[aria-label*="Toggle split pane" i]',
      '[data-tooltip*="Toggle split pane" i]',
      '[aria-label*="split pane" i]',
      '[data-tooltip*="split pane" i]',
      'div[role="button"][aria-label*="split" i]',
      'div[role="button"][data-tooltip*="split" i]',
    ];
    for (const selector of selectors) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el && el.isConnected) {
        return el;
      }
    }
    return null;
  }

  private findFallbackToolbar(): HTMLElement | null {
    const selectors = [
      'div[gh="tm"] .G-tF',
      'div.G-atb .G-tF',
      'div[gh="tm"]',
      'div.G-atb',
      '[role="main"] div[role="toolbar"]',
      '[role="main"] [role="toolbar"]',
    ];
    for (const selector of selectors) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el && el.isConnected) {
        return el;
      }
    }
    return null;
  }

  private ensureElements(): void {
    if (!this.toolbarContainerEl) {
      const container = document.createElement('div');
      container.className = 'undock-button-wrapper';

      const btn = document.createElement('button');
      btn.id = 'undock-trigger-btn';
      btn.className = 'undock-btn';
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-label', 'Undock Reading Pane to Secondary Window');
      btn.setAttribute('title', 'Undock Reading Pane to Secondary Window (Ctrl+Shift+U)');

      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await this.engine.toggle();
      });

      container.appendChild(btn);
      this.toolbarContainerEl = container;
      this.toolbarBtnEl = btn;
    }

    this.updateState(this.engine.isUndocked);
  }

  private updateState(isUndocked: boolean): void {
    if (!this.toolbarBtnEl) return;

    if (isUndocked) {
      this.toolbarBtnEl.classList.add('undock-active');
      this.toolbarBtnEl.setAttribute('aria-label', 'Re-dock Reading Pane');
      this.toolbarBtnEl.setAttribute('title', 'Re-dock Reading Pane to Main Window (Ctrl+Shift+U)');
      this.toolbarBtnEl.innerHTML = `
        <svg class="undock-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="4 14 10 14 10 20"></polyline>
          <polyline points="20 10 14 10 14 4"></polyline>
          <line x1="14" y1="10" x2="21" y2="3"></line>
          <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
        <span class="undock-btn-label">Re-dock</span>
      `;
    } else {
      this.toolbarBtnEl.classList.remove('undock-active');
      this.toolbarBtnEl.setAttribute('aria-label', 'Undock Reading Pane to Secondary Window');
      const isSplit = this.engine.isSplitMode;
      const title = isSplit
        ? 'Undock Reading Pane to Secondary Window (Ctrl+Shift+U)'
        : 'Undock (Requires Gmail Split Reading Pane — enable via ⚙️ Settings → Reading pane)';
      this.toolbarBtnEl.setAttribute('title', title);
      this.toolbarBtnEl.innerHTML = `
        <svg class="undock-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
        <span class="undock-btn-label">Undock</span>
      `;
    }
  }

  private injectStyles(): void {
    if (document.getElementById('undock-button-styles')) return;

    const style = document.createElement('style');
    style.id = 'undock-button-styles';
    style.textContent = `
      .undock-button-wrapper {
        display: inline-flex;
        align-items: center;
        margin: 0 6px;
        vertical-align: middle;
        z-index: 10;
      }
      .undock-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #e8f0fe;
        color: #0b57d0;
        border: 1px solid #c2e7ff;
        border-radius: 16px;
        padding: 4px 12px;
        font-size: 13px;
        font-weight: 600;
        font-family: 'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        cursor: pointer;
        transition: all 0.15s ease-in-out;
        user-select: none;
        height: 32px;
        box-sizing: border-box;
        box-shadow: 0 1px 2px rgba(11, 87, 208, 0.08);
      }
      .undock-btn:hover {
        background: #d3e3fd;
        color: #041e49;
        box-shadow: 0 1px 3px rgba(11, 87, 208, 0.16);
      }
      .undock-btn.undock-active {
        background: #0b57d0;
        color: #ffffff;
        border-color: #0b57d0;
      }
      .undock-btn.undock-active:hover {
        background: #0842a0;
      }
    `;
    document.head?.appendChild(style);
  }
}
