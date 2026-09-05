import { SiteAdapter, UndockCore } from '../base';
import { GMAIL_SELECTORS } from './selectors';
import { safeCssEscape, dispatchSyntheticClick } from '../../utils/dom';

const dispatchClosureClick = dispatchSyntheticClick;

export class GmailAdapter implements SiteAdapter {
  readonly name = 'gmail';
  readonly domainPattern = /^mail\.google\.com$/;

  readonly selectors = {
    listContainer: GMAIL_SELECTORS.listContainer,
    detailContainer: GMAIL_SELECTORS.detailContainer,
    actionButtons: GMAIL_SELECTORS.actionButtons,
  };

  onInit(_core: UndockCore): void {
    this.injectAdapterStyles();
  }

  private injectAdapterStyles(): void {
    if (typeof document === 'undefined') return;
    if (document.getElementById('undock-gmail-styles')) return;

    const style = document.createElement('style');
    style.id = 'undock-gmail-styles';
    style.textContent = `
      /* Zero-flicker preemptive suppression when undocked */
      body.undock-engine-active [role="main"] > div:has(table[role="grid"]) ~ div,
      body.undock-engine-active [role="region"][aria-label*="reading" i],
      body.undock-engine-active .undock-suppressed-detail {
        position: absolute !important;
        left: -9999px !important;
        top: 0 !important;
        width: 900px !important;
        height: 100% !important;
        min-height: 100% !important;
        opacity: 0 !important;
        z-index: -1000 !important;
      }
      body.undock-engine-active .undock-expanded-list {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        flex: 1 1 auto !important;
        overflow-x: hidden !important;
      }
      body.undock-engine-active table.undock-expanded-list[role="grid"],
      body.undock-engine-active .undock-expanded-list table[role="grid"] {
        display: table !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        table-layout: fixed !important;
      }
      body.undock-engine-active table.undock-expanded-list[role="grid"] > tbody,
      body.undock-engine-active .undock-expanded-list table[role="grid"] > tbody {
        display: table-row-group !important;
        width: 100% !important;
      }
      body.undock-engine-active table.undock-expanded-list[role="grid"] > tbody > tr,
      body.undock-engine-active .undock-expanded-list table[role="grid"] > tbody > tr {
        display: table-row !important;
        width: 100% !important;
      }
      body.undock-engine-active table.undock-expanded-list[role="grid"] td,
      body.undock-engine-active .undock-expanded-list table[role="grid"] td {
        display: table-cell !important;
        min-width: 0;
      }
      /* Give the sender column room while leaving the subject column flexible. */
      body.undock-engine-active table.undock-expanded-list[role="grid"] td.yX,
      body.undock-engine-active .undock-expanded-list table[role="grid"] td.yX {
        width: 180px !important;
        min-width: 180px !important;
        max-width: 180px !important;
      }
      body.undock-engine-active table.undock-expanded-list[role="grid"] td.xY.a4W,
      body.undock-engine-active .undock-expanded-list table[role="grid"] td.xY.a4W,
      body.undock-engine-active table.undock-expanded-list[role="grid"] td.xY:not(.yX):not(.xW),
      body.undock-engine-active .undock-expanded-list table[role="grid"] td.xY:not(.yX):not(.xW) {
        width: auto !important;
        min-width: 0 !important;
        max-width: none !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }
      /* Gmail's colgroup otherwise assigns the full width to its spacer column. */
      body.undock-engine-active table.undock-expanded-list[role="grid"] col.k0vOLb,
      body.undock-engine-active .undock-expanded-list table[role="grid"] col.k0vOLb { width: 0 !important; }
      body.undock-engine-active table.undock-expanded-list[role="grid"] col.Ci,
      body.undock-engine-active .undock-expanded-list table[role="grid"] col.Ci { width: 43px !important; }
      body.undock-engine-active table.undock-expanded-list[role="grid"] col.y5,
      body.undock-engine-active .undock-expanded-list table[role="grid"] col.y5 { width: 30px !important; }
      body.undock-engine-active table.undock-expanded-list[role="grid"] col.yF,
      body.undock-engine-active .undock-expanded-list table[role="grid"] col.yF { width: 212px !important; }
      body.undock-engine-active table.undock-expanded-list[role="grid"] col.yY,
      body.undock-engine-active .undock-expanded-list table[role="grid"] col.yY { width: auto !important; }
      body.undock-engine-active table.undock-expanded-list[role="grid"] col.null,
      body.undock-engine-active .undock-expanded-list table[role="grid"] col.null { width: 0 !important; }
      body.undock-engine-active table.undock-expanded-list[role="grid"] col.eSDBXb,
      body.undock-engine-active .undock-expanded-list table[role="grid"] col.eSDBXb { width: 28px !important; }
      body.undock-engine-active table.undock-expanded-list[role="grid"] col.yg,
      body.undock-engine-active .undock-expanded-list table[role="grid"] col.yg { width: 72px !important; }
      body.undock-engine-active table.undock-expanded-list[role="grid"] col.xX,
      body.undock-engine-active .undock-expanded-list table[role="grid"] col.xX { width: 152px !important; }
      body.undock-engine-active table.undock-expanded-list[role="grid"] col.bq4,
      body.undock-engine-active .undock-expanded-list table[role="grid"] col.bq4 { width: 0 !important; }
      body.undock-engine-active table.undock-expanded-list[role="grid"] col.amZ,
      body.undock-engine-active .undock-expanded-list table[role="grid"] col.amZ { width: 0 !important; }
      /* Keep Gmail's date and hover-action cells visible at the viewport edge. */
      body.undock-engine-active table.undock-expanded-list[role="grid"] td.xW,
      body.undock-engine-active .undock-expanded-list table[role="grid"] td.xW {
        position: sticky !important;
        right: 0 !important;
        width: 72px !important;
        min-width: 72px !important;
        max-width: 72px !important;
        background-color: inherit !important;
        z-index: 3 !important;
      }
      body.undock-engine-active table.undock-expanded-list[role="grid"] td.bq4,
      body.undock-engine-active .undock-expanded-list table[role="grid"] td.bq4 {
        display: table-cell !important;
        position: sticky !important;
        right: 0 !important;
        width: 152px !important;
        min-width: 152px !important;
        max-width: 152px !important;
        background-color: inherit !important;
        z-index: 3 !important;
      }
      body.undock-engine-active table.undock-expanded-list[role="grid"] td.bq4 > ul,
      body.undock-engine-active .undock-expanded-list table[role="grid"] td.bq4 > ul {
        display: flex !important;
      }
      .undock-cloned-detail {
        position: static !important;
        left: auto !important;
        top: auto !important;
        width: 100% !important;
        max-width: 100% !important;
        height: 100% !important;
        visibility: visible !important;
        pointer-events: auto !important;
        opacity: 1 !important;
        box-sizing: border-box !important;
        padding: 24px 32px !important;
      }
      .undock-cloned-detail,
      .undock-cloned-detail > div,
      .undock-cloned-detail .nH,
      .undock-cloned-detail .nH.oy8Mbf,
      .undock-cloned-detail div[role="listitem"],
      .undock-cloned-detail div[role="listitem"] > div,
      .undock-cloned-detail .a3s.aiL,
      .undock-cloned-detail .adn.ads {
        width: 100% !important;
        max-width: 100% !important;
      }
      .undock-cloned-detail table {
        max-width: 100% !important;
      }
      .undock-cloned-detail img {
        max-width: 100% !important;
        height: auto !important;
      }
      .undock-cloned-detail [role="separator"],
      .undock-cloned-detail div[style*="cursor: col-resize"],
      .undock-cloned-detail div[style*="cursor: row-resize"] {
        display: none !important;
      }
    `;
    document.head?.appendChild(style);
  }

  /**
   * Identifies the precise Reading Pane container branch.
   * Guarantees that the message list table (table[role="grid"]) and split wrappers are excluded.
   */
  findDetailContainer(): HTMLElement | null {
    if (typeof document === 'undefined') return null;

    // 1. Active email thread content anchor in reading pane
    const threadCandidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        'h2.hP, .hP, [data-thread-perm-id], div[role="listitem"], .adn, .ads, .ii.gt, div.gs, [data-message-id], [data-thread-id], .a3s'
      )
    );
    const threadAnchor = threadCandidates.find((el) => !el.closest('table[role="grid"], table.zt')) || null;

    if (threadAnchor) {
      let curr: HTMLElement | null = threadAnchor;
      let candidate: HTMLElement = threadAnchor;

      while (curr && curr.parentElement && curr.getAttribute('role') !== 'main' && curr.id !== ':1') {
        const parent: HTMLElement = curr.parentElement;

        // If parent contains the inbox list table, then curr is the isolated reading pane branch
        if (parent.querySelector('table[role="grid"], table.zt')) {
          candidate = curr;
          break;
        }

        // If in full view mode, climb up to top child of role="main" or container with class AO
        if (parent.getAttribute('role') === 'main' || parent.classList.contains('AO') || parent.id === ':1') {
          candidate = curr;
          break;
        }

        candidate = curr;
        curr = parent;
      }

      if (candidate && !candidate.querySelector('table[role="grid"], table.zt')) {
        return candidate;
      }
    }

    // 2. Reading pane container sibling when split mode is on but no thread selected yet
    const listTable = document.querySelector<HTMLElement>('table[role="grid"], table.zt, [role="main"] table');
    if (listTable) {
      let listBranch: HTMLElement | null = listTable;
      while (listBranch && listBranch.parentElement && listBranch.getAttribute('role') !== 'main' && listBranch.id !== ':1') {
        const parent: HTMLElement = listBranch.parentElement;
        if (parent.children.length >= 2) {
          for (let i = 0; i < parent.children.length; i++) {
            const sibling = parent.children[i] as HTMLElement;
            if (
              sibling !== listBranch &&
              !sibling.querySelector('table[role="grid"], table.zt') &&
              !sibling.matches('[role="toolbar"], .G-atb, .aqJ, .ar5') &&
              !sibling.querySelector('[role="toolbar"]')
            ) {
              return sibling;
            }
          }
        }
        listBranch = parent;
      }
    }

    return null;
  }

  /**
   * Checks whether Gmail has split reading pane active.
   * Accurately detects Split Mode across all Gmail themes, languages, and states:
   * - State 1: Reading pane is already suppressed offscreen by Undock.
   * - State 2: Both inbox list table AND an active thread/reading pane coexist in the DOM.
   * - State 3: Split resize separator / divider exists in DOM.
   * - State 4: List table has a sibling pane branch (split layout with or without an email open).
   * - State 5: Toolbar split toggle button or Quick Settings radio indicates split mode.
   */
  isSplitModeActive(): boolean {
    if (typeof document === 'undefined') return false;

    // 1. Check if reading pane is already suppressed by Undock
    if (document.querySelector('[data-undock-suppressed="true"], .undock-suppressed-detail')) {
      return true;
    }

    // 2. Definitive: In split mode, BOTH the inbox list table AND email thread content coexist simultaneously.
    // In No-split mode, opening an email unmounts the list table entirely.
    const listTable = document.querySelector<HTMLElement>('table[role="grid"], table.zt, [role="main"] table');
    if (listTable) {
      const threadCandidates = Array.from(
        document.querySelectorAll<HTMLElement>(
          'h2.hP, .hP, [data-thread-perm-id], div[role="listitem"], .adn, .ads, .ii.gt, div.gs, [data-message-id], [data-thread-id], .a3s, span.ams.bkH'
        )
      );
      const activeThreadInPane = threadCandidates.find((el) => !el.closest('table[role="grid"], table.zt'));
      if (activeThreadInPane) {
        return true;
      }
    }

    // 3. Check if split separator or resize divider exists
    const separator = document.querySelector<HTMLElement>(
      '[role="separator"], div.bZ, div.aXl, div.aXm, div[style*="col-resize"], div[style*="row-resize"]'
    );
    if (separator) {
      return true;
    }

    // 4. In split mode without an email selected yet, check if list table has a sibling reading pane branch
    if (listTable) {
      let curr: HTMLElement | null = listTable;
      while (curr && curr.parentElement && curr.getAttribute('role') !== 'main' && curr.id !== ':1') {
        const parent: HTMLElement = curr.parentElement;
        if (parent && parent.children.length >= 2) {
          for (let i = 0; i < parent.children.length; i++) {
            const sibling = parent.children[i] as HTMLElement;
            if (
              sibling !== curr &&
              !sibling.querySelector('table[role="grid"], table.zt') &&
              !sibling.matches('[role="toolbar"], .G-atb, .aqJ, .ar5') &&
              !sibling.querySelector('[role="toolbar"]')
            ) {
              const width = sibling.offsetWidth;
              const height = sibling.offsetHeight;
              const hasSplitClass =
                sibling.classList.contains('aXm') ||
                sibling.classList.contains('aKh') ||
                sibling.classList.contains('bZ') ||
                sibling.classList.contains('aXl') ||
                sibling.classList.contains('Nu');
              const hasContent = Boolean(sibling.textContent && sibling.textContent.trim().length > 0);
              // In split mode, the sibling reading pane branch has dimensions, split classes, or placeholder text
              if (width > 30 || height > 30 || hasSplitClass || hasContent) {
                return true;
              }
            }
          }
        }
        curr = parent;
      }
    }

    // 5. Check toolbar split button indicators if present
    const splitBtn = document.querySelector<HTMLElement>(
      'div.asf, div[role="button"][aria-label*="split" i], div[role="button"][data-tooltip*="split" i]'
    );
    if (splitBtn) {
      const label = (splitBtn.getAttribute('aria-label') || splitBtn.getAttribute('data-tooltip') || '').toLowerCase();
      // Only match affirmative split mode indicators
      if (
        label.includes('vertical') ||
        label.includes('horizontal') ||
        label.includes('right of inbox') ||
        label.includes('below inbox')
      ) {
        return true;
      }
      if (splitBtn.getAttribute('aria-pressed') === 'true' || splitBtn.getAttribute('aria-checked') === 'true') {
        return true;
      }
    }

    return false;
  }

  /**
   * Automatically enables Gmail's Reading Pane (split mode).
   * Tries toolbar toggle, split mode dropdown, and Quick Settings automation.
   */
  async enableSplitMode(): Promise<boolean> {
    if (typeof document === 'undefined') return false;

    if (this.isSplitModeActive()) {
      return true;
    }

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    // If currently viewing an email in full-screen (no list table present), navigate back to inbox first
    const hasGrid = Boolean(document.querySelector('[role="main"] table[role="grid"]'));
    if (!hasGrid) {
      const backToInboxBtn = document.querySelector<HTMLElement>(
        'div[role="button"][aria-label*="Back to" i], div[role="button"][data-tooltip*="Back to" i], div[act="19"], div.ar6'
      );
      if (backToInboxBtn) {
        dispatchClosureClick(backToInboxBtn);
      } else if (typeof window !== 'undefined') {
        window.location.hash = '#inbox';
      }
      for (let i = 0; i < 10; i++) {
        await delay(100);
        if (document.querySelector('[role="main"] table[role="grid"]')) break;
      }
    }

    // Strategy 1: Toolbar split toggle button
    const splitToggleBtn = document.querySelector<HTMLElement>(
      'div.asf, div[role="button"][aria-label*="Toggle split pane" i], ' +
      'div[role="button"][data-tooltip*="Toggle split pane" i], ' +
      'div[role="button"][aria-label*="split pane mode" i], ' +
      'div[role="button"][aria-label*="split" i]'
    );

    if (splitToggleBtn) {
      dispatchClosureClick(splitToggleBtn);
      await delay(300);
      if (this.isSplitModeActive()) {
        return true;
      }

      // Strategy 2: Toolbar split mode selector dropdown
      const splitDropdownBtn =
        splitToggleBtn.parentElement?.querySelector<HTMLElement>(
          'div.asg, div[role="button"][aria-label*="Select split" i], div[role="button"]:has(span.G-asx)'
        ) ||
        document.querySelector<HTMLElement>(
          'div.asg, div[role="button"][aria-label*="Select split pane mode" i], ' +
          'div[role="button"][aria-label*="split" i]:has(.G-asx)'
        );

      if (splitDropdownBtn) {
        dispatchClosureClick(splitDropdownBtn);
        await delay(200);

        const menuItems = Array.from(
          document.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemcheckbox"], .J-N')
        );
        const verticalOption = menuItems.find((item) =>
          /vertical|right of inbox/i.test(item.textContent || item.innerText || '')
        );
        if (verticalOption) {
          dispatchClosureClick(verticalOption);
          await delay(300);
          if (this.isSplitModeActive()) {
            return true;
          }
        }
      }
    }

    // Strategy 3: Quick Settings drawer automation
    const settingsBtn = document.querySelector<HTMLElement>(
      '[aria-label*="Settings" i], [data-tooltip*="Settings" i], div[gh="s"], div.FI, a.FH'
    );

    if (settingsBtn) {
      dispatchClosureClick(settingsBtn);

      // Dynamically wait up to 1500ms for Quick Settings drawer to appear
      let drawer: HTMLElement | null = null;
      for (let i = 0; i < 15; i++) {
        drawer = document.querySelector<HTMLElement>(
          '[role="region"][aria-label*="Quick settings" i], div[aria-label*="Quick settings" i], .bAw, .bAu'
        );
        if (drawer) break;
        await delay(100);
      }

      if (drawer) {
        // Scroll drawer to reveal Reading pane section
        drawer.scrollTop = drawer.scrollHeight;
        await delay(100);

        const candidates = Array.from(
          drawer.querySelectorAll<HTMLElement>(
            'input[type="radio"], [role="radio"], label, span, div'
          )
        );
        const rightOfInbox = candidates.find((el) => {
          const text = ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '') + ' ' + (el.innerText || '')).trim();
          return /Right of inbox|Vertical split/i.test(text);
        });

        if (rightOfInbox) {
          const clickable =
            rightOfInbox.querySelector<HTMLElement>('input, [role="radio"]') || rightOfInbox;
          dispatchClosureClick(clickable);
          // Wait for Gmail to apply split mode
          for (let i = 0; i < 15; i++) {
            await delay(150);
            if (this.isSplitModeActive()) break;
          }
        }

        // Close the Quick Settings panel
        const closeBtn = drawer.querySelector<HTMLElement>(
          'button[aria-label*="Close" i], [role="button"][aria-label*="Close" i], .bAv'
        );
        if (closeBtn) {
          dispatchClosureClick(closeBtn);
        } else {
          dispatchClosureClick(settingsBtn);
        }

        await delay(200);
        return this.isSplitModeActive();
      }
    }

    return false;
  }

  /**
   * Checks whether an email thread is currently selected.
   */
  isThreadSelected(): boolean {
    if (typeof document === 'undefined') return false;
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        'h2.hP, .hP, [data-thread-perm-id], div[role="listitem"], .adn, .ads, .ii.gt, div.gs, [data-message-id], [data-thread-id], .a3s'
      )
    );
    return Boolean(candidates.find((el) => !el.closest('table[role="grid"], table.zt')));
  }

  /**
   * Shifts the native reading pane offscreen while preserving fixed width and full height
   * so Gmail's internal layout and virtual scrolling continue working.
   * Keeps pointer-events: auto and opacity: 0 so programmatic event dispatching and Google Wiz
   * checks (e.g. Gemini AI summary button) succeed without element rejection.
   */
  suppressDetailPane(detailEl: HTMLElement): void {
    detailEl.classList.add('undock-suppressed-detail');
    detailEl.setAttribute('data-undock-suppressed', 'true');
    detailEl.style.setProperty('position', 'absolute', 'important');
    detailEl.style.setProperty('left', '-9999px', 'important');
    detailEl.style.setProperty('width', '900px', 'important');
    detailEl.style.setProperty('height', '100%', 'important');
    detailEl.style.setProperty('opacity', '0', 'important');
    detailEl.style.setProperty('z-index', '-1000', 'important');
    detailEl.style.setProperty('pointer-events', 'auto', 'important');

    // Expand the list pane to 100% full width
    const listEl = this.findListContainer();
    if (listEl) {
      listEl.classList.add('undock-expanded-list');
      listEl.style.setProperty('width', '100%', 'important');
      listEl.style.setProperty('max-width', '100%', 'important');
      listEl.style.setProperty('min-width', '0', 'important');
      listEl.style.setProperty('flex', '1 1 auto', 'important');
      listEl.style.setProperty('overflow-x', 'hidden', 'important');
    }
  }

  /**
   * Restores reading pane and list pane layout back to embedded split view.
   */
  restoreDetailPane(detailEl: HTMLElement): void {
    detailEl.classList.remove('undock-suppressed-detail');
    detailEl.removeAttribute('data-undock-suppressed');
    detailEl.style.removeProperty('position');
    detailEl.style.removeProperty('left');
    detailEl.style.removeProperty('width');
    detailEl.style.removeProperty('height');
    detailEl.style.removeProperty('opacity');
    detailEl.style.removeProperty('z-index');
    detailEl.style.removeProperty('visibility');
    detailEl.style.removeProperty('pointer-events');

    const listEl = this.findListContainer();
    if (listEl) {
      listEl.classList.remove('undock-expanded-list');
      listEl.style.removeProperty('width');
      listEl.style.removeProperty('max-width');
      listEl.style.removeProperty('min-width');
      listEl.style.removeProperty('flex');
      listEl.style.removeProperty('overflow-x');
    }
  }

  /**
   * Pre-processes cloned DOM before mounting in secondary window.
   * Ensures pure email content with clean padding and no split separators.
   */
  onBeforeSync(clone: HTMLElement): HTMLElement {
    clone.classList.remove('undock-suppressed-detail');
    clone.classList.add('undock-cloned-detail');
    clone.removeAttribute('data-undock-suppressed');

    // Ensure visible positioning in pop-out window
    clone.style.removeProperty('position');
    clone.style.removeProperty('left');
    clone.style.removeProperty('visibility');
    clone.style.removeProperty('pointer-events');
    clone.style.removeProperty('opacity');
    clone.style.removeProperty('z-index');
    clone.style.removeProperty('max-width');
    clone.style.setProperty('position', 'static', 'important');
    clone.style.setProperty('width', '100%', 'important');
    clone.style.setProperty('height', '100%', 'important');
    clone.style.setProperty('visibility', 'visible', 'important');
    clone.style.setProperty('opacity', '1', 'important');
    clone.style.setProperty('pointer-events', 'auto', 'important');

    // Remove any split separators or resize bars that might exist inside
    const separators = clone.querySelectorAll('[role="separator"], div[style*="col-resize"], div[style*="row-resize"]');
    separators.forEach((sep) => (sep as HTMLElement).style.setProperty('display', 'none', 'important'));

    return clone;
  }

  /**
   * Proxies actions triggered in detached window back to parent Gmail DOM.
   */
  handleActionProxy(action: string, targetEl: HTMLElement): boolean {
    const actionButtons = this.selectors.actionButtons as Record<string, string> | undefined;
    const selector = actionButtons?.[action];
    if (selector) {
      const sourceBtn = document.querySelector<HTMLElement>(selector);
      if (sourceBtn) {
        dispatchClosureClick(sourceBtn);
        return true;
      }
    }

    // Direct mapping by aria-label or tooltip if action button is clicked inside cloned pane
    const ariaLabel = targetEl.getAttribute('aria-label') || targetEl.getAttribute('data-tooltip');
    if (ariaLabel) {
      if (/more\b/i.test(ariaLabel)) {
        return false; // Handled by DropdownMenu in detached window
      }
      const escaped = safeCssEscape(ariaLabel);
      // Prefer button inside reading pane first, then global document
      const detailContainer = this.findDetailContainer();
      const parentBtn =
        detailContainer?.querySelector<HTMLElement>(`[aria-label="${escaped}"], [data-tooltip="${escaped}"]`) ||
        document.querySelector<HTMLElement>(`[aria-label="${escaped}"], [data-tooltip="${escaped}"]`);
      if (parentBtn && parentBtn !== targetEl) {
        dispatchClosureClick(parentBtn);
        return true;
      }
    }

    return false;
  }

  findListContainer(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    const table = document.querySelector<HTMLElement>('[role="main"] table[role="grid"]');
    if (!table) return null;

    let curr: HTMLElement | null = table;
    while (curr && curr.parentElement && curr.getAttribute('role') !== 'main') {
      if (curr.parentElement.children.length >= 2) {
        return curr;
      }
      curr = curr.parentElement;
    }

    return table;
  }
}
