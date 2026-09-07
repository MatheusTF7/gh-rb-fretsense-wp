import { FRET_BITS } from '@/engine/domain/music';
import { readInteger } from '@/engine/domain/validation';
import type { DeviceProfile, FretMask, InputControl, NormalizedInputEvent } from '@/engine/domain';
import { validateMapping, controlId } from './mapping';
import type { AdapterOptions, InputAdapter, InputInterruption } from './contracts';

let keyboardConnection = 0;

/** Uma captura exclusiva, instalada somente por ação explícita no escopo focável. */
export class BrowserInputAdapter implements InputAdapter {
  private static owner: BrowserInputAdapter | null = null;
  readonly profile: DeviceProfile;
  private active = false;
  private disposed = false;
  private mode: 'baseline' | 'events' = 'events';
  private frame: number | null = null;
  private sequence = 0;
  private lastTime = 0;
  private mask: FretMask = 0;
  private states: boolean[] = [];
  private readonly keys = new Set<string>();
  private rawStates = new Map<string, boolean>();
  private readonly axisReady = new Map<number, boolean>();
  private initialized = false;
  private readonly connectionId: string;

  constructor(private readonly options: AdapterOptions) {
    this.profile = validateMapping(options.profile);
    this.sequence = readInteger(options.sequenceStart ?? 0, 'input.sequenceStart', 0, Number.MAX_SAFE_INTEGER);
    this.connectionId = options.gamepad?.connectionId ?? `keyboard-connection:${++keyboardConnection}`;
    if (this.profile.kind === 'gamepad' && (!options.gamepad || options.gamepad.hardwareId !== this.profile.hardwareId)) {
      throw new Error('Select a matching gamepad connection');
    }
  }

  get capturing(): boolean { return this.active; }
  get available(): boolean {
    if (this.disposed) return false;
    if (this.profile.kind === 'keyboard') return true;
    try { return this.readGamepad() !== null; } catch { return false; }
  }

  start(): void {
    if (this.active) return;
    if (this.disposed) throw new Error('Disposed input adapter');
    if (!this.available || document.hidden || !document.hasFocus() || this.options.canStart?.() === false) {
      this.options.onInterrupt('unavailable'); return;
    }
    BrowserInputAdapter.owner?.interrupt('context-changed');
    BrowserInputAdapter.owner = this;
    this.clear();
    this.active = true;
    this.options.scope.focus({ preventScroll: true });
    window.addEventListener('blur', this.blur);
    document.addEventListener('visibilitychange', this.visibility);
    this.options.scope.addEventListener('focusout', this.focusOut);
    if (this.profile.kind === 'keyboard') {
      window.addEventListener('keydown', this.keyDown);
      window.addEventListener('keyup', this.keyUp);
    } else {
      window.addEventListener('gamepaddisconnected', this.disconnected);
      this.poll();
    }
  }

  setMode(mode: 'baseline' | 'events'): void { this.mode = mode; }

  clear(): void {
    this.mask = 0;
    this.states = [];
    this.keys.clear();
    this.rawStates.clear();
    this.axisReady.clear();
    this.initialized = false;
    this.options.onBaseline(0);
  }

  stop(): void {
    this.active = false;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    window.removeEventListener('blur', this.blur);
    document.removeEventListener('visibilitychange', this.visibility);
    this.options.scope.removeEventListener('focusout', this.focusOut);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('gamepaddisconnected', this.disconnected);
    if (BrowserInputAdapter.owner === this) BrowserInputAdapter.owner = null;
    this.clear();
  }

  dispose(): void { this.stop(); this.disposed = true; }

  private interrupt(reason: InputInterruption): void {
    if (!this.active) return;
    this.stop();
    this.options.onInterrupt(reason);
  }

  private readonly blur = () => this.interrupt('focus-lost');
  private readonly visibility = () => { if (document.hidden) this.interrupt('page-hidden'); };
  private readonly focusOut = (event: FocusEvent) => {
    if (!(event.relatedTarget instanceof Node) || !this.options.scope.contains(event.relatedTarget)) this.interrupt('focus-lost');
  };
  private readonly disconnected = (event: GamepadEvent) => {
    if (event.gamepad.index === this.options.gamepad?.index) this.interrupt('device-disconnected');
  };

  private accepts(event: KeyboardEvent): boolean {
    const target = event.target;
    return target instanceof Element && this.options.scope.contains(target)
      && !target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')
      && !event.isComposing && !event.ctrlKey && !event.metaKey && !event.altKey;
  }

  private readonly keyDown = (event: KeyboardEvent) => {
    const observedAtMs = performance.now();
    if (!this.active || !this.accepts(event) || event.code === 'Tab') return;
    if (['MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(event.code)) return;
    const mapped = this.profile.bindings.some(({ control }) => control.kind === 'key' && control.code === event.code);
    if (mapped || this.options.onControl) event.preventDefault();
    if (event.repeat || this.keys.has(event.code) || !event.code) return;
    this.keys.add(event.code);
    try {
      if (this.options.onControl) this.options.onControl({ kind: 'key', code: event.code });
      if (this.active) this.process(this.profile.bindings.map(({ control }) => control.kind === 'key' && this.keys.has(control.code)), false, observedAtMs, event.timeStamp);
    } catch { this.interrupt('unavailable'); }
  };

  private readonly keyUp = (event: KeyboardEvent) => {
    const observedAtMs = performance.now();
    if (!this.active || !this.keys.delete(event.code)) return;
    if (this.accepts(event)) event.preventDefault();
    try { this.process(this.profile.bindings.map(({ control }) => control.kind === 'key' && this.keys.has(control.code)), false, observedAtMs, event.timeStamp); }
    catch { this.interrupt('unavailable'); }
  };

  private readGamepad(): Gamepad | null {
    const connection = this.options.gamepad;
    if (!connection || typeof navigator.getGamepads !== 'function') return null;
    const device = navigator.getGamepads()[connection.index];
    return device?.connected && device.id === connection.hardwareId ? device : null;
  }

  private pressed(control: InputControl, device: Gamepad, previous: boolean): boolean {
    if (control.kind === 'key') return false;
    const value = control.kind === 'button' ? device.buttons[control.index]?.value
      : (device.axes[control.index] ?? NaN) * (control.direction === 'positive' ? 1 : -1);
    if (value === undefined || !Number.isFinite(value) || value > 1 || value < (control.kind === 'button' ? 0 : -1)) throw new Error('Control unavailable');
    return previous ? value > control.releaseThreshold : value >= control.pressThreshold;
  }

  private readonly poll = () => {
    this.frame = null;
    if (!this.active) return;
    try {
      const device = this.readGamepad();
      const observedAtMs = performance.now();
      if (!device) { this.interrupt('device-disconnected'); return; }
      const states = this.profile.bindings.map(({ control }, index) => this.pressed(control, device, this.states[index] ?? false));
      if (this.options.onControl) {
        const controls: InputControl[] = [];
        for (let index = 0; index < Math.min(device.buttons.length, 256); index++) {
          controls.push({ kind: 'button', index, pressThreshold: 0.6, releaseThreshold: 0.3 });
        }
        for (let index = 0; index < Math.min(device.axes.length, 256); index++) {
          for (const direction of ['positive', 'negative'] as const) controls.push({ kind: 'axis', index, direction, pressThreshold: 0.6, releaseThreshold: 0.3 });
        }
        for (const control of controls) {
          const key = controlId(control);
          const previous = this.rawStates.get(key) ?? false;
          const pressed = this.pressed(control, device, previous);
          this.rawStates.set(key, pressed);
          if (this.initialized && pressed && !previous) {
            this.options.onControl(control);
            if (!this.active) return;
          }
        }
      }
      this.process(states, !this.initialized, observedAtMs, device.timestamp);
      if (!this.active) return;
      for (const { control } of this.profile.bindings) {
        if (control.kind !== 'axis') continue;
        const releases = this.profile.bindings.flatMap((binding) => binding.control.kind === 'axis'
          && binding.control.index === control.index ? [binding.control.releaseThreshold] : []);
        const magnitude = Math.abs(device.axes[control.index] ?? 1);
        if (magnitude <= Math.min(...releases)) this.axisReady.set(control.index, true);
        else if (this.profile.bindings.some((binding, index) => binding.control.kind === 'axis'
          && binding.control.index === control.index && states[index])) this.axisReady.set(control.index, false);
      }
      this.initialized = true;
    } catch { this.interrupt('unavailable'); }
    if (this.active) this.frame = requestAnimationFrame(this.poll);
  };

  private process(states: boolean[], baseline: boolean, observedAtMs: number, deviceTimestampMs?: number): void {
    let nextMask = 0;
    const strums: NonNullable<NormalizedInputEvent['strum']>[] = [];
    let pause = false;
    this.profile.bindings.forEach(({ action, control }, index) => {
      if (!states[index]) return;
      if (action.kind === 'fret') nextMask |= FRET_BITS[action.fret];
      if (!baseline && !this.states[index] && (control.kind !== 'axis' || this.axisReady.get(control.index))) {
        if (action.kind === 'pause') pause = true;
        if (action.kind === 'strum') strums.push(action.direction);
      }
    });
    this.states = states;
    if (pause) { this.interrupt('user-pause'); return; }
    const previousMask = this.mask;
    this.mask = nextMask as FretMask;
    if (baseline || (this.options.getMode?.(observedAtMs) ?? this.mode) === 'baseline') { this.options.onBaseline(this.mask); return; }
    if (previousMask === this.mask && strums.length === 0) return;
    let time: number;
    let timeSource: NormalizedInputEvent['timeSource'] = 'observation';
    try {
      const stamp = this.options.timeline.sample(observedAtMs, deviceTimestampMs);
      time = typeof stamp === 'number' ? stamp : stamp.sessionTimeMs;
      if (typeof stamp !== 'number') timeSource = stamp.timeSource;
    }
    catch { this.interrupt('input-timing-invalid'); return; }
    if (!Number.isFinite(time) || time < this.lastTime || time < 0 || time > Number.MAX_SAFE_INTEGER) { this.interrupt('input-timing-invalid'); return; }
    this.lastTime = time;
    const attacks = strums.length > 0 ? strums : [null];
    for (const [index, strum] of attacks.entries()) {
      if (!this.active) break;
      this.options.onEvent(Object.freeze({ sequence: this.sequence++, sessionTimeMs: time, timeSource,
        activeFrets: this.mask, pressedFrets: (index === 0 ? this.mask & ~previousMask & 31 : 0) as FretMask,
        releasedFrets: (index === 0 ? previousMask & ~this.mask & 31 : 0) as FretMask, strum,
        source: Object.freeze({ kind: this.profile.kind, deviceProfileId: this.profile.id, connectionId: this.connectionId }),
      }));
    }
  }
}
