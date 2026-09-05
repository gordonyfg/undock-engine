import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UndockButton } from '../src/ui/undock-button';
import { UndockEngine } from '../src/core/engine';

describe('UndockButton Component', () => {
  let mockEngine: any;
  let stateCallback: ((state: any) => void) | null = null;
  let undockButton: UndockButton;

  beforeEach(() => {
    document.body.innerHTML = '';
    stateCallback = null;
    mockEngine = {
      isUndocked: false,
      toggle: vi.fn(async () => true),
      undock: vi.fn(async () => true),
      dock: vi.fn(async () => true),
      onStateChange: vi.fn((cb) => {
        stateCallback = cb;
        cb({ isUndocked: false });
        return () => {
          stateCallback = null;
        };
      }),
    };
  });

  afterEach(() => {
    if (undockButton) {
      undockButton.destroy();
    }
  });

  it('mounts primary toolbar button directly next to Gmail split pane button', () => {
    document.body.innerHTML = `
      <div class="G-atb" gh="tm">
        <div class="G-tF">
          <span class="pagination">1-50 of 100</span>
          <div role="button" aria-label="Toggle split pane mode" class="split-btn">Split</div>
        </div>
      </div>
    `;

    undockButton = new UndockButton(mockEngine as unknown as UndockEngine);
    undockButton.mount();

    const triggerBtn = document.getElementById('undock-trigger-btn');
    expect(triggerBtn).not.toBeNull();

    const splitBtn = document.querySelector('[aria-label="Toggle split pane mode"]');
    expect(triggerBtn?.closest('.undock-button-wrapper')?.nextElementSibling).toBe(splitBtn);
  });

  it('mounts into fallback toolbar if split pane button is absent and never into navigation sidebar', () => {
    document.body.innerHTML = `
      <div role="navigation" class="sidebar">
        <div class="folder">Inbox</div>
      </div>
      <div class="G-atb" gh="tm">
        <div class="G-tF">
          <span class="pagination">1-50 of 100</span>
        </div>
      </div>
    `;

    undockButton = new UndockButton(mockEngine as unknown as UndockEngine);
    undockButton.mount();

    const triggerBtn = document.getElementById('undock-trigger-btn');
    expect(triggerBtn).not.toBeNull();

    // Must NOT be inside the sidebar navigation
    const nav = document.querySelector('[role="navigation"]');
    expect(nav?.contains(triggerBtn)).toBe(false);

    // Must be inside the toolbar
    const toolbar = document.querySelector('.G-tF');
    expect(toolbar?.contains(triggerBtn)).toBe(true);
  });

  it('is idempotent and does not mutate DOM if button is already in position', () => {
    document.body.innerHTML = `
      <div class="G-atb" gh="tm">
        <div class="G-tF">
          <div role="button" aria-label="Toggle split pane mode" class="split-btn">Split</div>
        </div>
      </div>
    `;

    undockButton = new UndockButton(mockEngine as unknown as UndockEngine);
    undockButton.mount();

    const triggerBtn = document.getElementById('undock-trigger-btn');
    const container = triggerBtn?.closest('.undock-button-wrapper');

    const splitBtn = document.querySelector('[aria-label="Toggle split pane mode"]') as HTMLElement;
    const insertBeforeSpy = vi.spyOn(splitBtn.parentElement!, 'insertBefore');

    // Second call to updateMounts()
    undockButton.updateMounts();

    // Should NOT call insertBefore again because container is already right before splitBtn!
    expect(insertBeforeSpy).not.toHaveBeenCalled();
    expect(container?.nextElementSibling).toBe(splitBtn);
  });

  it('updates state across button when undocked state toggles', () => {
    document.body.innerHTML = `
      <div class="G-atb" gh="tm">
        <div role="button" aria-label="Toggle split pane mode"></div>
      </div>
    `;

    undockButton = new UndockButton(mockEngine as unknown as UndockEngine);
    undockButton.mount();

    const triggerBtn = document.getElementById('undock-trigger-btn');
    expect(triggerBtn?.textContent).toContain('Undock');
    expect(triggerBtn?.classList.contains('undock-active')).toBe(false);

    // Simulate state change to undocked
    mockEngine.isUndocked = true;
    stateCallback?.({ isUndocked: true });

    expect(triggerBtn?.textContent).toContain('Re-dock');
    expect(triggerBtn?.classList.contains('undock-active')).toBe(true);

    // Toggle back to docked
    mockEngine.isUndocked = false;
    stateCallback?.({ isUndocked: false });

    expect(triggerBtn?.textContent).toContain('Undock');
    expect(triggerBtn?.classList.contains('undock-active')).toBe(false);
  });

  it('cleans up mounted elements and timers on destroy', () => {
    document.body.innerHTML = `
      <div class="G-atb" gh="tm">
        <div role="button" aria-label="Toggle split pane mode"></div>
      </div>
    `;

    undockButton = new UndockButton(mockEngine as unknown as UndockEngine);
    undockButton.mount();

    expect(document.getElementById('undock-trigger-btn')).not.toBeNull();

    undockButton.destroy();

    expect(document.getElementById('undock-trigger-btn')).toBeNull();
  });
});
