import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncObserver, findPopoutButton, findDraftPopoutReplyButton } from '../src/core/sync-observer';

describe('SyncObserver (FR-06, FR-07, Memory Management)', () => {
  let observer: SyncObserver;
  let sourceEl: HTMLElement;
  let targetContainer: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="source-detail">
        <h2 id="thread-subject">Important Message</h2>
        <div class="thread-body">
          <p>Hello world</p>
          <input id="quick-reply-input" value="Thanks!" />
          <button id="reply-button" aria-label="Reply">Reply</button>
        </div>
      </div>
      <div id="target-window-root"></div>
    `;

    sourceEl = document.getElementById('source-detail')!;
    targetContainer = document.getElementById('target-window-root')!;
    observer = new SyncObserver();
  });

  afterEach(() => {
    observer.disconnect();
  });

  it('performs synchronous deep clone under 50ms (FR-06)', () => {
    const startTime = performance.now();
    observer.startSync(sourceEl, targetContainer);
    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(50);
    expect(targetContainer.querySelector('#thread-subject')?.textContent).toBe('Important Message');
    expect(targetContainer.querySelector('#reply-button')).not.toBeNull();
  });

  it('proxies clicks from cloned elements back to source elements (FR-07)', () => {
    const sourceBtn = document.getElementById('reply-button')!;
    let sourceClicked = false;
    sourceBtn.addEventListener('click', () => {
      sourceClicked = true;
    });

    observer.startSync(sourceEl, targetContainer);

    const clonedBtn = targetContainer.querySelector('#reply-button') as HTMLElement;
    expect(clonedBtn).not.toBeNull();

    clonedBtn.click();
    expect(sourceClicked).toBe(true);
  });

  it('proxies input field changes from cloned inputs to source elements', () => {
    const sourceInput = document.getElementById('quick-reply-input') as HTMLInputElement;
    let inputFired = false;
    sourceInput.addEventListener('input', () => {
      inputFired = true;
    });

    observer.startSync(sourceEl, targetContainer);

    const clonedInput = targetContainer.querySelector('#quick-reply-input') as HTMLInputElement;
    clonedInput.value = 'Updated text in detached window';
    clonedInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(sourceInput.value).toBe('Updated text in detached window');
    expect(inputFired).toBe(true);
  });

  it('cleans up and clears DOM references on disconnect to prevent memory leaks', () => {
    observer.startSync(sourceEl, targetContainer);
    expect(targetContainer.children.length).toBe(1);

    observer.disconnect();
    expect(targetContainer.children.length).toBe(0);
  });

  it('opens dropdown menu immediately on first click of 3-dot button', () => {
    const moreBtn = document.createElement('button');
    moreBtn.id = 'more-btn';
    moreBtn.setAttribute('aria-label', 'More options');
    moreBtn.textContent = '⋮';
    sourceEl.appendChild(moreBtn);

    observer.startSync(sourceEl, targetContainer);

    const clonedMoreBtn = targetContainer.querySelector('#more-btn') as HTMLElement;
    expect(clonedMoreBtn).not.toBeNull();

    // Click once
    clonedMoreBtn.click();

    // Dropdown menu must be opened immediately on 1st click
    const menu = document.querySelector('.undock-menu');
    expect(menu).not.toBeNull();
    expect(menu?.textContent).toContain('Reply');
    expect(menu?.textContent).toContain('Forward');
    expect(menu?.textContent).toContain('Delete message');
    expect(menu?.textContent).toContain('Mark as unread');
  });

  it('proxies clicks on dynamic Gemini AI "✦ Summarize this email" buttons without IDs', () => {
    const aiBtn = document.createElement('div');
    aiBtn.setAttribute('role', 'button');
    aiBtn.setAttribute('jsaction', 'click:ai_summary');
    aiBtn.innerHTML = '<span class="sparkle">✦</span><span class="label">Summarize this email</span>';
    sourceEl.appendChild(aiBtn);

    let aiClicked = false;
    aiBtn.addEventListener('click', () => {
      aiClicked = true;
    });

    observer.startSync(sourceEl, targetContainer);

    const clonedLabel = targetContainer.querySelector('.label') as HTMLElement;
    expect(clonedLabel).not.toBeNull();

    // Click nested label inside cloned Gemini chip
    clonedLabel.click();

    expect(aiClicked).toBe(true);
  });

  it('proxies clicks on dynamic action chips without IDs using text matching', () => {
    const chip = document.createElement('button');
    chip.className = 'T-I action-chip';
    chip.textContent = 'Track package';
    sourceEl.appendChild(chip);

    let chipClicked = false;
    chip.addEventListener('click', () => {
      chipClicked = true;
    });

    observer.startSync(sourceEl, targetContainer);

    const clonedChip = targetContainer.querySelector('.action-chip') as HTMLElement;
    expect(clonedChip).not.toBeNull();

    clonedChip.click();
    expect(chipClicked).toBe(true);
  });

  it('correctly maps anonymous deeply nested elements via fixed structural path traversal', () => {
    const container = document.createElement('div');
    const child = document.createElement('div');
    const grandchild = document.createElement('div');
    const targetSpan = document.createElement('span');
    targetSpan.textContent = 'Anonymous Deep Span';

    grandchild.appendChild(targetSpan);
    child.appendChild(grandchild);
    container.appendChild(child);
    sourceEl.appendChild(container);

    observer.startSync(sourceEl, targetContainer);

    const cloneRoot = targetContainer.firstElementChild as HTMLElement;
    expect(cloneRoot).not.toBeNull();

    // Find the cloned target span
    const clonedSpan = Array.from(cloneRoot.querySelectorAll('span')).find(
      (s) => s.textContent === 'Anonymous Deep Span'
    ) as HTMLElement;
    expect(clonedSpan).not.toBeNull();

    const matchedSource = observer.findMatchingSourceElement(clonedSpan);
    expect(matchedSource).toBe(targetSpan);
  });

  it('opens anchor links in primary browser window', () => {
    let openedUrl = '';
    const originalOpen = window.open;
    window.open = ((url: string) => {
      openedUrl = url;
      return null;
    }) as any;

    try {
      const link = document.createElement('a');
      link.href = 'https://www.linkedin.com/comm/messaging/thread/12345';
      link.target = '_blank';
      link.textContent = 'View message';
      sourceEl.appendChild(link);

      observer.startSync(sourceEl, targetContainer);

      const clonedLink = targetContainer.querySelector('a') as HTMLElement;
      expect(clonedLink).not.toBeNull();

      clonedLink.click();
      expect(openedUrl).toBe('https://www.linkedin.com/comm/messaging/thread/12345');
    } finally {
      window.open = originalOpen;
    }
  });

  it('syncs checkbox state changes between cloned and source inputs', () => {
    const checkInput = document.createElement('input');
    checkInput.type = 'checkbox';
    checkInput.id = 'newsletter-check';
    checkInput.checked = false;
    sourceEl.appendChild(checkInput);

    observer.startSync(sourceEl, targetContainer);

    const clonedCheck = targetContainer.querySelector('#newsletter-check') as HTMLInputElement;
    expect(clonedCheck).not.toBeNull();

    clonedCheck.checked = true;
    clonedCheck.dispatchEvent(new Event('input', { bubbles: true }));

    expect(checkInput.checked).toBe(true);
  });

  it('triggers pop-out button in parent window when clicking inside inline draft', () => {
    const draftContainer = document.createElement('div');
    draftContainer.className = 'M9 aoP';
    draftContainer.setAttribute('role', 'region');
    draftContainer.setAttribute('aria-label', 'Draft');

    const popoutBtn = document.createElement('span');
    popoutBtn.className = 'ams bkH';
    popoutBtn.setAttribute('role', 'button');
    popoutBtn.setAttribute('data-tooltip', 'Pop-out reply');
    draftContainer.appendChild(popoutBtn);

    const textbox = document.createElement('div');
    textbox.setAttribute('role', 'textbox');
    textbox.setAttribute('contenteditable', 'true');
    textbox.setAttribute('aria-label', 'Message Body');
    draftContainer.appendChild(textbox);

    sourceEl.appendChild(draftContainer);

    let popoutClicked = false;
    popoutBtn.addEventListener('click', () => {
      popoutClicked = true;
    });

    const focusSpy = vi.spyOn(window, 'focus').mockImplementation(() => {});

    observer.startSync(sourceEl, targetContainer);

    const clonedTextbox = targetContainer.querySelector('[role="textbox"]') as HTMLElement;
    expect(clonedTextbox).not.toBeNull();

    // Click inside the cloned draft textbox
    clonedTextbox.click();

    expect(popoutClicked).toBe(true);
    expect(focusSpy).toHaveBeenCalled();

    focusSpy.mockRestore();
  });

  it('does not preventDefault on editable inputs allowing native cursor focus', () => {
    const input = document.createElement('input');
    input.id = 'comment-input';
    sourceEl.appendChild(input);

    observer.startSync(sourceEl, targetContainer);

    const clonedInput = targetContainer.querySelector('#comment-input') as HTMLInputElement;
    expect(clonedInput).not.toBeNull();

    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    clonedInput.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(false);
  });

  it('syncs contenteditable innerHTML changes from cloned target back to source', () => {
    const richEditor = document.createElement('div');
    richEditor.id = 'rich-editor';
    richEditor.setAttribute('contenteditable', 'true');
    richEditor.innerHTML = '<p>Initial text</p>';
    sourceEl.appendChild(richEditor);

    observer.startSync(sourceEl, targetContainer);

    const clonedEditor = targetContainer.querySelector('#rich-editor') as HTMLElement;
    expect(clonedEditor).not.toBeNull();

    clonedEditor.innerHTML = '<p>Edited text in detached window</p>';
    clonedEditor.dispatchEvent(new Event('input', { bubbles: true }));

    expect(richEditor.innerHTML).toBe('<p>Edited text in detached window</p>');
  });

  it('findPopoutButton correctly identifies various Gmail popout button selectors', () => {
    const container = document.createElement('div');
    const popout = document.createElement('span');
    popout.setAttribute('data-tooltip', 'Pop-out reply');
    container.appendChild(popout);

    expect(findPopoutButton(container)).toBe(popout);
  });

  it('findDraftPopoutReplyButton ignores thread header "In new window" buttons', () => {
    const header = document.createElement('div');
    header.className = 'thread-header';
    const newWindowBtn = document.createElement('div');
    newWindowBtn.setAttribute('role', 'button');
    newWindowBtn.setAttribute('data-tooltip', 'In new window');
    newWindowBtn.setAttribute('aria-label', 'In new window');
    header.appendChild(newWindowBtn);

    expect(findDraftPopoutReplyButton(header)).toBeNull();
  });
});
