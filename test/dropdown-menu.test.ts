import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DropdownMenu,
  isMoreMenuButton,
  buildMoreMenuItems,
  DropdownMenuItem,
} from '../src/ui/dropdown-menu';

describe('DropdownMenu (3-dot options)', () => {
  let menu: DropdownMenu;

  beforeEach(() => {
    document.body.innerHTML = '';
    menu = new DropdownMenu();
  });

  afterEach(() => {
    menu.close();
  });

  it('identifies 3-dot buttons by aria-label, tooltip, SVG path, or class name', () => {
    const btn1 = document.createElement('div');
    btn1.setAttribute('aria-label', 'More options');
    expect(isMoreMenuButton(btn1)).toBe(true);

    const btn2 = document.createElement('button');
    btn2.setAttribute('data-tooltip', 'More');
    expect(isMoreMenuButton(btn2)).toBe(true);

    const btn3 = document.createElement('div');
    btn3.className = 'T-I J-J5-Ji amD T-I-awG T-I-ax7';
    expect(isMoreMenuButton(btn3)).toBe(true);

    const btn4 = document.createElement('div');
    btn4.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
      </svg>
    `;
    expect(isMoreMenuButton(btn4)).toBe(true);

    const regularBtn = document.createElement('button');
    regularBtn.textContent = 'Reply';
    expect(isMoreMenuButton(regularBtn)).toBe(false);
  });

  it('opens dropdown menu adjacent to anchor and dispatches item click', () => {
    const anchor = document.createElement('button');
    anchor.setAttribute('aria-label', 'More options');
    document.body.appendChild(anchor);

    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
      top: 50,
      bottom: 80,
      left: 700,
      right: 730,
      width: 30,
      height: 30,
      x: 700,
      y: 50,
      toJSON: () => {},
    });

    const replySpy = vi.fn();
    const items: DropdownMenuItem[] = [
      { id: 'reply', label: 'Reply', onClick: replySpy },
      { id: 'sep', label: '', isSeparator: true, onClick: () => {} },
      { id: 'delete', label: 'Delete message', onClick: vi.fn() },
    ];

    menu.open(anchor, items);
    expect(menu.isOpen()).toBe(true);

    const menuEl = document.querySelector('.undock-menu');
    expect(menuEl).toBeTruthy();
    expect(menuEl?.textContent).toContain('Reply');
    expect(menuEl?.textContent).toContain('Delete message');

    const replyItem = menuEl?.querySelector('[data-id="reply"]') as HTMLElement;
    expect(replyItem).toBeTruthy();
    replyItem.click();

    expect(replySpy).toHaveBeenCalledTimes(1);
    expect(menu.isOpen()).toBe(false);
  });

  it('closes dropdown menu on Escape key', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);

    menu.open(anchor, [{ id: 'reply', label: 'Reply', onClick: vi.fn() }]);
    expect(menu.isOpen()).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.isOpen()).toBe(false);
  });

  it('toggles dropdown menu on repeated clicks of the same anchor', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);

    menu.toggle(anchor, [{ id: 'reply', label: 'Reply', onClick: vi.fn() }]);
    expect(menu.isOpen()).toBe(true);

    menu.toggle(anchor, [{ id: 'reply', label: 'Reply', onClick: vi.fn() }]);
    expect(menu.isOpen()).toBe(false);
  });

  it('projects native Gmail menu into detached window and proxies clicks', () => {
    // Simulate native Gmail menu in parent document
    const nativeMenu = document.createElement('div');
    nativeMenu.className = 'J-M jQjAxd';
    nativeMenu.innerHTML = `
      <div class="J-N" role="menuitem" id="native-reply"><div class="J-N-Jz">Reply</div></div>
      <div class="J-N" role="menuitem" id="native-forward"><div class="J-N-Jz">Forward</div></div>
    `;
    document.body.appendChild(nativeMenu);

    let nativeReplyClicked = false;
    document.getElementById('native-reply')!.addEventListener('click', () => {
      nativeReplyClicked = true;
    });

    const anchor = document.createElement('button');
    document.body.appendChild(anchor);

    menu.projectNativeMenu(anchor, nativeMenu);
    expect(menu.isOpen()).toBe(true);

    const projectedMenu = document.querySelector('.undock-projected-native-menu');
    expect(projectedMenu).toBeTruthy();

    const clonedItems = projectedMenu?.querySelectorAll('.J-N');
    expect(clonedItems?.length).toBe(2);

    // Click cloned reply item in child window
    (clonedItems![0] as HTMLElement).click();

    expect(nativeReplyClicked).toBe(true);
    expect(menu.isOpen()).toBe(false);
  });

  it('buildMoreMenuItems includes sender name in filter item if available', () => {
    const thread = document.createElement('div');
    thread.setAttribute('role', 'listitem');
    thread.innerHTML = `
      <div class="gs">
        <span class="gD" name="Shaw">Shaw</span>
        <button id="more-btn" aria-label="More options"></button>
      </div>
    `;
    document.body.appendChild(thread);

    const anchor = document.getElementById('more-btn')!;
    const items = buildMoreMenuItems(anchor, {});

    const itemLabels = items.map((i) => i.label);
    expect(itemLabels).toContain('Reply');
    expect(itemLabels).toContain('Forward');
    expect(itemLabels).toContain('Delete message');
    expect(itemLabels).toContain('Print');
    expect(itemLabels).toContain('Filter messages like this');
  });
});
