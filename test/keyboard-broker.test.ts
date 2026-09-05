import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeyboardBroker } from '../src/core/keyboard-broker';

describe('KeyboardBroker (FR-04)', () => {
  let broker: KeyboardBroker;
  let testWindow: Window;

  beforeEach(() => {
    testWindow = window;
    broker = new KeyboardBroker();
  });

  afterEach(() => {
    broker.detach();
  });

  it('identifies input collision when focus is in input or textarea', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const div = document.createElement('div');
    const editableDiv = document.createElement('div');
    editableDiv.setAttribute('contenteditable', 'true');

    expect(broker.isInputCollision(input)).toBe(true);
    expect(broker.isInputCollision(textarea)).toBe(true);
    expect(broker.isInputCollision(editableDiv)).toBe(true);
    expect(broker.isInputCollision(div)).toBe(false);

    // Nested element inside contenteditable container
    const nestedSpan = document.createElement('span');
    editableDiv.appendChild(nestedSpan);
    expect(broker.isInputCollision(nestedSpan)).toBe(true);

    // Nested element inside Gmail draft container (.M9, .aoP, [role="textbox"])
    const draftContainer = document.createElement('div');
    draftContainer.className = 'M9 aoP';
    const textbox = document.createElement('div');
    textbox.setAttribute('role', 'textbox');
    const childP = document.createElement('p');
    textbox.appendChild(childP);
    draftContainer.appendChild(textbox);
    expect(broker.isInputCollision(childP)).toBe(true);
  });

  it('routes single-stroke triage keys without modifier keys', () => {
    const actionSpy = vi.fn();
    broker = new KeyboardBroker({
      onTriageAction: actionSpy,
    });
    broker.attach(testWindow);

    // Press 'j' (next message) on detached body
    const eventJ = new KeyboardEvent('keydown', {
      key: 'j',
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(eventJ);

    expect(actionSpy).toHaveBeenCalledWith('j', expect.any(KeyboardEvent));
    expect(eventJ.defaultPrevented).toBe(true);
  });

  it('does NOT intercept triage keys when inside an active input element', () => {
    const actionSpy = vi.fn();
    broker = new KeyboardBroker({
      onTriageAction: actionSpy,
    });
    broker.attach(testWindow);

    const input = document.createElement('input');
    document.body.appendChild(input);

    const eventJ = new KeyboardEvent('keydown', {
      key: 'j',
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(eventJ);

    expect(actionSpy).not.toHaveBeenCalled();
    expect(eventJ.defaultPrevented).toBe(false);
  });

  it('routes Escape key even when inside an input', () => {
    const escapeSpy = vi.fn();
    broker = new KeyboardBroker({
      onEscape: escapeSpy,
    });
    broker.attach(testWindow);

    const input = document.createElement('input');
    document.body.appendChild(input);

    const eventEsc = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(eventEsc);

    expect(escapeSpy).toHaveBeenCalled();
  });

  it('directly navigates sequentially across all rows with j and k', () => {
    document.body.innerHTML = `
      <table role="grid">
        <tbody>
          <tr role="row" id="row-0" class="aqw"><td><span class="bog">Thread 0</span></td></tr>
          <tr role="row" id="row-1"><td><span class="bog">Thread 1</span></td></tr>
          <tr role="row" id="row-2"><td><span class="bog">Thread 2</span></td></tr>
          <tr role="row" id="row-3"><td><span class="bog">Thread 3</span></td></tr>
          <tr role="row" id="row-4"><td><span class="bog">Thread 4</span></td></tr>
        </tbody>
      </table>
    `;

    const clickedRowIds: string[] = [];
    for (let i = 0; i <= 4; i++) {
      const row = document.getElementById(`row-${i}`)!;
      row.addEventListener('click', () => {
        clickedRowIds.push(`row-${i}`);
      });
    }

    // Row 0 is initially active.
    // Press j: should navigate to row 1
    broker.navigateThread(1);
    expect(clickedRowIds[clickedRowIds.length - 1]).toBe('row-1');

    // Press j again: should navigate to row 2
    broker.navigateThread(1);
    expect(clickedRowIds[clickedRowIds.length - 1]).toBe('row-2');

    // Press j again: should navigate to row 3
    broker.navigateThread(1);
    expect(clickedRowIds[clickedRowIds.length - 1]).toBe('row-3');

    // Press j again: should navigate to row 4
    broker.navigateThread(1);
    expect(clickedRowIds[clickedRowIds.length - 1]).toBe('row-4');

    // Press j again at boundary: should stay at row 4
    broker.navigateThread(1);
    expect(clickedRowIds[clickedRowIds.length - 1]).toBe('row-4');

    // Press k: should navigate back to row 3
    broker.navigateThread(-1);
    expect(clickedRowIds[clickedRowIds.length - 1]).toBe('row-3');

    // Press k: should navigate back to row 2
    broker.navigateThread(-1);
    expect(clickedRowIds[clickedRowIds.length - 1]).toBe('row-2');
  });

  it('syncs active index when user manually clicks a row in Gmail', () => {
    document.body.innerHTML = `
      <table role="grid">
        <tbody>
          <tr role="row" id="row-0"><td><span>Thread 0</span></td></tr>
          <tr role="row" id="row-1"><td><span>Thread 1</span></td></tr>
          <tr role="row" id="row-2"><td><span>Thread 2</span></td></tr>
          <tr role="row" id="row-3"><td><span>Thread 3</span></td></tr>
        </tbody>
      </table>
    `;

    const clickedRowIds: string[] = [];
    for (let i = 0; i <= 3; i++) {
      document.getElementById(`row-${i}`)!.addEventListener('click', () => {
        clickedRowIds.push(`row-${i}`);
      });
    }

    // Simulate user clicking row 2 with mouse
    const row2 = document.getElementById('row-2')!;
    row2.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    // Now press j via broker: should advance from row 2 to row 3!
    broker.navigateThread(1);
    expect(clickedRowIds[clickedRowIds.length - 1]).toBe('row-3');
  });

  it('triggers programmatic key via triggerKey', () => {
    document.body.innerHTML = `
      <table role="grid">
        <tbody>
          <tr role="row" id="row-0" class="aqw"><td><span>Thread 0</span></td></tr>
          <tr role="row" id="row-1"><td><span>Thread 1</span></td></tr>
        </tbody>
      </table>
    `;

    let clicked = '';
    document.getElementById('row-1')!.addEventListener('click', () => {
      clicked = 'row-1';
    });

    broker.triggerKey('j');
    expect(clicked).toBe('row-1');
  });

  it('triggers toolbar actions directly for archive and delete', () => {
    document.body.innerHTML = `
      <div>
        <button aria-label="Archive" id="btn-archive"></button>
        <button data-tooltip="Delete" id="btn-delete"></button>
      </div>
    `;

    let action = '';
    document.getElementById('btn-archive')!.addEventListener('click', () => {
      action = 'archive';
    });
    document.getElementById('btn-delete')!.addEventListener('click', () => {
      action = 'delete';
    });

    expect(broker.triggerToolbarAction('archive')).toBe(true);
    expect(action).toBe('archive');

    expect(broker.triggerToolbarAction('delete')).toBe(true);
    expect(action).toBe('delete');
  });

  it('calls onToggleTheme when t is pressed', () => {
    const themeSpy = vi.fn();
    broker = new KeyboardBroker({
      onToggleTheme: themeSpy,
    });
    broker.attach(testWindow);

    const eventT = new KeyboardEvent('keydown', {
      key: 't',
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(eventT);

    expect(themeSpy).toHaveBeenCalled();
  });

  it('verifies that pressing t does NOT trigger onReply or click any reply buttons', () => {
    const themeSpy = vi.fn();
    const replySpy = vi.fn();
    broker = new KeyboardBroker({
      onToggleTheme: themeSpy,
      onReply: replySpy,
    });
    broker.attach(testWindow);

    document.body.innerHTML = `
      <div role="main">
        <button aria-label="Reply" id="btn-reply"></button>
      </div>
    `;

    let replyClicked = false;
    document.getElementById('btn-reply')!.addEventListener('click', () => {
      replyClicked = true;
    });

    const eventT = new KeyboardEvent('keydown', {
      key: 't',
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(eventT);

    expect(themeSpy).toHaveBeenCalledTimes(1);
    expect(replySpy).not.toHaveBeenCalled();
    expect(replyClicked).toBe(false);
  });

  it('triggers onReply callback when r is pressed or toolbar reply action is triggered', () => {
    const replySpy = vi.fn();
    broker = new KeyboardBroker({
      onReply: replySpy,
    });
    broker.attach(testWindow);

    document.body.innerHTML = `
      <div role="main">
        <button aria-label="Reply" id="btn-reply"></button>
      </div>
    `;

    let replyClicked = false;
    document.getElementById('btn-reply')!.addEventListener('click', () => {
      replyClicked = true;
    });

    // 1. Test via keydown 'r'
    const eventR = new KeyboardEvent('keydown', {
      key: 'r',
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(eventR);

    expect(replySpy).toHaveBeenCalledTimes(1);
    expect(replyClicked).toBe(true);

    // 2. Test via direct triggerToolbarAction('reply')
    replyClicked = false;
    const result = broker.triggerToolbarAction('reply');
    expect(result).toBe(true);
    expect(replyClicked).toBe(true);
    expect(replySpy).toHaveBeenCalledTimes(2);
  });

  it('triggers reply click cleanly without extra keyboard routing or shiftKey', () => {
    document.body.innerHTML = `
      <div role="main">
        <button aria-label="Reply" id="btn-reply"></button>
      </div>
    `;

    let clickEventShiftKey: boolean | undefined;
    document.getElementById('btn-reply')!.addEventListener('click', (e: MouseEvent) => {
      clickEventShiftKey = e.shiftKey;
    });

    let routedKey: string | null = null;
    const keyListener = (e: Event) => {
      const ke = e as KeyboardEvent;
      routedKey = ke.key;
    };
    document.addEventListener('keydown', keyListener);

    broker.triggerToolbarAction('reply');

    expect(clickEventShiftKey).toBe(false);
    // Verified: No unintended key events (like Shift+O) are sent to parent document
    expect(routedKey).toBeNull();

    document.removeEventListener('keydown', keyListener);
  });
});

