export interface DropdownMenuItem {
  id: string;
  label: string;
  iconSvg?: string;
  isSeparator?: boolean;
  onClick: () => void;
}

export interface MoreMenuActionHandlers {
  onReply?: () => void;
  onForward?: () => void;
  onDelete?: () => void;
  onMarkUnread?: () => void;
  onStar?: () => void;
  onPrint?: () => void;
  onSpam?: () => void;
  onPhishing?: () => void;
  onFilter?: () => void;
}

export function isMoreMenuButton(el: HTMLElement | null): boolean {
  if (!el) return false;

  const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
  const dataTooltip = (el.getAttribute('data-tooltip') || '').toLowerCase();
  const title = (el.getAttribute('title') || '').toLowerCase();

  if (
    ariaLabel.includes('more') ||
    dataTooltip.includes('more') ||
    title.includes('more')
  ) {
    return true;
  }

  // Check SVG path data for 3-dot vertical icon
  const svg = el.querySelector('svg') || (el.tagName.toLowerCase() === 'svg' ? el : null);
  if (svg) {
    const paths = svg.querySelectorAll('path');
    for (const p of paths) {
      const d = p.getAttribute('d') || '';
      if (
        d.includes('M12 8c1.1') ||
        d.includes('M12 2C') ||
        d.includes('2-2s-.9-2-2-2') ||
        d.includes('M12 8') ||
        d.includes('12 10') ||
        d.includes('12 16')
      ) {
        return true;
      }
    }
  }

  // Check text content
  const text = (el.innerText || el.textContent || '').trim();
  if (text === '⋮' || text === '...' || text === '…' || text === 'more_vert') {
    return true;
  }

  // Check Gmail specific classes
  if (
    el.classList.contains('amD') ||
    el.classList.contains('ar7') ||
    el.classList.contains('hB') ||
    el.classList.contains('aap')
  ) {
    return true;
  }

  return false;
}

const MENU_ICONS = {
  reply: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>',
  forward: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M14 9v-4l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/></svg>',
  delete: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
  markUnread: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>',
  star: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
  print: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>',
  spam: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M15.73 3H8.27L3 8.27v7.46L8.27 21h7.46L21 15.73V8.27L15.73 3zM12 17.3c-.72 0-1.3-.58-1.3-1.3s.58-1.3 1.3-1.3 1.3.58 1.3 1.3-.58 1.3-1.3 1.3zm1-4.3h-2V7h2v6z"/></svg>',
  phishing: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v6h-2V7zm1 10.3c-.7 0-1.3-.6-1.3-1.3 0-.7.6-1.3 1.3-1.3.7 0 1.3.6 1.3 1.3 0 .7-.6 1.3-1.3 1.3z"/></svg>',
  filter: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/></svg>',
};

export function buildMoreMenuItems(
  anchorEl: HTMLElement,
  handlers: MoreMenuActionHandlers
): DropdownMenuItem[] {
  // Extract sender name if present in message container
  const msgContainer = anchorEl.closest<HTMLElement>('[role="listitem"], .adn, .gs, .nH');
  const senderEl = msgContainer?.querySelector<HTMLElement>('.gD, span[email], .bJ4');
  const senderName = senderEl?.getAttribute('name') || senderEl?.textContent?.trim() || '';

  return [
    {
      id: 'reply',
      label: 'Reply',
      iconSvg: MENU_ICONS.reply,
      onClick: () => handlers.onReply?.(),
    },
    {
      id: 'forward',
      label: 'Forward',
      iconSvg: MENU_ICONS.forward,
      onClick: () => handlers.onForward?.(),
    },
    {
      id: 'sep1',
      label: '',
      isSeparator: true,
      onClick: () => {},
    },
    {
      id: 'delete',
      label: 'Delete message',
      iconSvg: MENU_ICONS.delete,
      onClick: () => handlers.onDelete?.(),
    },
    {
      id: 'markUnread',
      label: 'Mark as unread',
      iconSvg: MENU_ICONS.markUnread,
      onClick: () => handlers.onMarkUnread?.(),
    },
    {
      id: 'star',
      label: 'Star message',
      iconSvg: MENU_ICONS.star,
      onClick: () => handlers.onStar?.(),
    },
    {
      id: 'sep2',
      label: '',
      isSeparator: true,
      onClick: () => {},
    },
    ...(senderName
      ? [
          {
            id: 'filter',
            label: `Filter messages like this`,
            iconSvg: MENU_ICONS.filter,
            onClick: () => handlers.onFilter?.(),
          },
        ]
      : []),
    {
      id: 'print',
      label: 'Print',
      iconSvg: MENU_ICONS.print,
      onClick: () => handlers.onPrint?.(),
    },
    {
      id: 'spam',
      label: 'Report spam',
      iconSvg: MENU_ICONS.spam,
      onClick: () => handlers.onSpam?.(),
    },
    {
      id: 'phishing',
      label: 'Report phishing',
      iconSvg: MENU_ICONS.phishing,
      onClick: () => handlers.onPhishing?.(),
    },
  ];
}

export class DropdownMenu {
  private menuEl: HTMLElement | null = null;
  private lastAnchor: HTMLElement | null = null;
  private cleanupFns: Array<() => void> = [];

  isOpen(): boolean {
    return this.menuEl !== null && this.menuEl.isConnected;
  }

  close(): void {
    if (this.menuEl) {
      this.menuEl.remove();
      this.menuEl = null;
    }
    this.lastAnchor = null;
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
  }

  toggle(anchorEl: HTMLElement, items: DropdownMenuItem[]): void {
    if (this.isOpen() && this.lastAnchor === anchorEl) {
      this.close();
      return;
    }
    this.open(anchorEl, items);
  }

  open(anchorEl: HTMLElement, items: DropdownMenuItem[]): void {
    this.close();

    const doc = anchorEl.ownerDocument;
    const win = doc.defaultView || window;

    const menu = doc.createElement('div');
    menu.className = 'undock-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Options');

    for (const item of items) {
      if (item.isSeparator) {
        const sep = doc.createElement('div');
        sep.className = 'undock-menu-separator';
        sep.setAttribute('role', 'separator');
        menu.appendChild(sep);
        continue;
      }

      const itemEl = doc.createElement('div');
      itemEl.className = 'undock-menu-item';
      itemEl.setAttribute('role', 'menuitem');
      itemEl.setAttribute('data-id', item.id);
      itemEl.tabIndex = -1;

      if (item.iconSvg) {
        const iconSpan = doc.createElement('span');
        iconSpan.className = 'undock-menu-icon';
        iconSpan.innerHTML = item.iconSvg;
        itemEl.appendChild(iconSpan);
      }

      const labelSpan = doc.createElement('span');
      labelSpan.className = 'undock-menu-label';
      labelSpan.textContent = item.label;
      itemEl.appendChild(labelSpan);

      itemEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.close();
        item.onClick();
      });

      menu.appendChild(itemEl);
    }

    doc.body.appendChild(menu);
    this.menuEl = menu;
    this.lastAnchor = anchorEl;

    // Calculate positioning
    const btnRect = anchorEl.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();

    let top = btnRect.bottom + 4;
    // If overflowing viewport bottom, position above the anchor button
    if (top + menuRect.height > win.innerHeight - 10) {
      top = Math.max(10, btnRect.top - menuRect.height - 4);
    }

    // Align right edge of menu to right edge of anchor button
    let right = win.innerWidth - btnRect.right;
    if (right < 8) right = 8;
    if (right + menuRect.width > win.innerWidth - 8) {
      right = Math.max(8, win.innerWidth - menuRect.width - 8);
    }

    menu.style.position = 'fixed';
    menu.style.top = `${top}px`;
    menu.style.right = `${right}px`;
    menu.style.zIndex = '1000000';

    // Click outside listener
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (menu && target && !menu.contains(target) && !anchorEl.contains(target)) {
        this.close();
      }
    };
    // Delay slightly to prevent the triggering click from immediately closing
    win.setTimeout(() => {
      doc.addEventListener('click', onDocClick, true);
    }, 10);
    this.cleanupFns.push(() => doc.removeEventListener('click', onDocClick, true));

    // Escape key listener
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    };
    doc.addEventListener('keydown', onKeyDown, true);
    this.cleanupFns.push(() => doc.removeEventListener('keydown', onKeyDown, true));

    // Dismiss on window resize or scroll
    const onDismiss = () => {
      this.close();
    };
    win.addEventListener('resize', onDismiss, { passive: true });
    win.addEventListener('scroll', onDismiss, { passive: true });
    this.cleanupFns.push(() => {
      win.removeEventListener('resize', onDismiss);
      win.removeEventListener('scroll', onDismiss);
    });
  }

  /**
   * Projects and synchronizes Gmail's native menu into the detached window.
   */
  projectNativeMenu(anchorEl: HTMLElement, nativeMenuEl: HTMLElement): void {
    this.close();

    const doc = anchorEl.ownerDocument;
    const win = doc.defaultView || window;

    // Deep clone the native Gmail menu
    const clone = nativeMenuEl.cloneNode(true) as HTMLElement;
    clone.classList.add('undock-projected-native-menu');
    clone.style.position = 'fixed';
    clone.style.zIndex = '1000000';
    clone.style.visibility = 'visible';
    clone.style.display = 'block';
    clone.style.opacity = '1';
    clone.style.pointerEvents = 'auto';

    // Map all interactive items between clone and nativeMenuEl
    const nativeItems = Array.from(nativeMenuEl.querySelectorAll<HTMLElement>('[role="menuitem"], .J-N'));
    const clonedItems = Array.from(clone.querySelectorAll<HTMLElement>('[role="menuitem"], .J-N'));

    clonedItems.forEach((clonedItem, idx) => {
      const nativeItem = nativeItems[idx];
      if (!nativeItem) return;

      // Hover feedback
      clonedItem.addEventListener('mouseenter', () => {
        nativeItem.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
        nativeItem.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
        clonedItem.classList.add('J-N-JT'); // Gmail active/highlight class
      });
      clonedItem.addEventListener('mouseleave', () => {
        nativeItem.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, cancelable: true }));
        nativeItem.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, cancelable: true }));
        clonedItem.classList.remove('J-N-JT');
      });

      // Click proxy to original Gmail menu item
      clonedItem.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.close();

        // Dispatch full sequence to native item in Gmail
        nativeItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        nativeItem.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        nativeItem.click();

        nativeMenuEl.style.display = 'none';
      });
    });

    doc.body.appendChild(clone);
    this.menuEl = clone;
    this.lastAnchor = anchorEl;

    // Position clone directly adjacent to anchorEl in child window
    const btnRect = anchorEl.getBoundingClientRect();
    const menuRect = clone.getBoundingClientRect();

    let top = btnRect.bottom + 4;
    if (top + menuRect.height > win.innerHeight - 10) {
      top = Math.max(10, btnRect.top - menuRect.height - 4);
    }

    let right = win.innerWidth - btnRect.right;
    if (right < 8) right = 8;
    if (right + menuRect.width > win.innerWidth - 8) {
      right = Math.max(8, win.innerWidth - menuRect.width - 8);
    }

    clone.style.top = `${top}px`;
    clone.style.right = `${right}px`;
    clone.style.left = 'auto';

    // Click outside listener
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (clone && target && !clone.contains(target) && !anchorEl.contains(target)) {
        this.close();
        nativeMenuEl.style.display = 'none';
      }
    };
    win.setTimeout(() => {
      doc.addEventListener('click', onDocClick, true);
    }, 10);
    this.cleanupFns.push(() => doc.removeEventListener('click', onDocClick, true));

    // Escape listener
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
        nativeMenuEl.style.display = 'none';
      }
    };
    doc.addEventListener('keydown', onKeyDown, true);
    this.cleanupFns.push(() => doc.removeEventListener('keydown', onKeyDown, true));

    // Dismiss on scroll or resize
    const onDismiss = () => {
      this.close();
      nativeMenuEl.style.display = 'none';
    };
    win.addEventListener('resize', onDismiss, { passive: true });
    win.addEventListener('scroll', onDismiss, { passive: true });
    this.cleanupFns.push(() => {
      win.removeEventListener('resize', onDismiss);
      win.removeEventListener('scroll', onDismiss);
    });
  }
}
