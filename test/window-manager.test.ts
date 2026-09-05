import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WindowManager } from '../src/core/window-manager';

describe('WindowManager (FR-02)', () => {
  let manager: WindowManager;
  let mockChildWindow: any;

  beforeEach(() => {
    mockChildWindow = {
      closed: false,
      focus: vi.fn(),
      close: vi.fn(function () {
        mockChildWindow.closed = true;
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
        getElementById: vi.fn(() => document.createElement('div')),
        querySelectorAll: vi.fn((_sel: string) => []),
      },
    };

    vi.spyOn(window, 'open').mockImplementation(() => mockChildWindow);

    manager = new WindowManager({
      siteName: 'gmail',
      defaultWidth: 960,
      defaultHeight: 800,
    });
  });

  afterEach(() => {
    manager.close();
    vi.restoreAllMocks();
  });

  it('opens detached child window with calculated coordinates', async () => {
    const win = await manager.open();
    expect(win).toBe(mockChildWindow);
    expect(window.open).toHaveBeenCalledWith(
      'about:blank',
      'Undock_gmail',
      expect.stringContaining('width=960')
    );
    expect(manager.isOpen).toBe(true);
  });

  it('persists and restores custom coordinates via storage', async () => {
    const coords = { left: 150, top: 100, width: 1200, height: 900 };
    await manager.saveCoordinates(coords);

    const retrieved = await manager.getStoredCoordinates();
    expect(retrieved).toEqual(coords);
  });

  it('notifies close callback when child window is closed', async () => {
    const closeSpy = vi.fn();
    manager.onClose(closeSpy);

    await manager.open();
    manager.close();

    expect(mockChildWindow.close).toHaveBeenCalled();
  });

  it('renders standby screen with instructions and mode alerts', async () => {
    const rootEl = document.createElement('div');
    rootEl.id = 'undock-root';
    mockChildWindow.document.getElementById = vi.fn(() => rootEl);

    await manager.open();

    manager.renderStandbyScreen({ isSplitModeActive: false });
    expect(rootEl.innerHTML).toContain('Reading Pane Ready');
    expect(rootEl.innerHTML).toContain('Gmail Reading Pane is not detected');

    manager.renderStandbyScreen({ isSplitModeActive: true });
    expect(rootEl.innerHTML).toContain('Reading Pane Ready');
    expect(rootEl.innerHTML).not.toContain('Gmail Reading Pane is not detected');
  });

  it('toggles theme side drawer', async () => {
    const drawerEl = document.createElement('aside');
    drawerEl.id = 'undock-theme-drawer';
    mockChildWindow.document.getElementById = vi.fn((id: string) => {
      if (id === 'undock-theme-drawer') return drawerEl;
      return null;
    });

    await manager.open();

    manager.toggleThemeDrawer();
    expect(drawerEl.classList.contains('undock-drawer-open')).toBe(true);

    manager.toggleThemeDrawer();
    expect(drawerEl.classList.contains('undock-drawer-open')).toBe(false);
  });

  it('initializes child document with high contrast theme and full width by default', async () => {
    let writtenHtml = '';
    mockChildWindow.document.write = vi.fn((html: string) => {
      writtenHtml = html;
    });

    await manager.open();

    expect(writtenHtml).toContain('theme-contrast');
    expect(writtenHtml).toContain('width-full');
    expect(writtenHtml).toContain('body.font-large #undock-root');
    expect(writtenHtml).toContain('body.font-xl #undock-root');
    expect(writtenHtml).toContain('body.theme-contrast #undock-root');
    expect(writtenHtml).toContain('.undock-cloned-detail .M9');
    expect(writtenHtml).not.toContain('div:has(> div[role="textbox"])');
    expect(writtenHtml).not.toContain('border-top: 2px solid #1a73e8');
  });

  it('scrollToDraft scrolls to draft composer when present', async () => {
    const rootEl = document.createElement('div');
    rootEl.id = 'undock-root';
    const draftEl = document.createElement('div');
    draftEl.setAttribute('role', 'region');
    draftEl.setAttribute('aria-label', 'Draft');
    draftEl.scrollIntoView = vi.fn();
    rootEl.appendChild(draftEl);

    mockChildWindow.document.getElementById = vi.fn((id: string) => {
      if (id === 'undock-root') return rootEl;
      return null;
    });

    await manager.open();
    rootEl.appendChild(draftEl);
    manager.scrollToDraft();

    expect(draftEl.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth', block: 'end' })
    );
  });

  it('scrollToDraft falls back to root scrollHeight when draft element is not yet found', async () => {
    const rootEl = document.createElement('div');
    rootEl.id = 'undock-root';
    rootEl.scrollTo = vi.fn();
    Object.defineProperty(rootEl, 'scrollHeight', { value: 1450, configurable: true });

    mockChildWindow.document.getElementById = vi.fn((id: string) => {
      if (id === 'undock-root') return rootEl;
      return null;
    });

    await manager.open();
    manager.scrollToDraft();

    expect(rootEl.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ top: 1450, behavior: 'smooth' })
    );
  });
});
