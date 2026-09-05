export interface WindowCoordinates {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface UndockState {
  isUndocked: boolean;
  activeAdapterName: string | null;
  lastSyncTimestamp: number;
  windowCoordinates?: WindowCoordinates;
}

export type ActionProxyHandler = (action: string, targetEl: HTMLElement) => boolean;

export interface UndockEventMessage {
  type: 'UNDOCK_TOGGLE' | 'UNDOCK_STATE_CHANGE' | 'UNDOCK_PING' | 'UNDOCK_PONG';
  tabId?: number;
  payload?: any;
}
