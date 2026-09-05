import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StyleCloner } from '../src/core/style-cloner';

describe('StyleCloner (FR-03)', () => {
  let cloner: StyleCloner;
  let targetDoc: Document;

  beforeEach(() => {
    document.head.innerHTML = `
      <style id="theme-style">.test-cls { color: red; }</style>
      <link rel="stylesheet" href="https://example.com/custom.css" />
    `;
    document.documentElement.className = 'gmail-dark-theme';
    document.documentElement.setAttribute('data-theme', 'dark');

    targetDoc = document.implementation.createHTMLDocument('Target Doc');
    cloner = new StyleCloner();
  });

  afterEach(() => {
    cloner.disconnect();
  });

  it('clones style tags and stylesheets into target document', () => {
    cloner.cloneStylesTo(targetDoc);

    const clonedStyle = targetDoc.head.querySelector('style#cloned-theme-style');
    expect(clonedStyle).not.toBeNull();
    expect(clonedStyle?.textContent).toContain('.test-cls { color: red; }');

    const clonedLink = targetDoc.head.querySelector('link[rel="stylesheet"]');
    expect(clonedLink).not.toBeNull();
    expect(clonedLink?.getAttribute('href')).toBe('https://example.com/custom.css');
  });

  it('synchronizes root html attributes and theme classes', () => {
    cloner.cloneStylesTo(targetDoc);

    expect(targetDoc.documentElement.className).toBe('gmail-dark-theme');
    expect(targetDoc.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('watches for dynamically added styles in parent document', async () => {
    cloner.cloneStylesTo(targetDoc);
    cloner.startWatching(targetDoc);

    const newStyle = document.createElement('style');
    newStyle.textContent = '.dynamic-class { display: block; }';
    document.head.appendChild(newStyle);

    // Wait for mutation observer microtask
    await new Promise((resolve) => setTimeout(resolve, 50));

    const found = Array.from(targetDoc.head.querySelectorAll('style')).some((s) =>
      s.textContent?.includes('.dynamic-class')
    );
    expect(found).toBe(true);
  });
});
