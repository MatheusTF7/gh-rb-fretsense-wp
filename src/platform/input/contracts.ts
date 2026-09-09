import type { DeviceProfile, FretMask, InputControl, InterruptionReason, NormalizedInputEvent } from '@/engine/domain';

export type InputInterruption = InterruptionReason | 'context-changed' | 'unavailable';
export interface GamepadConnection {
  readonly index: number;
  readonly hardwareId: string;
  readonly connectionId: string;
  readonly recognition: DeviceProfile['recognition'];
}
export interface WebHidDeviceLike extends EventTarget {
  readonly opened: boolean;
  readonly productName: string;
  readonly vendorId: number;
  readonly productId: number;
  open(): Promise<void>;
  close(): Promise<void>;
}
export interface WebHidConnection {
  readonly kind: 'webhid';
  readonly hardwareId: string;
  readonly connectionId: string;
  readonly device: WebHidDeviceLike;
  readonly recognition: DeviceProfile['recognition'];
}
export interface InputTimeline {
  /** Número preserva clientes de inspeção; InputTime também informa a fonte escolhida. */
  sample(observedAtMs: number, deviceTimestampMs?: number): number | InputTime;
}
export interface InputTime {
  readonly sessionTimeMs: number;
  readonly timeSource: NormalizedInputEvent['timeSource'];
}
export interface InputCallbacks {
  onEvent(event: NormalizedInputEvent): void;
  onBaseline(frets: FretMask): void;
  onInterrupt(reason: InputInterruption): void;
  onControl?(control: InputControl): void;
}
export interface InputAdapter {
  readonly profile: DeviceProfile;
  readonly capturing: boolean;
  readonly available: boolean;
  start(): void;
  setMode(mode: 'baseline' | 'events'): void;
  clear(): void;
  stop(): void;
  dispose(): void;
}
export interface AdapterOptions extends InputCallbacks {
  readonly profile: DeviceProfile;
  readonly scope: HTMLElement;
  readonly timeline: InputTimeline;
  readonly gamepad?: GamepadConnection;
  readonly webhid?: WebHidConnection;
  /** Permite ao vínculo de sessão suprimir ataques durante contagem/pausa. */
  readonly getMode?: (observedAtMs: number) => 'baseline' | 'events';
  readonly canStart?: () => boolean;
  /** Continuação da mesma tentativa após substituir um adaptador desconectado. */
  readonly sequenceStart?: number;
}
