import { findDraftPopoutReplyButton } from './sync-observer';

export interface KeyboardBrokerOptions {
  onTriageAction?: (actionKey: string, event: KeyboardEvent) => void;
  onEscape?: () => void;
  onToggleTheme?: () => void;
  onReply?: () => void;
}

export class KeyboardBroker {
  private childWindow: Window | null = null;
  private boundHandler: (e: KeyboardEvent) => void;
  private boundClickHandler: ((e: MouseEvent) => void) | null = null;
  private onTriageAction?: (actionKey: string, event: KeyboardEvent) => void;
  private onEscape?: () => void;
  private onToggleTheme?: () => void;
  private onReply?: () => void;
  private currentThreadIndex: number = -1;

  // Single-stroke triage keys
  private readonly triageKeys = new Set([
    'j', // Next thread
    'k', // Previous thread
    'o', // Open thread
    'u', // Return to list / re-dock
    'e', // Archive
    'y', // Archive (alternative)
    '#', // Delete
    'Delete',
    's', // Star
    '!', // Report spam
    'r', // Reply
    'a', // Reply all
    'f', // Forward
    'x', // Select thread
    'z', // Undo
    't', // Toggle theme drawer
    'T',
  ]);

  constructor(options?: KeyboardBrokerOptions) {
    this.onTriageAction = options?.onTriageAction;
    this.onEscape = options?.onEscape;
    this.onToggleTheme = options?.onToggleTheme;
    this.onReply = options?.onReply;
    this.boundHandler = this.handleKeyDown.bind(this);
    this.setupClickTracking();
  }

  /**
   * Attaches keyboard broker to the detached window.
   */
  attach(childWindow: Window): void {
    this.detach();
    this.childWindow = childWindow;
    this.childWindow.addEventListener('keydown', this.boundHandler, true);
  }

  /**
   * Detaches keyboard listener and cleans up references.
   */
  detach(): void {
    if (this.childWindow) {
      this.childWindow.removeEventListener('keydown', this.boundHandler, true);
      this.childWindow = null;
    }
  }

  destroy(): void {
    this.detach();
    if (this.boundClickHandler && typeof document !== 'undefined') {
      document.removeEventListener('click', this.boundClickHandler, true);
      this.boundClickHandler = null;
    }
  }

  /**
   * Tracks manual mouse clicks in Gmail to keep keyboard cursor in sync.
   */
  private setupClickTracking(): void {
    if (typeof document === 'undefined') return;
    this.boundClickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const row = target.closest('table[role="grid"] tr[role="row"]') as HTMLElement | null;
      if (row) {
        const rows = this.getThreadRows();
        const idx = rows.indexOf(row);
        if (idx !== -1) {
          this.currentThreadIndex = idx;
        }
      }
    };
    document.addEventListener('click', this.boundClickHandler, true);
  }

  /**
   * Checks if user is actively typing in an input element.
   */
  isInputCollision(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) {
      return false;
    }

    const el = target as HTMLElement;

    // 1. Direct input tags
    const tagName = el.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
      return true;
    }

    // 2. Direct contenteditable or textbox attributes
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox') {
      return true;
    }

    // 3. Nested editable containers or Gmail compose/draft editor wrappers
    if (
      Boolean(
        el.closest(
          'input, textarea, select, [contenteditable="true"], [role="textbox"], .M9, .aoP, .editable, [aria-label*="Message Body" i], [aria-label*="Draft" i]'
        )
      )
    ) {
      return true;
    }

    return false;
  }

  /**
   * Returns all conversation rows in the active Gmail message list.
   */
  getThreadRows(): HTMLElement[] {
    if (typeof document === 'undefined') return [];
    return Array.from(
      document.querySelectorAll<HTMLElement>('[role="main"] table[role="grid"] tr[role="row"], table[role="grid"] tr[role="row"]')
    ).filter((r) => r.querySelector('td'));
  }

  /**
   * Finds the index of the currently active/selected thread row in the list.
   */
  findActiveRowIndex(rows: HTMLElement[]): number {
    // 1. Check Gmail's split mode active highlight class .aqw
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].classList.contains('aqw')) {
        return i;
      }
    }

    // 2. Check open thread ID matching data-thread-id or data-legacy-thread-id
    const threadEl = document.querySelector('[data-thread-perm-id], h2[data-thread-perm-id]');
    const permId = threadEl?.getAttribute('data-thread-perm-id');
    if (permId) {
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].querySelector(`[data-thread-id="${permId}"], [data-legacy-thread-id="${permId}"]`)) {
          return i;
        }
      }
    }

    // 3. Check location hash
    if (typeof window !== 'undefined' && window.location?.hash) {
      const hashParts = window.location.hash.split('/');
      const hashId = hashParts[hashParts.length - 1];
      if (hashId && hashId.length > 5) {
        for (let i = 0; i < rows.length; i++) {
          if (rows[i].innerHTML.includes(hashId)) {
            return i;
          }
        }
      }
    }

    return -1;
  }

  /**
   * Directly navigates to the next (direction = +1) or previous (direction = -1) thread row in Gmail.
   */
  navigateThread(direction: number): boolean {
    if (typeof document === 'undefined') return false;

    const rows = this.getThreadRows();
    if (rows.length === 0) return false;

    // If current index is unset or out of bounds, find initial active row
    if (this.currentThreadIndex < 0 || this.currentThreadIndex >= rows.length) {
      const activeIdx = this.findActiveRowIndex(rows);
      this.currentThreadIndex = activeIdx >= 0 ? activeIdx : (direction > 0 ? -1 : rows.length);
    }

    // Calculate new target index with direction (+1 or -1)
    const targetIndex = Math.max(0, Math.min(rows.length - 1, this.currentThreadIndex + direction));

    // Update state to target index
    this.currentThreadIndex = targetIndex;

    const targetRow = rows[targetIndex];
    if (targetRow) {
      if (typeof targetRow.scrollIntoView === 'function') {
        targetRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }

      // Update .aqw visual indicator on rows so Gmail's split highlight updates immediately
      rows.forEach((r, idx) => {
        if (idx === targetIndex) {
          r.classList.add('aqw');
        } else {
          r.classList.remove('aqw');
        }
      });

      // Find clickable area in row (subject or sender cell, avoiding checkbox or star)
      const clickable =
        targetRow.querySelector<HTMLElement>('td.xY, td.yX, span.bog, [data-thread-id]') ||
        targetRow.querySelector<HTMLElement>('td:nth-child(4), td:nth-child(5), td:nth-child(3)') ||
        targetRow.querySelector<HTMLElement>('td[role="gridcell"]') ||
        targetRow;

      try {
        clickable.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        clickable.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      } catch {}
      clickable.click();
      return true;
    }

    return false;
  }

  /**
   * Triggers actions directly on Gmail's toolbar or active conversation.
   */
  triggerToolbarAction(action: 'archive' | 'delete' | 'star' | 'reply' | 'forward' | 'markUnread' | 'spam'): boolean {
    if (typeof document === 'undefined') return false;

    const rows = this.getThreadRows();
    const currentRow =
      this.currentThreadIndex >= 0 && this.currentThreadIndex < rows.length
        ? rows[this.currentThreadIndex]
        : rows.find((r) => r.classList.contains('aqw')) || rows[0] || null;

    if (action === 'star') {
      // 1. Star button in current row
      if (currentRow) {
        const rowStar = currentRow.querySelector<HTMLElement>(
          '[role="checkbox"][aria-label*="star" i], [aria-label*="star" i], [data-tooltip*="star" i], .T-KT'
        );
        if (rowStar) {
          rowStar.click();
          return true;
        }
      }
      // 2. Star button in reading pane header
      const headerStar = document.querySelector<HTMLElement>(
        '[data-thread-perm-id] [aria-label*="star" i], [role="region"] [aria-label*="star" i], [data-tooltip*="star" i]'
      );
      if (headerStar) {
        headerStar.click();
        return true;
      }
    }

    if (action === 'archive') {
      // 1. Row quick action button (revealed on hover/active in Gmail rows)
      if (currentRow) {
        const rowArchive = currentRow.querySelector<HTMLElement>(
          '[aria-label*="Archive" i], [data-tooltip*="Archive" i], [act="7"]'
        );
        if (rowArchive) {
          rowArchive.click();
          return true;
        }
      }
      // 2. Top toolbar archive button
      const toolbarArchive = document.querySelector<HTMLElement>(
        '[aria-label*="Archive" i], [data-tooltip*="Archive" i], [act="7"]'
      );
      if (toolbarArchive) {
        toolbarArchive.click();
        return true;
      }
      // 3. Select row checkbox to reveal top toolbar archive button
      if (currentRow) {
        const checkbox = currentRow.querySelector<HTMLElement>('div[role="checkbox"], [aria-label*="Select" i]');
        if (checkbox) {
          checkbox.click();
          const revealed = document.querySelector<HTMLElement>(
            '[aria-label*="Archive" i], [data-tooltip*="Archive" i], [act="7"]'
          );
          if (revealed) {
            revealed.click();
            return true;
          }
        }
      }
    }

    if (action === 'delete') {
      // 1. Row quick action delete button
      if (currentRow) {
        const rowDelete = currentRow.querySelector<HTMLElement>(
          '[aria-label*="Delete" i], [data-tooltip*="Delete" i], [aria-label*="Trash" i], [data-tooltip*="Trash" i], [act="10"]'
        );
        if (rowDelete) {
          rowDelete.click();
          return true;
        }
      }
      // 2. Top toolbar delete button
      const toolbarDelete = document.querySelector<HTMLElement>(
        '[aria-label*="Delete" i], [data-tooltip*="Delete" i], [act="10"]'
      );
      if (toolbarDelete) {
        toolbarDelete.click();
        return true;
      }
      // 3. Select row checkbox to reveal top toolbar delete button
      if (currentRow) {
        const checkbox = currentRow.querySelector<HTMLElement>('div[role="checkbox"], [aria-label*="Select" i]');
        if (checkbox) {
          checkbox.click();
          const revealed = document.querySelector<HTMLElement>(
            '[aria-label*="Delete" i], [data-tooltip*="Delete" i], [act="10"]'
          );
          if (revealed) {
            revealed.click();
            return true;
          }
        }
      }
    }

    if (action === 'reply' || action === 'forward') {
      const isForward = action === 'forward';
      const targetBtn = isForward
        ? document.querySelector<HTMLElement>(
            '[role="region"] [aria-label*="Forward" i], [role="region"] [data-tooltip*="Forward" i], [role="main"] [aria-label*="Forward" i], [role="main"] [data-tooltip*="Forward" i]'
          )
        : document.querySelector<HTMLElement>(
            '[role="region"] [aria-label*="Reply" i]:not([aria-label*="all" i]), [role="region"] [data-tooltip*="Reply" i]:not([data-tooltip*="all" i]), [role="main"] [aria-label*="Reply" i]:not([aria-label*="all" i]), [role="main"] [data-tooltip*="Reply" i]:not([data-tooltip*="all" i]), div.ams[role="button"], span[role="button"][data-tooltip*="Reply" i]'
          );

      if (targetBtn) {
        targetBtn.click();
      }

      // Poll for the inline draft's "Pop-out reply" button to pop it into the floating compose modal
      let attempts = 0;
      const pollInterval = setInterval(() => {
        attempts++;
        const popoutBtn = findDraftPopoutReplyButton(document);
        if (popoutBtn) {
          clearInterval(pollInterval);
          popoutBtn.click();
          if (typeof window !== 'undefined' && typeof window.focus === 'function') {
            window.focus();
          }
        } else if (attempts >= 30) {
          clearInterval(pollInterval);
        }
      }, 80);

      if (this.onReply) {
        this.onReply();
      }
      return true;
    }

    if (action === 'markUnread') {
      if (currentRow) {
        const rowUnread = currentRow.querySelector<HTMLElement>(
          '[aria-label*="Mark as unread" i], [data-tooltip*="Mark as unread" i], [act="8"]'
        );
        if (rowUnread) {
          rowUnread.click();
          return true;
        }
      }
      const toolbarUnread = document.querySelector<HTMLElement>(
        '[aria-label*="Mark as unread" i], [data-tooltip*="Mark as unread" i], [act="8"]'
      );
      if (toolbarUnread) {
        toolbarUnread.click();
        return true;
      }
      this.routeKeyToParent(new KeyboardEvent('keydown', { key: '_', shiftKey: true, bubbles: true }));
      return true;
    }

    if (action === 'spam') {
      const spamBtn = document.querySelector<HTMLElement>(
        '[aria-label*="Report spam" i], [data-tooltip*="Report spam" i], [act="9"]'
      );
      if (spamBtn) {
        spamBtn.click();
        return true;
      }
      this.routeKeyToParent(new KeyboardEvent('keydown', { key: '!', bubbles: true }));
      return true;
    }

    return false;
  }

  /**
   * Programmatically triggers a key action (e.g. from Nano status bar clicks).
   */
  triggerKey(key: string): void {
    const fakeEvent = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    });
    this.handleKeyDown(fakeEvent);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if ((event as any).__undockRouted) {
      return;
    }

    // Handle Escape globally, even inside inputs
    if (event.key === 'Escape') {
      if (this.onEscape) {
        this.onEscape();
      }
      return;
    }

    // Guard against collision when typing in inputs/text areas
    if (this.isInputCollision(event.target)) {
      return;
    }

    // Ignore modifier keys like Ctrl, Cmd, Alt for pure single-stroke triage keys
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const key = event.key;
    if (this.triageKeys.has(key)) {
      event.preventDefault();
      event.stopPropagation();

      let handled = false;
      // 1. Direct active execution based on key
      if (key === 'j') {
        handled = this.navigateThread(1);
      } else if (key === 'k') {
        handled = this.navigateThread(-1);
      } else if (key === 'e' || key === 'y') {
        handled = this.triggerToolbarAction('archive');
      } else if (key === '#' || key === 'Delete') {
        handled = this.triggerToolbarAction('delete');
      } else if (key === 's') {
        handled = this.triggerToolbarAction('star');
      } else if (key === 'r' || key === 'a') {
        handled = this.triggerToolbarAction('reply');
      } else if (key === 'f') {
        handled = this.triggerToolbarAction('forward');
      } else if (key === 't' || key === 'T') {
        handled = true;
        if (this.onToggleTheme) {
          this.onToggleTheme();
        }
      }

      // 2. Dispatch to custom handler if registered
      if (this.onTriageAction) {
        this.onTriageAction(key, event);
      }

      // 3. ONLY route the triage keyboard event to the parent window if NOT handled locally
      if (!handled) {
        this.routeKeyToParent(event);
      }
    }
  }

  /**
   * Dispatches synthetic KeyboardEvent to parent document body/activeElement.
   */
  private routeKeyToParent(originalEvent: KeyboardEvent): void {
    if (typeof window === 'undefined' || !window.document) return;

    const syntheticEvent = new KeyboardEvent(originalEvent.type, {
      key: originalEvent.key,
      code: originalEvent.code,
      keyCode: originalEvent.keyCode,
      which: originalEvent.which,
      charCode: originalEvent.charCode,
      bubbles: true,
      cancelable: true,
      composed: true,
      shiftKey: originalEvent.shiftKey,
    });
    (syntheticEvent as any).__undockRouted = true;

    const target = window.document.activeElement || window.document.body;
    target.dispatchEvent(syntheticEvent);
  }
}
