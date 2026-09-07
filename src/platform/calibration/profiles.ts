import type { CalibrationProfile, DeviceProfile } from '@/engine/domain';
import { parseCalibrationProfile } from '@/engine/session/snapshot';
import { hashSeed } from '@/engine/generation/random';
import { sameReference } from '@/engine/domain/validation';

export type CalibrationContext = CalibrationProfile['context'];
export function captureContext(audioMode: 'enabled' | 'silent', sampleRateHz: number | null, outputId: string | null, outputLabel: string): CalibrationContext {
  const agent = navigator.userAgent;
  return {
    audioMode, sampleRateHz: audioMode === 'silent' ? null : sampleRateHz,
    audioOutputId: audioMode === 'silent' ? null : outputId,
    audioOutputLabel: audioMode === 'silent' ? null : outputLabel.trim() || null,
    browser: `${agent.slice(0, 96)}#${hashSeed(agent).toString(16)}`,
    operatingSystem: (navigator.platform || 'unknown').slice(0, 128),
  };
}

export function sameContext(left: CalibrationContext, right: CalibrationContext): boolean {
  return left.audioMode === right.audioMode && left.sampleRateHz === right.sampleRateHz
    && left.audioOutputId === right.audioOutputId && left.audioOutputLabel === right.audioOutputLabel
    && left.browser === right.browser && left.operatingSystem === right.operatingSystem;
}

export function matchesCalibration(calibration: CalibrationProfile, device: DeviceProfile, context: CalibrationContext): boolean {
  return sameReference(calibration.deviceProfile, device) && sameContext(calibration.context, context);
}

let identityCounter = 0;
export function createCalibration(
  device: DeviceProfile, context: CalibrationContext, method: CalibrationProfile['method'],
  judgmentOffsetMs = 0, visualOffsetMs = 0, sampleCount = 0,
): CalibrationProfile {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${++identityCounter}`;
  return parseCalibrationProfile({ schemaVersion: 1, id: `calibration-${id}`, version: '1.0.0',
    deviceProfile: { id: device.id, version: device.version }, context, method,
    judgmentOffsetMs, visualOffsetMs, sampleCount, createdAtIso: new Date().toISOString(),
  });
}
