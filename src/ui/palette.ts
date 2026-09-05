import { UndockEngine } from '../core/engine';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  execute: () => void | Promise<unknown>;
}

export class CommandPalette {
  private engine: UndockEngine;
  private overlayEl: HTMLElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private listEl: HTMLElement | null = null;
  private isOpen: boolean = false;
  private activeIndex: number = 0;
  private filteredCommands: CommandItem[] = [];

  constructor(engine: UndockEngine) {
    this.engine = engine;
    this.bindGlobalShortcut();
  }

  get commands(): CommandItem[] {
    return [
      {
        id: 'toggle-undock',
        label: this.engine.isUndocked ? 'Re-dock Reading Pane' : 'Undock Reading Pane',
        description: 'Toggle detached secondary window for reading pane',
        shortcut: 'Ctrl+Shift+U',
        execute: () => this.engine.toggle(),
      },
      {
        id: 'dock-all',
        label: 'Re-dock to Main Window',
        description: 'Close pop-out window and restore embedded layout',
        execute: () => this.engine.dock(),
      },
      {
        id: 'reset-coords',
        label: 'Reset Window Coordinates',
        description: 'Reset persisted position and size for pop-out window',
        execute: async () => {
          if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await chrome.storage.local.remove('undock_coords_gmail');
          } else if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('undock_coords_gmail');
          }
        },
      },
      {
        id: 'shortcuts-guide',
        label: 'Triage Keyboard Shortcuts Guide',
        description: 'j/k: next/prev, e: archive, #: delete, s: star, r: reply',
        execute: () => {
          alert(
            'Undock Triage Shortcuts (in pop-out window):\n' +
              '• j / k: Next / Previous conversation\n' +
              '• e / y: Archive thread\n' +
              '• # / Delete: Delete thread\n' +
              '• s: Star / Unstar\n' +
              '• r / a: Reply / Reply All\n' +
              '• f: Forward\n' +
              '• u: Return to list view'
          );
        },
      },
    ];
  }

  show(): void {
    if (this.isOpen) return;
    this.createDom();
    this.isOpen = true;
    this.filterCommands('');
    setTimeout(() => this.inputEl?.focus(), 50);
  }

  hide(): void {
    if (!this.isOpen) return;
    if (this.overlayEl && this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
    this.overlayEl = null;
    this.inputEl = null;
    this.listEl = null;
    this.isOpen = false;
  }

  private bindGlobalShortcut(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      // Toggle palette on Cmd+Shift+P / Ctrl+Shift+P
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        if (this.isOpen) {
          this.hide();
        } else {
          this.show();
        }
      }

      // Quick toggle undock on Cmd+Shift+U / Ctrl+Shift+U
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
        this.engine.toggle();
      }
    });
  }

  private createDom(): void {
    this.injectStyles();

    const overlay = document.createElement('div');
    overlay.className = 'undock-palette-backdrop';

    overlay.innerHTML = `
      <div class="undock-palette-modal" role="dialog" aria-modal="true">
        <div class="undock-palette-header">
          <input type="text" class="undock-palette-input" placeholder="Type a command or action..." />
        </div>
        <div class="undock-palette-list" role="listbox"></div>
      </div>
    `;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.hide();
      }
    });

    const input = overlay.querySelector<HTMLInputElement>('.undock-palette-input')!;
    const list = overlay.querySelector<HTMLElement>('.undock-palette-list')!;

    input.addEventListener('input', () => {
      this.filterCommands(input.value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hide();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.setActiveIndex(this.activeIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.setActiveIndex(this.activeIndex - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.executeActive();
      }
    });

    this.overlayEl = overlay;
    this.inputEl = input;
    this.listEl = list;
    document.body.appendChild(overlay);
  }

  private filterCommands(query: string): void {
    const q = query.toLowerCase().trim();
    this.filteredCommands = this.commands.filter(
      (cmd) => cmd.label.toLowerCase().includes(q) || cmd.description?.toLowerCase().includes(q)
    );
    this.activeIndex = 0;
    this.renderList();
  }

  private setActiveIndex(index: number): void {
    if (this.filteredCommands.length === 0) return;
    this.activeIndex = (index + this.filteredCommands.length) % this.filteredCommands.length;
    this.renderList();
  }

  private executeActive(): void {
    const activeCmd = this.filteredCommands[this.activeIndex];
    if (activeCmd) {
      this.hide();
      activeCmd.execute();
    }
  }

  private renderList(): void {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';

    if (this.filteredCommands.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'undock-palette-empty';
      empty.textContent = 'No matching commands';
      this.listEl.appendChild(empty);
      return;
    }

    this.filteredCommands.forEach((cmd, idx) => {
      const item = document.createElement('div');
      item.className = `undock-palette-item ${idx === this.activeIndex ? 'active' : ''}`;
      item.setAttribute('role', 'option');

      item.innerHTML = `
        <div class="undock-palette-item-text">
          <div class="undock-palette-item-label">${cmd.label}</div>
          ${cmd.description ? `<div class="undock-palette-item-desc">${cmd.description}</div>` : ''}
        </div>
        ${cmd.shortcut ? `<kbd class="undock-palette-kbd">${cmd.shortcut}</kbd>` : ''}
      `;

      item.addEventListener('click', () => {
        this.hide();
        cmd.execute();
      });

      this.listEl?.appendChild(item);
    });
  }

  private injectStyles(): void {
    if (document.getElementById('undock-palette-styles')) return;

    const style = document.createElement('style');
    style.id = 'undock-palette-styles';
    style.textContent = `
      .undock-palette-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(2px);
        z-index: 1000000;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding-top: 15vh;
      }
      .undock-palette-modal {
        width: 540px;
        max-width: 90vw;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.25);
        border: 1px solid #e0e0e0;
        overflow: hidden;
      }
      .undock-palette-header {
        padding: 14px 16px;
        border-bottom: 1px solid #eeeeee;
      }
      .undock-palette-input {
        width: 100%;
        border: none;
        outline: none;
        font-size: 15px;
        color: #202124;
        background: transparent;
      }
      .undock-palette-list {
        max-height: 320px;
        overflow-y: auto;
        padding: 6px 0;
      }
      .undock-palette-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px;
        cursor: pointer;
      }
      .undock-palette-item.active, .undock-palette-item:hover {
        background: #f1f3f4;
      }
      .undock-palette-item-label {
        font-size: 14px;
        font-weight: 500;
        color: #202124;
      }
      .undock-palette-item-desc {
        font-size: 12px;
        color: #5f6368;
        margin-top: 2px;
      }
      .undock-palette-kbd {
        font-size: 11px;
        background: #e8eaed;
        color: #3c4043;
        border-radius: 4px;
        padding: 3px 6px;
        font-family: monospace;
      }
      .undock-palette-empty {
        padding: 20px;
        text-align: center;
        color: #70757a;
        font-size: 13px;
      }
    `;
    document.head?.appendChild(style);
  }
}
