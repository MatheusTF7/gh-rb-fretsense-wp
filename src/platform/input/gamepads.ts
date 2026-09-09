import type { GamepadConnection } from './contracts';
import { recognizeInputDevice } from './recognition';

let connectionSequence = 0;

/** Descoberta só existe enquanto seu proprietário mantiver este objeto ativo. */
export class GamepadDiscovery {
  private readonly connections = new Map<number, GamepadConnection>();
  private readonly disconnected = (event: GamepadEvent) => { this.connections.delete(event.gamepad.index); };

  constructor() { window.addEventListener('gamepaddisconnected', this.disconnected); }

  list(): readonly GamepadConnection[] {
    if (typeof navigator.getGamepads !== 'function') throw new Error('Gamepad API unavailable');
    const devices = navigator.getGamepads();
    const present = new Set<number>();
    for (const device of devices) {
      if (!device?.connected) continue;
      present.add(device.index);
      if (this.connections.get(device.index)?.hardwareId !== device.id) {
        this.connections.set(device.index, Object.freeze({ index: device.index, hardwareId: device.id,
          connectionId: `gamepad-connection:${++connectionSequence}`,
          recognition: recognizeInputDevice({ productName: device.id }),
        }));
      }
    }
    for (const index of this.connections.keys()) if (!present.has(index)) this.connections.delete(index);
    return [...this.connections.values()];
  }

  dispose(): void {
    window.removeEventListener('gamepaddisconnected', this.disconnected);
    this.connections.clear();
  }
}
