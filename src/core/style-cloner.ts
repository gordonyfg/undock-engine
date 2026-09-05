import { safeCssEscape } from '../utils/dom';

export class StyleCloner {
  private headObserver: MutationObserver | null = null;
  private targetDoc: Document | null = null;

  /**
   * Clones all stylesheets, style tags, root CSS variables, and root attributes
   * from the parent document to the target document.
   */
  cloneStylesTo(targetDoc: Document): void {
    this.targetDoc = targetDoc;
    const targetHead = targetDoc.head;
    if (!targetHead) return;

    // Synchronize HTML & Body attributes (classes, data-attributes, themes)
    this.syncRootAttributes(targetDoc);

    // Clone root CSS custom variables
    this.syncRootCssVariables(targetDoc);

    // Clone all <style> elements
    const styleTags = document.querySelectorAll<HTMLStyleElement>('style');
    styleTags.forEach((sourceStyle) => {
      // Don't re-clone if already present by unique identifier
      const id = sourceStyle.id;
      if (id && targetHead.querySelector(`style#${safeCssEscape(id)}`)) {
        return;
      }
      const clonedStyle = targetDoc.createElement('style');
      if (id) clonedStyle.id = `cloned-${id}`;
      clonedStyle.textContent = sourceStyle.textContent;
      targetHead.appendChild(clonedStyle);
    });

    // Clone all <link rel="stylesheet"> elements
    const linkTags = document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]');
    linkTags.forEach((sourceLink) => {
      const href = sourceLink.href;
      if (!href) return;
      if (targetHead.querySelector(`link[href="${safeCssEscape(href)}"]`)) {
        return;
      }

      const clonedLink = targetDoc.createElement('link');
      clonedLink.rel = 'stylesheet';
      clonedLink.href = href;
      if (sourceLink.media) clonedLink.media = sourceLink.media;
      if (sourceLink.crossOrigin) clonedLink.crossOrigin = sourceLink.crossOrigin;
      targetHead.appendChild(clonedLink);
    });

    // Also extract and inline rules from active stylesheets if accessible
    this.syncInaccessibleRules(targetDoc);
  }

  /**
   * Watches parent document.head for dynamically added or modified style rules.
   */
  startWatching(targetDoc: Document): void {
    if (typeof MutationObserver === 'undefined') return;

    this.disconnect();
    this.targetDoc = targetDoc;

    this.headObserver = new MutationObserver((mutations) => {
      if (!this.targetDoc || !this.targetDoc.head) return;

      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            if (el.tagName.toLowerCase() === 'style') {
              const clone = this.targetDoc!.createElement('style');
              clone.textContent = el.textContent;
              this.targetDoc!.head.appendChild(clone);
            } else if (
              el.tagName.toLowerCase() === 'link' &&
              el.getAttribute('rel') === 'stylesheet'
            ) {
              const link = el as HTMLLinkElement;
              const clone = this.targetDoc!.createElement('link');
              clone.rel = 'stylesheet';
              clone.href = link.href;
              this.targetDoc!.head.appendChild(clone);
            }
          }
        });
      }
    });

    if (document.head) {
      this.headObserver.observe(document.head, {
        childList: true,
        subtree: true,
      });
    }
  }

  disconnect(): void {
    if (this.headObserver) {
      this.headObserver.disconnect();
      this.headObserver = null;
    }
    this.targetDoc = null;
  }

  /**
   * Syncs theme attributes and classes from parent <html> and <body>.
   */
  private syncRootAttributes(targetDoc: Document): void {
    if (document.documentElement && targetDoc.documentElement) {
      targetDoc.documentElement.className = document.documentElement.className;
      targetDoc.documentElement.dir = document.documentElement.dir;
      targetDoc.documentElement.lang = document.documentElement.lang;

      // Copy data-* attributes (theme, color scheme, etc.)
      for (const attr of Array.from(document.documentElement.attributes)) {
        if (attr.name.startsWith('data-') || attr.name === 'style') {
          targetDoc.documentElement.setAttribute(attr.name, attr.value);
        }
      }
    }

    if (document.body && targetDoc.body) {
      targetDoc.body.className = document.body.className;
      for (const attr of Array.from(document.body.attributes)) {
        if (attr.name.startsWith('data-') || attr.name === 'style') {
          targetDoc.body.setAttribute(attr.name, attr.value);
        }
      }
    }
  }

  /**
   * Scans document computed styles for custom CSS variables (--*) and injects them.
   */
  private syncRootCssVariables(targetDoc: Document): void {
    try {
      const computed = window.getComputedStyle(document.documentElement);
      const varDeclarations: string[] = [];

      for (let i = 0; i < computed.length; i++) {
        const propName = computed[i];
        if (propName.startsWith('--')) {
          const val = computed.getPropertyValue(propName);
          varDeclarations.push(`${propName}: ${val};`);
        }
      }

      if (varDeclarations.length > 0) {
        let styleTag = targetDoc.getElementById('undock-css-vars') as HTMLStyleElement | null;
        if (!styleTag) {
          styleTag = targetDoc.createElement('style');
          styleTag.id = 'undock-css-vars';
          targetDoc.head.appendChild(styleTag);
        }
        styleTag.textContent = `:root {\n  ${varDeclarations.join('\n  ')}\n}`;
      }
    } catch {
      // Ignore security errors with cross-origin styles
    }
  }

  /**
   * Pulls CSS rules from styleSheets collection when possible to bypass asset latency.
   */
  private syncInaccessibleRules(targetDoc: Document): void {
    try {
      let combinedCss = '';
      for (let i = 0; i < document.styleSheets.length; i++) {
        const sheet = document.styleSheets[i];
        try {
          if (sheet.cssRules) {
            for (let j = 0; j < sheet.cssRules.length; j++) {
              combinedCss += sheet.cssRules[j].cssText + '\n';
            }
          }
        } catch {
          // Cross-origin stylesheet access restricted; already covered via <link> clone
        }
      }

      if (combinedCss) {
        let styleTag = targetDoc.getElementById('undock-synced-rules') as HTMLStyleElement | null;
        if (!styleTag) {
          styleTag = targetDoc.createElement('style');
          styleTag.id = 'undock-synced-rules';
          targetDoc.head.appendChild(styleTag);
        }
        styleTag.textContent = combinedCss;
      }
    } catch {
      // Ignore
    }
  }
}
