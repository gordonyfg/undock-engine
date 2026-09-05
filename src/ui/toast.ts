export class Toast {
  private static toastEl: HTMLElement | null = null;
  private static timeoutId: number | null = null;

  static show(message: string, durationMs: number = 4000, action?: { label: string; onClick: () => void }): void {
    if (typeof document === 'undefined') return;

    this.dismiss();

    const toast = document.createElement('div');
    toast.className = 'undock-toast-notification';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    const msgSpan = document.createElement('span');
    msgSpan.className = 'undock-toast-message';
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    if (action) {
      const actionBtn = document.createElement('button');
      actionBtn.className = 'undock-toast-action';
      actionBtn.textContent = action.label;
      actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        action.onClick();
        this.dismiss();
      });
      toast.appendChild(actionBtn);
    }

    this.injectStyles();
    document.body.appendChild(toast);
    this.toastEl = toast;

    // Trigger enter animation
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    this.timeoutId = window.setTimeout(() => {
      this.dismiss();
    }, durationMs);
  }

  static dismiss(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.toastEl && this.toastEl.parentNode) {
      const el = this.toastEl;
      el.classList.remove('visible');
      setTimeout(() => {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      }, 300);
      this.toastEl = null;
    }
  }

  private static injectStyles(): void {
    if (document.getElementById('undock-toast-styles')) return;

    const style = document.createElement('style');
    style.id = 'undock-toast-styles';
    style.textContent = `
      .undock-toast-notification {
        position: fixed;
        bottom: 28px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: #202124;
        color: #ffffff;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
        z-index: 10000000;
        display: flex;
        align-items: center;
        gap: 16px;
        opacity: 0;
        transition: transform 0.25s cubic-bezier(0, 0, 0.2, 1), opacity 0.25s cubic-bezier(0, 0, 0.2, 1);
        pointer-events: auto;
      }
      .undock-toast-notification.visible {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
      .undock-toast-message {
        color: #f1f3f4;
      }
      .undock-toast-action {
        background: transparent;
        border: none;
        color: #8ab4f8;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .undock-toast-action:hover {
        background: rgba(138, 180, 248, 0.08);
      }
    `;
    document.head?.appendChild(style);
  }
}
