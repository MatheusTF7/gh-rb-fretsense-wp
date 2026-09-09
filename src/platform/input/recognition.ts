import type { DeviceRecognition } from '@/engine/domain';

const GH_NAMES = /\b(guitar[ -]?hero|redoctane|xplorer|les paul|world tour|warriors of rock)\b/i;
const RB_NAMES = /\b(rock[ -]?band|harmonix|stratocaster|fender[^\n]{0,24}jaguar|jaguar[^\n]{0,24}guitar)\b/i;
const GUITAR_NAMES = /\b(guitar|riffmaster)\b/i;

export interface ReportedDeviceIdentity {
  readonly productName: string | null;
  readonly vendorId?: number | null;
  readonly productId?: number | null;
}

/** Classifica somente palavras presentes no nome reportado; VID/PID ficam informativos. */
export function recognizeInputDevice(identity: ReportedDeviceIdentity): DeviceRecognition {
  const productName = identity.productName?.trim().slice(0, 256) || null;
  const family = productName && GH_NAMES.test(productName) ? 'guitar-hero'
    : productName && RB_NAMES.test(productName) ? 'rock-band'
      : productName && GUITAR_NAMES.test(productName) ? 'other' : null;
  return Object.freeze({
    category: family ? 'guitar' : productName && /\b(gamepad|controller|joystick)\b/i.test(productName) ? 'gamepad' : 'unknown',
    family,
    basis: family ? 'reported-name' : 'unrecognized',
    productName,
    vendorId: identity.vendorId ?? null,
    productId: identity.productId ?? null,
  });
}

export function recognitionLabel(recognition: DeviceRecognition): string {
  if (recognition.family === 'guitar-hero') return 'Guitar Hero';
  if (recognition.family === 'rock-band') return 'Rock Band';
  if (recognition.category === 'guitar') return 'Guitar controller';
  return recognition.category === 'gamepad' ? 'Gamepad' : 'Unrecognized device';
}
