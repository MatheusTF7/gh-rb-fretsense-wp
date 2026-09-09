import type { WebHidConnection, WebHidDeviceLike } from './contracts';
import { recognizeInputDevice } from './recognition';

interface HidNavigator extends EventTarget {
  getDevices(): Promise<WebHidDeviceLike[]>;
  requestDevice(options: { filters: readonly Record<string, number>[] }): Promise<WebHidDeviceLike[]>;
}

let connectionSequence = 0;
const connectionIds = new WeakMap<WebHidDeviceLike, string>();

function api(): HidNavigator | null {
  return (navigator as Navigator & { readonly hid?: HidNavigator }).hid ?? null;
}

export function webHidAvailable(): boolean {
  return globalThis.isSecureContext === true && api() !== null;
}

export function webHidHardwareId(device: WebHidDeviceLike): string {
  const hex = (value: number) => value.toString(16).padStart(4, '0');
  return `webhid:${hex(device.vendorId)}:${hex(device.productId)}:${device.productName.trim().slice(0, 128)}`;
}

function connection(device: WebHidDeviceLike): WebHidConnection {
  let connectionId = connectionIds.get(device);
  if (!connectionId) {
    connectionId = `webhid-connection:${++connectionSequence}`;
    connectionIds.set(device, connectionId);
  }
  return Object.freeze({
    kind: 'webhid', device, connectionId, hardwareId: webHidHardwareId(device),
    recognition: recognizeInputDevice({ productName: device.productName, vendorId: device.vendorId, productId: device.productId }),
  });
}

export class WebHidDiscovery {
  private readonly opened = new Set<WebHidDeviceLike>();
  get available(): boolean { return webHidAvailable(); }

  async list(): Promise<readonly WebHidConnection[]> {
    const hid = api();
    if (!webHidAvailable() || !hid) throw new Error('WebHID unavailable');
    return (await hid.getDevices()).map(connection);
  }

  async request(): Promise<readonly WebHidConnection[]> {
    const hid = api();
    if (!webHidAvailable() || !hid) throw new Error('WebHID unavailable');
    return (await hid.requestDevice({ filters: [] })).map(connection);
  }

  async open(selected: WebHidConnection): Promise<WebHidConnection> {
    if (!selected.device.opened) await selected.device.open();
    this.opened.add(selected.device);
    return selected;
  }

  async matching(hardwareId: string | null): Promise<WebHidConnection | null> {
    if (!hardwareId) return null;
    const matches = (await this.list()).filter((item) => item.hardwareId === hardwareId);
    return matches.length === 1 ? this.open(matches[0]!) : null;
  }

  dispose(): void {
    for (const device of this.opened) if (device.opened) void device.close().catch(() => undefined);
    this.opened.clear();
  }
}
