import { ActionProxyHandler } from '../types';
import { safeCssEscape, dispatchSyntheticClick } from '../utils/dom';
import {
  DropdownMenu,
  isMoreMenuButton,
  buildMoreMenuItems,
  MoreMenuActionHandlers,
} from '../ui/dropdown-menu';

export { dispatchSyntheticClick };

/**
 * Locates Gmail's native "Pop-out reply" button specifically inside the inline reply/draft container.
 * Strictly avoids clicking thread-level "In new window" buttons to ensure drafts pop out into
 * Gmail's internal floating compose card in the main window without opening separate browser windows.
 */
export function findDraftPopoutReplyButton(root?: Document | HTMLElement | null): HTMLElement | null {
  const doc = root || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  // 1. Locate active draft container(s) in Gmail
  const draftContainers = Array.from(
    doc.querySelectorAll<HTMLElement>(
      '.M9, .aoP, [role="region"][aria-label*="Draft" i], [aria-label*="Draft" i], div:has(> div[role="textbox"])'
    )
  );

  for (const draft of draftContainers) {
    // Only search WITHIN the draft container for the "Pop-out reply" button
    const popoutBtn = draft.querySelector<HTMLElement>(
      'span.ams.bkH, div.ams.bkH, span[role="button"].ams, .aoP span.ams, [data-tooltip*="Pop-out reply" i], [aria-label*="Pop-out reply" i]'
    );
    if (popoutBtn) {
      return popoutBtn;
    }
  }

  // 2. Fallback: Search globally for pop-out reply buttons with explicit "reply" in tooltip/aria-label
  // NEVER match "In new window" or general thread popout!
  const replyPopout = doc.querySelector<HTMLElement>(
    'span.ams.bkH, div.ams.bkH, [data-tooltip="Pop-out reply" i], [aria-label="Pop-out reply" i], [data-tooltip*="Pop-out reply" i], [aria-label*="Pop-out reply" i]'
  );
  if (replyPopout) {
    return replyPopout;
  }

  return null;
}

export const findPopoutButton = findDraftPopoutReplyButton;

export class SyncObserver {
  private sourceEl: HTMLElement | null = null;
  private targetContainer: HTMLElement | null = null;
  private onBeforeSync?: (clone: HTMLElement) => HTMLElement;
  private actionProxyHandler?: ActionProxyHandler;
  private dropdownMenu: DropdownMenu = new DropdownMenu();
  private moreMenuHandlers?: MoreMenuActionHandlers;

  private mutationObserver: MutationObserver | null = null;
  private rafId: number | null = null;
  private isSyncingScroll: boolean = false;

  // Bound event listeners for cleanup
  private boundHandleTargetClick: (e: MouseEvent) => void;
  private boundHandleTargetInput: (e: Event) => void;
  private boundHandleTargetSubmit: (e: Event) => void;
  private boundHandleTargetScroll: (e: Event) => void;
  private boundHandleSourceScroll: (e: Event) => void;

  constructor() {
    this.boundHandleTargetClick = this.handleTargetClick.bind(this);
    this.boundHandleTargetInput = this.handleTargetInput.bind(this);
    this.boundHandleTargetSubmit = this.handleTargetSubmit.bind(this);
    this.boundHandleTargetScroll = this.handleTargetScroll.bind(this);
    this.boundHandleSourceScroll = this.handleSourceScroll.bind(this);
  }

  /**
   * Starts DOM mirroring, scroll sync, and event proxying between source and target.
   */
  startSync(
    sourceEl: HTMLElement,
    targetContainer: HTMLElement,
    onBeforeSync?: (clone: HTMLElement) => HTMLElement,
    actionProxyHandler?: ActionProxyHandler,
    moreMenuHandlers?: MoreMenuActionHandlers
  ): void {
    this.disconnect();

    this.sourceEl = sourceEl;
    this.targetContainer = targetContainer;
    this.onBeforeSync = onBeforeSync;
    this.actionProxyHandler = actionProxyHandler;
    this.moreMenuHandlers = moreMenuHandlers;

    // Fast initial projection (<5ms)
    this.performFullSync();

    // Start observing DOM changes on source
    this.startObserving();

    // Attach event proxy and scroll handlers
    this.attachEventListeners();
  }

  /**
   * Disconnects observers, event listeners, and nulls references to avoid memory leaks.
   */
  disconnect(): void {
    this.dropdownMenu.close();
    this.moreMenuHandlers = undefined;

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.detachEventListeners();

    if (this.targetContainer) {
      this.targetContainer.innerHTML = '';
    }

    this.sourceEl = null;
    this.targetContainer = null;
    this.onBeforeSync = undefined;
    this.actionProxyHandler = undefined;
  }

  /**
   * Performs an immediate deep clone and mounts to target container.
   */
  private performFullSync(): void {
    if (!this.sourceEl || !this.targetContainer) return;

    const clone = this.sourceEl.cloneNode(true) as HTMLElement;
    const processed = this.onBeforeSync ? this.onBeforeSync(clone) : clone;

    this.targetContainer.innerHTML = '';
    this.targetContainer.appendChild(processed);

    // Initial scroll sync
    this.syncScrollFromSource();
  }

  /**
   * Schedules a debounced DOM sync using requestAnimationFrame.
   */
  private scheduleSync(): void {
    if (this.rafId !== null) return;

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.performFullSync();
    });
  }

  private startObserving(): void {
    if (!this.sourceEl || typeof MutationObserver === 'undefined') return;

    this.mutationObserver = new MutationObserver(() => {
      this.scheduleSync();
    });

    this.mutationObserver.observe(this.sourceEl, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  }

  private attachEventListeners(): void {
    if (this.targetContainer) {
      this.targetContainer.addEventListener('click', this.boundHandleTargetClick, true);
      this.targetContainer.addEventListener('input', this.boundHandleTargetInput, true);
      this.targetContainer.addEventListener('submit', this.boundHandleTargetSubmit, true);
      this.targetContainer.addEventListener('scroll', this.boundHandleTargetScroll, { passive: true });
    }

    if (this.sourceEl) {
      this.sourceEl.addEventListener('scroll', this.boundHandleSourceScroll, { passive: true });
    }
  }

  private detachEventListeners(): void {
    if (this.targetContainer) {
      this.targetContainer.removeEventListener('click', this.boundHandleTargetClick, true);
      this.targetContainer.removeEventListener('input', this.boundHandleTargetInput, true);
      this.targetContainer.removeEventListener('submit', this.boundHandleTargetSubmit, true);
      this.targetContainer.removeEventListener('scroll', this.boundHandleTargetScroll);
    }

    if (this.sourceEl) {
      this.sourceEl.removeEventListener('scroll', this.boundHandleSourceScroll);
    }
  }

  /**
   * Event Proxy: intercepts clicks in detached window and dispatches to source element.
   */
  private handleTargetClick(e: MouseEvent): void {
    const target = e.target as HTMLElement | null;
    if (!target || !this.sourceEl) return;

    // 1. Check if clicked element or parent is a 3-dot "More options" button
    const moreBtn =
      target.closest<HTMLElement>(
        'button, [role="button"], a, [aria-label*="More" i], [data-tooltip*="More" i], .amD, .ar7, .hB, .aap'
      ) || (isMoreMenuButton(target) ? target : null);

    if (moreBtn && isMoreMenuButton(moreBtn)) {
      e.preventDefault();
      e.stopPropagation();
      this.handleMoreMenuClick(moreBtn);
      return;
    }

    // 2. Check if clicked element or parent is an anchor link with href (e.g. LinkedIn, GitHub, email links)
    const anchor = target.closest<HTMLAnchorElement>('a[href]');
    if (anchor && anchor.href && !anchor.href.startsWith('javascript:')) {
      e.preventDefault();
      e.stopPropagation();
      const targetWin = window.opener || window;
      try {
        targetWin.open(anchor.href, anchor.target || '_blank', 'noopener,noreferrer');
      } catch {
        window.open(anchor.href, anchor.target || '_blank', 'noopener,noreferrer');
      }
      return;
    }

    // 3. Check if clicked inside an inline draft composer or pop-out button
    const isInsideDraft = Boolean(
      target.closest(
        '[role="region"][aria-label*="Draft" i], [aria-label*="Draft" i], .M9, .aoP, div[role="textbox"], [contenteditable="true"], .editable, span.ams.bkH, div.ams.bkH, [data-tooltip*="Pop-out reply" i]'
      )
    );

    if (isInsideDraft) {
      e.preventDefault();
      e.stopPropagation();

      // Check if floating compose modal is already open in main window
      const floatingModal = document.querySelector<HTMLElement>(
        'div[role="dialog"] div[role="textbox"], div[role="dialog"] [contenteditable="true"], div.AD'
      );
      if (floatingModal) {
        floatingModal.focus();
        if (typeof window !== 'undefined') {
          try {
            (window.opener || window).focus();
          } catch {
            window.focus();
          }
        }
        return;
      }

      const popoutBtn = findDraftPopoutReplyButton(this.sourceEl) || findDraftPopoutReplyButton(document);
      if (popoutBtn) {
        popoutBtn.click();
        if (typeof window !== 'undefined') {
          try {
            (window.opener || window).focus();
          } catch {
            window.focus();
          }
        }
        return;
      }
    }

    // 4. Check if clicked element or parent is interactive
    const interactiveEl =
      target.closest<HTMLElement>(
        'button, [role="button"], a, input, select, textarea, [tabindex]:not([tabindex="-1"]), [data-action], [jsaction], [jsname], [data-tooltip], [role="link"], [role="checkbox"], [role="radio"], [role="menuitem"], [role="option"], [role="tab"], .T-I, .ams'
      ) || target;

    // Determine action name if any
    const action =
      interactiveEl.getAttribute('data-action') ||
      interactiveEl.getAttribute('aria-label') ||
      '';

    // 5. Delegate to adapter custom handler first
    if (this.actionProxyHandler && action) {
      const handled = this.actionProxyHandler(action, interactiveEl);
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    const isReplyOrForward =
      /reply|forward/i.test(action) ||
      /reply|forward/i.test(interactiveEl.innerText || interactiveEl.textContent || '');

    // 6. Find corresponding element in source hierarchy using universal matching
    const sourceMatch = this.findMatchingSourceElement(interactiveEl);
    if (sourceMatch && sourceMatch !== interactiveEl) {
      const isEditable =
        target.isContentEditable ||
        target.getAttribute('contenteditable') === 'true' ||
        target.tagName.toLowerCase() === 'input' ||
        target.tagName.toLowerCase() === 'textarea' ||
        interactiveEl.isContentEditable ||
        interactiveEl.getAttribute('contenteditable') === 'true' ||
        interactiveEl.tagName.toLowerCase() === 'input' ||
        interactiveEl.tagName.toLowerCase() === 'textarea';

      // Only preventDefault if not an editable field to preserve native caret placement & focus
      if (!isEditable) {
        e.preventDefault();
      }
      e.stopPropagation();

      if (isReplyOrForward) {
        // Click reply/forward normally (never shiftKey: true on MouseEvent - prevents Chrome opening new window)
        dispatchSyntheticClick(sourceMatch, e);

        // Poll for the inline draft's "Pop-out reply" button to pop it into floating compose modal
        let attempts = 0;
        const pollInterval = setInterval(() => {
          attempts++;
          const popoutBtn = findDraftPopoutReplyButton(this.sourceEl) || findDraftPopoutReplyButton(document);
          if (popoutBtn) {
            clearInterval(pollInterval);
            popoutBtn.click();
            if (typeof window !== 'undefined') {
              try {
                (window.opener || window).focus();
              } catch {
                window.focus();
              }
            }
          } else if (attempts >= 30) {
            clearInterval(pollInterval);
          }
        }, 80);
      } else {
        // Full synthetic pointer/mouse sequence for Google Wiz and dynamic buttons
        dispatchSyntheticClick(sourceMatch, e);
      }
    }
  }

  private handleMoreMenuClick(anchorEl: HTMLElement): void {
    if (this.dropdownMenu.isOpen()) {
      this.dropdownMenu.close();
      return;
    }

    // High-fidelity, immediate 1-click Google Material menu with native action routing
    const handlers: MoreMenuActionHandlers = {
      onReply: () => {
        if (this.moreMenuHandlers?.onReply) {
          this.moreMenuHandlers.onReply();
        } else {
          const match = this.findMatchingSourceElement(anchorEl);
          const replyBtn =
            match?.closest('[role="listitem"], .adn, .gs')?.querySelector<HTMLElement>('[aria-label*="Reply" i]') ||
            document.querySelector<HTMLElement>('[role="region"] [aria-label*="Reply" i], [role="main"] [aria-label*="Reply" i]');
          replyBtn?.click();
        }
      },
      onForward: () => {
        if (this.moreMenuHandlers?.onForward) {
          this.moreMenuHandlers.onForward();
        } else {
          const fwdBtn = document.querySelector<HTMLElement>('[aria-label*="Forward" i], [data-tooltip*="Forward" i]');
          fwdBtn?.click();
        }
      },
      onDelete: () => {
        if (this.moreMenuHandlers?.onDelete) {
          this.moreMenuHandlers.onDelete();
        } else {
          const delBtn = document.querySelector<HTMLElement>('[aria-label*="Delete" i], [data-tooltip*="Delete" i], [act="10"]');
          delBtn?.click();
        }
      },
      onMarkUnread: () => {
        if (this.moreMenuHandlers?.onMarkUnread) {
          this.moreMenuHandlers.onMarkUnread();
        } else {
          const unreadBtn = document.querySelector<HTMLElement>('[aria-label*="Mark as unread" i], [act="8"]');
          unreadBtn?.click();
        }
      },
      onStar: () => {
        if (this.moreMenuHandlers?.onStar) {
          this.moreMenuHandlers.onStar();
        } else {
          const starBtn = document.querySelector<HTMLElement>('[aria-label*="star" i]');
          starBtn?.click();
        }
      },
      onPrint: () => {
        anchorEl.ownerDocument.defaultView?.print();
      },
      onSpam: () => {
        if (this.moreMenuHandlers?.onSpam) {
          this.moreMenuHandlers.onSpam();
        } else {
          const spamBtn = document.querySelector<HTMLElement>('[aria-label*="Report spam" i], [act="9"]');
          spamBtn?.click();
        }
      },
      onPhishing: () => {
        const phishingBtn = document.querySelector<HTMLElement>('[aria-label*="Report phishing" i]');
        phishingBtn?.click();
      },
      onFilter: () => {
        const filterBtn = document.querySelector<HTMLElement>('[aria-label*="Filter messages like this" i]');
        filterBtn?.click();
      },
    };

    const items = buildMoreMenuItems(anchorEl, handlers);
    this.dropdownMenu.open(anchorEl, items);
  }

  /**
   * Event Proxy: intercepts form inputs and contenteditable changes in detached window.
   */
  private handleTargetInput(e: Event): void {
    const target = e.target as HTMLElement | null;
    if (!target || !this.sourceEl) return;

    const sourceMatch = this.findMatchingSourceElement(target);
    if (sourceMatch && sourceMatch !== target) {
      if ('value' in sourceMatch && 'value' in target) {
        (sourceMatch as HTMLInputElement).value = (target as HTMLInputElement).value;
      }
      if ('checked' in sourceMatch && 'checked' in target) {
        (sourceMatch as HTMLInputElement).checked = (target as HTMLInputElement).checked;
      }
      if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') {
        sourceMatch.innerHTML = target.innerHTML;
      }
      sourceMatch.dispatchEvent(new Event('input', { bubbles: true }));
      sourceMatch.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /**
   * Event Proxy: intercepts form submit in detached window.
   */
  private handleTargetSubmit(e: Event): void {
    const form = e.target as HTMLFormElement | null;
    if (!form || !this.sourceEl) return;

    const sourceForm = this.findMatchingSourceElement(form) as HTMLFormElement | null;
    if (sourceForm && sourceForm !== form) {
      e.preventDefault();
      sourceForm.requestSubmit ? sourceForm.requestSubmit() : sourceForm.submit();
    }
  }

  /**
   * Finds matching element in parent source tree using universal multi-tier strategy:
   * 1. ID matching
   * 2. Semantic & Wiz/Gmail attributes (with scoped container disambiguation)
   * 3. Normalized button / chip text content & role matching
   * 4. Corrected root-relative structural path traversal
   */
  findMatchingSourceElement(targetEl: HTMLElement): HTMLElement | null {
    if (!this.sourceEl) return null;

    // 1. Try matching by ID if valid and not generated clone ID
    if (targetEl.id && !targetEl.id.startsWith('cloned-')) {
      const match = this.sourceEl.querySelector<HTMLElement>(`#${safeCssEscape(targetEl.id)}`);
      if (match) return match;
    }

    // 2. Try matching by unique semantic & Wiz/Gmail attributes
    const keyAttrs = [
      'data-message-id',
      'data-thread-perm-id',
      'jsname',
      'data-action',
      'data-tooltip',
      'aria-label',
      'name',
      'act',
    ];
    for (const attr of keyAttrs) {
      const val = targetEl.getAttribute(attr);
      if (val) {
        const matches = this.sourceEl.querySelectorAll<HTMLElement>(`[${attr}="${safeCssEscape(val)}"]`);
        if (matches.length === 1) {
          return matches[0];
        } else if (matches.length > 1) {
          // Disambiguate by message container if inside one
          const scopedMatch = this.findScopedMatch(targetEl, attr, val);
          if (scopedMatch) return scopedMatch;
        }
      }
    }

    // 3. Match dynamic button / action chip by normalized text content
    const textMatch = this.findMatchByTextContent(targetEl);
    if (textMatch) return textMatch;

    // 4. Fixed Root-Relative Structural Path Traversal
    return this.findMatchByStructuralPath(targetEl);
  }

  /**
   * Scopes search to the corresponding message container to disambiguate identical action buttons.
   */
  private findScopedMatch(targetEl: HTMLElement, attr: string, val: string): HTMLElement | null {
    if (!this.sourceEl) return null;

    const targetMessage = targetEl.closest<HTMLElement>('[role="listitem"], [data-message-id], .adn, .gs');
    if (!targetMessage) return null;

    const messageId = targetMessage.getAttribute('data-message-id');
    let sourceMessage: HTMLElement | null = null;
    if (messageId) {
      sourceMessage = this.sourceEl.querySelector<HTMLElement>(`[data-message-id="${safeCssEscape(messageId)}"]`);
    }

    if (!sourceMessage && this.targetContainer) {
      const allTargetMessages = Array.from(this.targetContainer.querySelectorAll<HTMLElement>('[role="listitem"], .adn'));
      const allSourceMessages = Array.from(this.sourceEl.querySelectorAll<HTMLElement>('[role="listitem"], .adn'));
      const msgIndex = allTargetMessages.indexOf(targetMessage);
      if (msgIndex >= 0 && msgIndex < allSourceMessages.length) {
        sourceMessage = allSourceMessages[msgIndex];
      }
    }

    if (sourceMessage) {
      const scopedMatches = sourceMessage.querySelectorAll<HTMLElement>(`[${attr}="${safeCssEscape(val)}"]`);
      if (scopedMatches.length === 1) {
        return scopedMatches[0];
      }
    }

    return null;
  }

  /**
   * Matches dynamic action buttons and chips by normalized text content.
   * Universal solution for AI buttons (e.g. "✦ Summarize this email"),
   * action chips (e.g. "Track package", "RSVP", "Yes", "No", "Unsubscribe"),
   * and custom CTA buttons.
   */
  private findMatchByTextContent(targetEl: HTMLElement): HTMLElement | null {
    if (!this.sourceEl) return null;

    const rawText = (targetEl.innerText || targetEl.textContent || '').trim();
    const normalized = rawText.replace(/\s+/g, ' ');
    if (!normalized || normalized.length < 2 || normalized.length > 60) {
      return null;
    }

    const targetCandidates = this.findTextCandidates(this.targetContainer, normalized);
    const sourceCandidates = this.findTextCandidates(this.sourceEl, normalized);

    if (sourceCandidates.length === 0) return null;

    if (sourceCandidates.length === 1) {
      return sourceCandidates[0];
    }

    // If multiple matches exist, match by ordinal index
    const targetIndex = targetCandidates.indexOf(targetEl);
    if (targetIndex >= 0 && targetIndex < sourceCandidates.length) {
      return sourceCandidates[targetIndex];
    }

    return sourceCandidates[0];
  }

  private findTextCandidates(root: HTMLElement | null, text: string): HTMLElement[] {
    if (!root) return [];
    const candidates: HTMLElement[] = [];
    const elements = root.querySelectorAll<HTMLElement>(
      'button, [role="button"], a, [jsaction], [jsname], [data-action], [data-tooltip], .T-I, .ams, [role="link"]'
    );
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const elText = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
      if (elText === text) {
        candidates.push(el);
      }
    }
    return candidates;
  }

  /**
   * Fixed Root-Relative Structural Path Traversal.
   * Traverses from the clone root inside targetContainer down to targetEl,
   * then descends sourceEl along the exact same child indices.
   */
  private findMatchByStructuralPath(targetEl: HTMLElement): HTMLElement | null {
    if (!this.sourceEl || !this.targetContainer) return null;

    // The clone root inside this.targetContainer corresponds 1:1 to this.sourceEl
    const cloneRoot = this.targetContainer.firstElementChild;
    if (!cloneRoot) return null;

    if (targetEl === cloneRoot) return this.sourceEl;

    const path: number[] = [];
    let curr: HTMLElement | null = targetEl;

    while (curr && curr !== cloneRoot && curr.parentElement && curr.parentElement !== this.targetContainer) {
      const parentEl: HTMLElement = curr.parentElement;
      const index = Array.prototype.indexOf.call(parentEl.children, curr);
      if (index === -1) return null;
      path.unshift(index);
      curr = parentEl;
    }

    if (curr !== cloneRoot) {
      return null;
    }

    let sourceNode: Element | null = this.sourceEl;
    for (const index of path) {
      if (!sourceNode || !sourceNode.children || index >= sourceNode.children.length) {
        return null;
      }
      sourceNode = sourceNode.children[index];
    }

    return sourceNode as HTMLElement;
  }

  private handleTargetScroll(): void {
    if (this.isSyncingScroll || !this.sourceEl || !this.targetContainer) return;
    this.isSyncingScroll = true;
    this.sourceEl.scrollTop = this.targetContainer.scrollTop;
    this.sourceEl.scrollLeft = this.targetContainer.scrollLeft;
    requestAnimationFrame(() => {
      this.isSyncingScroll = false;
    });
  }

  private handleSourceScroll(): void {
    if (this.isSyncingScroll || !this.sourceEl || !this.targetContainer) return;
    this.isSyncingScroll = true;
    this.targetContainer.scrollTop = this.sourceEl.scrollTop;
    this.targetContainer.scrollLeft = this.sourceEl.scrollLeft;
    requestAnimationFrame(() => {
      this.isSyncingScroll = false;
    });
  }

  private syncScrollFromSource(): void {
    if (this.sourceEl && this.targetContainer) {
      this.targetContainer.scrollTop = this.sourceEl.scrollTop;
      this.targetContainer.scrollLeft = this.sourceEl.scrollLeft;
    }
  }
}
