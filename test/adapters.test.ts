import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateSiteAdapter,
  validateDeclarativeConfig,
  createAdapterFromConfig,
} from '../src/adapters/base';
import { AdapterRegistry } from '../src/adapters';
import { GmailAdapter } from '../src/adapters/gmail';

describe('SiteAdapter and Config Validator (FR-01, FR-08)', () => {
  it('validates a correct SiteAdapter object', () => {
    const validAdapter = new GmailAdapter();
    const result = validateSiteAdapter(validAdapter);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects an invalid adapter object with missing selectors', () => {
    const invalidAdapter = {
      name: 'broken',
      domainPattern: /broken\.com/,
      selectors: {
        listContainer: '', // Empty
        detailContainer: '',
      },
      suppressDetailPane: () => {},
      restoreDetailPane: () => {},
    };
    const result = validateSiteAdapter(invalidAdapter);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('validates declarative JSON configuration', () => {
    const config = {
      name: 'github',
      domainPattern: '^github\\.com$',
      selectors: {
        listContainer: '.pr-list',
        detailContainer: '.diff-view',
        actionButtons: {
          merge: '[data-action="merge"]',
        },
      },
      suppression: {
        offscreenWidth: '1000px',
      },
    };

    const result = validateDeclarativeConfig(config);
    expect(result.valid).toBe(true);

    const adapter = createAdapterFromConfig(config);
    expect(adapter.name).toBe('github');
    expect(adapter.domainPattern.test('github.com')).toBe(true);
    expect(adapter.domainPattern.test('gitlab.com')).toBe(false);
  });

  it('detects hostname and loads matching adapter via AdapterRegistry', () => {
    const registry = new AdapterRegistry();
    const gmailAdapter = registry.findAdapterForHost('mail.google.com');
    expect(gmailAdapter).not.toBeNull();
    expect(gmailAdapter?.name).toBe('gmail');

    const unknown = registry.findAdapterForHost('random-domain.com');
    expect(unknown).toBeNull();
  });
});

describe('GmailAdapter (FR-05, FR-07)', () => {
  let adapter: GmailAdapter;
  let detailEl: HTMLElement;
  let listEl: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <div role="main">
        <div class="list-wrapper">
          <table role="grid">
            <tbody><tr role="row"><td class="yX xY">Sender</td><td class="xY a4W">Thread 1</td><td class="xW">Sep 5</td><td class="bq4 xY"><ul role="toolbar"><li></li></ul></td></tr></tbody>
          </table>
        </div>
        <div class="reading-pane" data-thread-perm-id="thread-123">
          <h2>Thread Subject</h2>
          <div class="actions">
            <button aria-label="Archive">Archive</button>
            <button aria-label="Delete">Delete</button>
          </div>
        </div>
      </div>
    `;

    adapter = new GmailAdapter();
    adapter.onInit({} as any);

    detailEl = document.querySelector('.reading-pane') as HTMLElement;
    listEl = document.querySelector('.list-wrapper') as HTMLElement;
  });

  it('suppresses detail pane offscreen while keeping dimensions for virtual scrolling (FR-05)', () => {
    adapter.suppressDetailPane(detailEl);

    expect(detailEl.classList.contains('undock-suppressed-detail')).toBe(true);
    expect(detailEl.getAttribute('data-undock-suppressed')).toBe('true');
    expect(detailEl.style.position).toBe('absolute');
    expect(detailEl.style.left).toBe('-9999px');
    expect(detailEl.style.width).toBe('900px');
    expect(detailEl.style.opacity).toBe('0');
    expect(detailEl.style.pointerEvents).toBe('auto');

    // List container expanded
    expect(listEl.classList.contains('undock-expanded-list')).toBe(true);
    expect(listEl.style.width).toBe('100%');
    expect(listEl.style.overflowX).toBe('hidden');
  });

  it('keeps the expanded Gmail grid bounded and its quick-action cell visible', () => {
    adapter.suppressDetailPane(detailEl);
    document.body.classList.add('undock-engine-active');

    const injectedCss = document.getElementById('undock-gmail-styles')?.textContent || '';
    const grid = document.querySelector<HTMLElement>('table[role="grid"]')!;
    const senderCell = document.querySelector<HTMLElement>('td.yX')!;
    const actionCell = document.querySelector<HTMLElement>('td.xW')!;
    const quickActionCell = document.querySelector<HTMLElement>('td.bq4')!;

    expect(injectedCss).not.toContain('[role="main"] div:has(table[role="grid"])');
    // Compose is also a role=region with aria-label="New Message". Keep the
    // suppression selector scoped to the reading pane so Compose stays usable.
    expect(injectedCss).not.toContain('[role="region"][aria-label*="Message" i]');
    expect(injectedCss).toContain('[role="region"][aria-label*="reading" i]');
    expect(injectedCss).toContain('display: table-row-group !important');
    expect(injectedCss).toContain('height: 20px !important');
    expect(injectedCss).toContain('display: flex !important');
    expect(injectedCss).toContain('.Nr:has(> .Nu.tf .undock-expanded-list) > .Nt + .Nu');
    expect(getComputedStyle(grid).display).toBe('block');
    expect(getComputedStyle(grid).tableLayout).toBe('fixed');
    expect(getComputedStyle(senderCell).width).toBe('212px');
    expect(getComputedStyle(actionCell).position).toBe('sticky');
    expect(getComputedStyle(actionCell).right).toBe('0px');
    expect(getComputedStyle(actionCell).width).toBe('72px');
    expect(getComputedStyle(quickActionCell).display).toBe('flex');
    expect(getComputedStyle(quickActionCell).position).toBe('sticky');
    expect(getComputedStyle(quickActionCell).width).toBe('152px');
    // Primary and category tabs can use different Gmail colgroup class names.
    // Keep the current Primary mapping from collapsing the subject column or
    // assigning the action width to the date column.
    expect(injectedCss).toContain('col.null { width: auto !important; }');
    expect(injectedCss).toContain('col.xX { width: 72px !important; }');
    expect(injectedCss).toContain('col.bq4 { width: 152px !important; }');
    expect(injectedCss).toContain('td.bq4 > ul');
  });

  it('restores detail pane and list pane layout back to normal', () => {
    adapter.suppressDetailPane(detailEl);
    adapter.restoreDetailPane(detailEl);

    expect(detailEl.classList.contains('undock-suppressed-detail')).toBe(false);
    expect(detailEl.getAttribute('data-undock-suppressed')).toBeNull();
    expect(detailEl.style.position).toBe('');
    expect(detailEl.style.left).toBe('');
    expect(detailEl.style.opacity).toBe('');
    expect(detailEl.style.pointerEvents).toBe('');
    expect(listEl.classList.contains('undock-expanded-list')).toBe(false);
    expect(listEl.style.overflowX).toBe('');
  });

  it('prepares cloned detail pane for clean rendering in detached window', () => {
    adapter.suppressDetailPane(detailEl);
    const clone = detailEl.cloneNode(true) as HTMLElement;

    const prepared = adapter.onBeforeSync(clone);
    expect(prepared.classList.contains('undock-cloned-detail')).toBe(true);
    expect(prepared.classList.contains('undock-suppressed-detail')).toBe(false);
    expect(prepared.style.position).toBe('static');
    expect(prepared.style.visibility).toBe('visible');
    expect(prepared.style.width).toBe('100%');
  });

  it('proxies action clicks back to source action buttons in parent DOM (FR-07)', () => {
    const parentArchiveBtn = document.querySelector('button[aria-label="Archive"]') as HTMLButtonElement;
    let clicked = false;
    parentArchiveBtn.addEventListener('click', () => {
      clicked = true;
    });

    const targetProxyBtn = document.createElement('button');
    targetProxyBtn.setAttribute('aria-label', 'Archive');

    const handled = adapter.handleActionProxy('archive', targetProxyBtn);
    expect(handled).toBe(true);
    expect(clicked).toBe(true);
  });

  it('isolates pure reading pane and excludes table[role="grid"] in findDetailContainer', () => {
    const detailContainer = adapter.findDetailContainer();
    expect(detailContainer).not.toBeNull();
    // Must NOT contain the inbox grid table!
    expect(detailContainer?.querySelector('table[role="grid"]')).toBeNull();
    expect(detailContainer?.textContent).toContain('Thread Subject');
  });

  it('detects active split mode and thread selection across modern Gmail DOM structures', () => {
    // 1. Initial beforeEach setup: split mode with thread selected
    expect(adapter.isSplitModeActive()).toBe(true);
    expect(adapter.isThreadSelected()).toBe(true);

    // 2. Modern Gmail thread using h2.hP without data-thread-perm-id
    document.body.innerHTML = `
      <div role="main">
        <div class="list-wrapper">
          <table role="grid"><tbody><tr><td>Thread 1</td></tr></tbody></table>
        </div>
        <div class="reading-pane">
          <h2 class="hP">Modern Subject Header</h2>
          <div class="ii gt">Email message body</div>
        </div>
      </div>
    `;
    expect(adapter.isSplitModeActive()).toBe(true);
    expect(adapter.isThreadSelected()).toBe(true);

    // 3. Split mode enabled, but NO email selected yet (empty reading pane with placeholder text)
    document.body.innerHTML = `
      <div role="main">
        <div class="split-container">
          <div class="list-col">
            <table role="grid"><tbody><tr><td>Thread 1</td></tr></tbody></table>
          </div>
          <div class="bZ"></div>
          <div class="empty-pane">No conversation selected</div>
        </div>
      </div>
    `;
    expect(adapter.isSplitModeActive()).toBe(true);
    expect(adapter.isThreadSelected()).toBe(false);

    // 4. No-split mode: viewing inbox list only (single pane)
    document.body.innerHTML = `
      <div role="main">
        <table role="grid"><tbody><tr><td>Thread 1</td></tr></tbody></table>
      </div>
    `;
    expect(adapter.isSplitModeActive()).toBe(false);
    expect(adapter.isThreadSelected()).toBe(false);

    // 5. No-split mode: viewing full-screen email (table[role="grid"] is unmounted)
    document.body.innerHTML = `
      <div role="main">
        <div class="toolbar">
          <div role="button" aria-label="Back to Inbox" act="19">Back</div>
        </div>
        <div class="full-view-thread">
          <h2 class="hP">Full-screen Email</h2>
          <div class="ii gt">Message body</div>
        </div>
      </div>
    `;
    expect(adapter.isSplitModeActive()).toBe(false);
  });

  it('enableSplitMode returns true immediately if split mode is already active', async () => {
    expect(adapter.isSplitModeActive()).toBe(true);
    const result = await adapter.enableSplitMode();
    expect(result).toBe(true);
  });

  it('enableSplitMode activates split mode via toolbar toggle button', async () => {
    // Set up single-pane DOM with a split toggle button in toolbar
    document.body.innerHTML = `
      <div class="toolbar">
        <div role="button" aria-label="Toggle split pane mode">Toggle</div>
      </div>
      <div role="main">
        <div id="split-wrapper">
          <div id="list-branch">
            <table role="grid"><tbody><tr><td>Thread 1</td></tr></tbody></table>
          </div>
        </div>
      </div>
    `;
    expect(adapter.isSplitModeActive()).toBe(false);

    const splitBtn = document.querySelector('[aria-label="Toggle split pane mode"]') as HTMLElement;
    splitBtn.addEventListener('click', () => {
      // Simulate Gmail adding the reading pane sibling
      const wrapper = document.getElementById('split-wrapper');
      const readingPane = document.createElement('div');
      readingPane.id = 'reading-pane';
      readingPane.innerHTML = '<div data-thread-perm-id="123">Email Content</div>';
      wrapper?.appendChild(readingPane);
    });

    const result = await adapter.enableSplitMode();
    expect(result).toBe(true);
    expect(adapter.isSplitModeActive()).toBe(true);
  });

  it('enableSplitMode activates split mode via Quick Settings automation', async () => {
    // Set up single-pane DOM with no toolbar split button, but Settings gear
    document.body.innerHTML = `
      <div class="header">
        <div role="button" aria-label="Settings" gh="s">Settings</div>
      </div>
      <div role="main">
        <div id="split-wrapper">
          <div id="list-branch">
            <table role="grid"><tbody><tr><td>Thread 1</td></tr></tbody></table>
          </div>
        </div>
      </div>
    `;
    expect(adapter.isSplitModeActive()).toBe(false);

    const settingsBtn = document.querySelector('[aria-label="Settings"]') as HTMLElement;
    settingsBtn.addEventListener('click', () => {
      // Mount Quick Settings drawer
      const drawer = document.createElement('div');
      drawer.setAttribute('role', 'region');
      drawer.setAttribute('aria-label', 'Quick settings');
      drawer.innerHTML = `
        <button aria-label="Close">X</button>
        <div role="radio" aria-label="Right of inbox">Right of inbox</div>
      `;
      document.body.appendChild(drawer);

      const radio = drawer.querySelector('[aria-label="Right of inbox"]') as HTMLElement;
      radio.addEventListener('click', () => {
        // Simulate Gmail adding the reading pane sibling
        const wrapper = document.getElementById('split-wrapper');
        const readingPane = document.createElement('div');
        readingPane.id = 'reading-pane';
        readingPane.innerHTML = '<div data-thread-perm-id="456">Email Content</div>';
        wrapper?.appendChild(readingPane);
      });
    });

    const result = await adapter.enableSplitMode();
    expect(result).toBe(true);
    expect(adapter.isSplitModeActive()).toBe(true);
  });
});
