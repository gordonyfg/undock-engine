/**
 * Safe CSS.escape wrapper
 */
export function safeCssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

/**
 * Universal synthetic click dispatcher compatible with standard DOM,
 * Google Wiz, and dynamic framework button event handlers.
 */
export function dispatchSyntheticClick(el: HTMLElement, sourceEvent?: MouseEvent): void {
  if (!el) return;

  if (typeof el.focus === 'function') {
    try {
      el.focus();
    } catch {}
  }

  let clientX = 0;
  let clientY = 0;
  let screenX = 0;
  let screenY = 0;

  try {
    const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    clientX = rect.left + rect.width / 2;
    clientY = rect.top + rect.height / 2;
    screenX = sourceEvent ? sourceEvent.screenX : clientX;
    screenY = sourceEvent ? sourceEvent.screenY : clientY;
  } catch {}

  const eventInit: any = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: el.ownerDocument?.defaultView || (typeof window !== 'undefined' ? window : null) || undefined,
    detail: 1,
    screenX,
    screenY,
    clientX,
    clientY,
    button: 0,
    buttons: 1,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
  };

  try {
    if (typeof PointerEvent !== 'undefined') {
      el.dispatchEvent(new PointerEvent('pointerdown', eventInit));
    }
    el.dispatchEvent(new MouseEvent('mousedown', eventInit));
    if (typeof PointerEvent !== 'undefined') {
      el.dispatchEvent(new PointerEvent('pointerup', eventInit));
    }
    el.dispatchEvent(new MouseEvent('mouseup', eventInit));
  } catch {}

  try {
    el.click();
  } catch {
    try {
      el.dispatchEvent(new MouseEvent('click', eventInit));
    } catch {}
  }
}

