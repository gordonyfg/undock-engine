// Mock basic chrome extension APIs for tests
if (typeof (globalThis as any).CSS === 'undefined') {
  (globalThis as any).CSS = {
    escape: (s: string) => s.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1'),
  };
}

if (typeof Element !== 'undefined') {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = vi.fn(function (this: any, options: any) {
      if (typeof options === 'object' && options !== null && options.top !== undefined) {
        this.scrollTop = options.top;
      }
    });
  }
}

const storageMock = (() => {
  const store: Record<string, any> = {};
  return {
    local: {
      get: vi.fn(async (keys?: string | string[]) => {
        if (!keys) return { ...store };
        if (typeof keys === 'string') {
          return { [keys]: store[keys] };
        }
        const res: Record<string, any> = {};
        for (const k of keys) {
          res[k] = store[k];
        }
        return res;
      }),
      set: vi.fn(async (items: Record<string, any>) => {
        Object.assign(store, items);
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) {
          delete store[k];
        }
      }),
      clear: vi.fn(async () => {
        for (const k of Object.keys(store)) {
          delete store[k];
        }
      }),
    },
    session: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => {}),
    },
  };
})();

(globalThis as any).chrome = {
  storage: storageMock,
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    sendMessage: vi.fn(),
    onRemoved: {
      addListener: vi.fn(),
    },
  },
};
