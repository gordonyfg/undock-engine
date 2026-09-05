export interface UndockCore {
  readonly isUndocked: boolean;
  readonly activeAdapter: SiteAdapter | null;
  undock(): Promise<boolean>;
  dock(): Promise<boolean>;
  toggle(): Promise<boolean>;
}

export interface SiteAdapter {
  name: string;
  domainPattern: RegExp;

  // Selectors
  selectors: {
    listContainer: string;
    detailContainer: string;
    actionButtons?: Record<string, string>;
  };

  // Suppression behavior
  suppressDetailPane(detailEl: HTMLElement): void;
  restoreDetailPane(detailEl: HTMLElement): void;

  // Custom life-cycle hooks
  onInit?(core: UndockCore): void;
  onBeforeSync?(clone: HTMLElement): HTMLElement;
  handleActionProxy?(action: string, targetEl: HTMLElement): boolean;
  enableSplitMode?(): Promise<boolean>;
}

export interface DeclarativeAdapterConfig {
  name: string;
  domainPattern: string; // Regex source string
  selectors: {
    listContainer: string;
    detailContainer: string;
    actionButtons?: Record<string, string>;
  };
  suppression?: {
    offscreenWidth?: string;
    customStyles?: string;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a runtime SiteAdapter object against the interface contract.
 */
export function validateSiteAdapter(adapter: unknown): ValidationResult {
  const errors: string[] = [];

  if (!adapter || typeof adapter !== 'object') {
    return { valid: false, errors: ['Adapter must be an object'] };
  }

  const a = adapter as Partial<SiteAdapter>;

  if (typeof a.name !== 'string' || !a.name.trim()) {
    errors.push('Adapter name must be a non-empty string');
  }

  if (!(a.domainPattern instanceof RegExp)) {
    errors.push('domainPattern must be an instance of RegExp');
  }

  if (!a.selectors || typeof a.selectors !== 'object') {
    errors.push('selectors must be an object');
  } else {
    if (typeof a.selectors.listContainer !== 'string' || !a.selectors.listContainer.trim()) {
      errors.push('selectors.listContainer must be a non-empty selector string');
    }
    if (typeof a.selectors.detailContainer !== 'string' || !a.selectors.detailContainer.trim()) {
      errors.push('selectors.detailContainer must be a non-empty selector string');
    }
    if (a.selectors.actionButtons && typeof a.selectors.actionButtons !== 'object') {
      errors.push('selectors.actionButtons must be a key-value mapping if provided');
    }
  }

  if (typeof a.suppressDetailPane !== 'function') {
    errors.push('suppressDetailPane must be a function');
  }

  if (typeof a.restoreDetailPane !== 'function') {
    errors.push('restoreDetailPane must be a function');
  }

  if (a.onInit !== undefined && typeof a.onInit !== 'function') {
    errors.push('onInit must be a function if defined');
  }

  if (a.onBeforeSync !== undefined && typeof a.onBeforeSync !== 'function') {
    errors.push('onBeforeSync must be a function if defined');
  }

  if (a.handleActionProxy !== undefined && typeof a.handleActionProxy !== 'function') {
    errors.push('handleActionProxy must be a function if defined');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a JSON / declarative config for rapid adapter onboarding.
 */
export function validateDeclarativeConfig(config: unknown): ValidationResult {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Configuration must be a JSON object'] };
  }

  const c = config as Partial<DeclarativeAdapterConfig>;

  if (typeof c.name !== 'string' || !c.name.trim()) {
    errors.push('Config name must be a non-empty string');
  }

  if (typeof c.domainPattern !== 'string' || !c.domainPattern.trim()) {
    errors.push('Config domainPattern must be a non-empty string');
  } else {
    try {
      new RegExp(c.domainPattern);
    } catch (e) {
      errors.push(`Invalid regular expression in domainPattern: ${(e as Error).message}`);
    }
  }

  if (!c.selectors || typeof c.selectors !== 'object') {
    errors.push('selectors must be specified');
  } else {
    if (typeof c.selectors.listContainer !== 'string' || !c.selectors.listContainer.trim()) {
      errors.push('selectors.listContainer must be a valid CSS selector string');
    }
    if (typeof c.selectors.detailContainer !== 'string' || !c.selectors.detailContainer.trim()) {
      errors.push('selectors.detailContainer must be a valid CSS selector string');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a SiteAdapter from a declarative configuration.
 */
export function createAdapterFromConfig(config: DeclarativeAdapterConfig): SiteAdapter {
  const validation = validateDeclarativeConfig(config);
  if (!validation.valid) {
    throw new Error(`Invalid adapter configuration: ${validation.errors.join(', ')}`);
  }

  const domainRegex = new RegExp(config.domainPattern);
  const offscreenWidth = config.suppression?.offscreenWidth || '900px';

  return {
    name: config.name,
    domainPattern: domainRegex,
    selectors: config.selectors,
    suppressDetailPane(detailEl: HTMLElement) {
      detailEl.setAttribute('data-undock-suppressed', 'true');
      detailEl.style.setProperty('position', 'absolute', 'important');
      detailEl.style.setProperty('left', '-9999px', 'important');
      detailEl.style.setProperty('visibility', 'hidden', 'important');
      detailEl.style.setProperty('width', offscreenWidth, 'important');
      detailEl.style.setProperty('height', '100%', 'important');
      detailEl.style.setProperty('pointer-events', 'none', 'important');

      const listContainer = document.querySelector<HTMLElement>(config.selectors.listContainer);
      if (listContainer) {
        listContainer.style.setProperty('width', '100%', 'important');
        listContainer.style.setProperty('flex', '1 1 100%', 'important');
      }
    },
    restoreDetailPane(detailEl: HTMLElement) {
      detailEl.removeAttribute('data-undock-suppressed');
      detailEl.style.removeProperty('position');
      detailEl.style.removeProperty('left');
      detailEl.style.removeProperty('visibility');
      detailEl.style.removeProperty('width');
      detailEl.style.removeProperty('height');
      detailEl.style.removeProperty('pointer-events');

      const listContainer = document.querySelector<HTMLElement>(config.selectors.listContainer);
      if (listContainer) {
        listContainer.style.removeProperty('width');
        listContainer.style.removeProperty('flex');
      }
    },
  };
}
