import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Toast } from '../src/ui/toast';

describe('Toast Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    Toast.dismiss();
  });

  it('renders a toast notification with the given message', () => {
    Toast.show('Test notification message');

    const toast = document.querySelector('.undock-toast-notification');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toContain('Test notification message');
  });

  it('supports an action button with click callback', () => {
    const actionSpy = vi.fn();
    Toast.show('Action notification', 5000, {
      label: 'Enable',
      onClick: actionSpy,
    });

    const actionBtn = document.querySelector('.undock-toast-action') as HTMLButtonElement;
    expect(actionBtn).not.toBeNull();
    expect(actionBtn.textContent).toBe('Enable');

    actionBtn.click();
    expect(actionSpy).toHaveBeenCalled();
  });

  it('dismisses toast cleanly', () => {
    Toast.show('Dismiss me');
    expect(document.querySelector('.undock-toast-notification')).not.toBeNull();

    Toast.dismiss();
    const toast = document.querySelector('.undock-toast-notification');
    expect(toast?.classList.contains('visible')).toBe(false);
  });
});
