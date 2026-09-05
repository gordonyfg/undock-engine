import { SiteAdapter, validateSiteAdapter } from './base';
import { GmailAdapter } from './gmail';

export class AdapterRegistry {
  private adapters: SiteAdapter[] = [];

  constructor() {
    // Register standard adapters
    this.register(new GmailAdapter());
  }

  /**
   * Registers a new SiteAdapter after validating its interface contract.
   */
  register(adapter: SiteAdapter): void {
    const validation = validateSiteAdapter(adapter);
    if (!validation.valid) {
      throw new Error(`Invalid SiteAdapter [${adapter?.name}]: ${validation.errors.join(', ')}`);
    }

    // Replace if already registered with same name
    const existingIndex = this.adapters.findIndex((a) => a.name === adapter.name);
    if (existingIndex >= 0) {
      this.adapters[existingIndex] = adapter;
    } else {
      this.adapters.push(adapter);
    }
  }

  /**
   * Finds the appropriate adapter matching the provided hostname or URL.
   */
  findAdapterForHost(hostname: string): SiteAdapter | null {
    const cleanHost = hostname.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
    for (const adapter of this.adapters) {
      if (adapter.domainPattern.test(cleanHost)) {
        return adapter;
      }
    }
    return null;
  }

  getAllAdapters(): readonly SiteAdapter[] {
    return this.adapters;
  }
}

export const globalAdapterRegistry = new AdapterRegistry();
