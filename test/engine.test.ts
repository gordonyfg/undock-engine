import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UndockEngine } from '../src/core/engine';

describe('UndockEngine (FR-01, FR-02)', () => {
  let engine: UndockEngine;
  let mockChildWindow: any;

  beforeEach(() => {
    document.body.innerHTML = `
      <div role="main">
        <table role="grid">
          <tbody><tr><td>Thread</td></tr></tbody>
        </table>
        <div class="reading-pane" data-thread-perm-id="thread-test">
          <h2>Subject Title</h2>
          <button aria-label="Archive">Archive</button>
        </div>
      </div>
    `;

    const rootContainer = document.createElement('div');
    rootContainer.id = 'undock-root';

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
        head: document.createElement('head'),
        body: document.createElement('body'),
        getElementById: vi.fn((id: string) => {
          if (id === 'undock-root') return rootContainer;
          return null;
        }),
        createElement: (tag: string) => document.createElement(tag),
        querySelectorAll: (sel: string) => document.querySelectorAll(sel),
      },
    };

    vi.spyOn(window, 'open').mockImplementation(() => mockChildWindow);

    engine = new UndockEngine();
  });

  afterEach(async () => {
    await engine.dock();
    vi.restoreAllMocks();
  });

  it('initializes on mail.google.com and loads GmailAdapter (FR-01)', async () => {
    const initialized = await engine.init('mail.google.com');
    expect(initialized).toBe(true);
    expect(engine.activeAdapter?.name).toBe('gmail');
  });

  it('fails initialization on unsupported hosts', async () => {
    const initialized = await engine.init('example.com');
    expect(initialized).toBe(false);
    expect(engine.activeAdapter).toBeNull();
  });

  it('executes full undock sequence and sets isUndocked to true', async () => {
    await engine.init('mail.google.com');
    const success = await engine.undock();

    expect(success).toBe(true);
    expect(engine.isUndocked).toBe(true);

    const detailEl = document.querySelector('.reading-pane') as HTMLElement;
    expect(detailEl.getAttribute('data-undock-suppressed')).toBe('true');
  });

  it('re-docks cleanly, restoring parent DOM and closing secondary window', async () => {
    await engine.init('mail.google.com');
    await engine.undock();

    await engine.dock();
    expect(engine.isUndocked).toBe(false);

    const detailEl = document.querySelector('.reading-pane') as HTMLElement;
    expect(detailEl.getAttribute('data-undock-suppressed')).toBeNull();
    expect(mockChildWindow.close).toHaveBeenCalled();
  });

  it('toggles undocked and docked states', async () => {
    await engine.init('mail.google.com');

    await engine.toggle();
    expect(engine.isUndocked).toBe(true);

    await engine.toggle();
    expect(engine.isUndocked).toBe(false);
  });

  it('opens secondary window in standby mode when no email is selected in split mode', async () => {
    // Split mode without an email selected: list table + split separator
    document.body.innerHTML = `
      <div role="main">
        <div role="separator"></div>
        <table role="grid">
          <tbody><tr><td>Thread 1</td></tr></tbody>
        </table>
      </div>
    `;

    await engine.init('mail.google.com');
    const success = await engine.undock();

    expect(success).toBe(true);
    expect(engine.isUndocked).toBe(true);
    expect(window.open).toHaveBeenCalled();
  });

  it('reactively syncs when an email is selected after undocking in split mode', async () => {
    // Start with split mode active but no email selected yet
    document.body.innerHTML = `
      <div role="main">
        <div role="separator"></div>
        <table role="grid">
          <tbody><tr><td>Thread 1</td></tr></tbody>
        </table>
      </div>
    `;

    await engine.init('mail.google.com');
    await engine.undock();

    // User clicks an email in the inbox list: thread appears in DOM
    const main = document.querySelector('[role="main"]')!;
    const threadDiv = document.createElement('div');
    threadDiv.className = 'reading-pane';
    threadDiv.setAttribute('data-thread-perm-id', 'new-thread');
    threadDiv.innerHTML = `<h2>New Email Subject</h2>`;
    main.appendChild(threadDiv);

    // Wait for mutation observer
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(threadDiv.getAttribute('data-undock-suppressed')).toBe('true');
  });

  it('only permits undocking when Gmail split reading pane is active', async () => {
    // 1. In no-split mode: table[role="grid"] only, no split pane or separator
    document.body.innerHTML = `
      <div role="main">
        <table role="grid">
          <tbody><tr><td>Thread 1</td></tr></tbody>
        </table>
      </div>
    `;

    await engine.init('mail.google.com');
    expect(engine.isSplitMode).toBe(false);

    const success = await engine.undock();
    // Undock is rejected in no-split mode per user preference
    expect(success).toBe(false);
    expect(engine.isUndocked).toBe(false);
    expect(window.open).not.toHaveBeenCalled();

    // 2. Now activate split mode in DOM (split wrapper with reading pane and list)
    document.body.innerHTML = `
      <div role="main">
        <div role="separator"></div>
        <table role="grid">
          <tbody><tr><td>Thread 1</td></tr></tbody>
        </table>
        <div class="reading-pane" data-thread-perm-id="split-thread">
          <h2>Split Thread Subject</h2>
        </div>
      </div>
    `;
    expect(engine.isSplitMode).toBe(true);

    const splitSuccess = await engine.undock();
    expect(splitSuccess).toBe(true);
    expect(engine.isUndocked).toBe(true);
    expect(window.open).toHaveBeenCalled();
  });
});

