import type {
  CalibrationProfile, Chart, DeviceProfile, InputAction, InputControl, SessionMode, SessionSnapshot,
} from '../domain';
import { ENGINE_LIMITS as limits } from '../domain/limits';
import { parseDrillConfig } from '../domain/configuration';
import { immutableCopy } from '../domain/immutable';
import { FRETSENSE_V1_RULE_PROFILE } from '../domain/rules';
import { DEFAULT_HIGHWAY_PRESENTATION, parseHighwayPresentationSnapshot } from '../domain/presentation';
import {
  countFrets, readArray, readChoice, readInteger, readIsoDate, readNoteFrets, readNumber, readRecord,
  readReference, readString, requireCondition, requireSameData, sameReference,
} from '../domain/validation';
import { generateDrill } from '../generation/generator';

export interface SessionIdentity {
  readonly id: string;
  readonly createdAtIso: string;
}

export interface SessionPreparation {
  readonly mode: SessionMode;
  readonly config: unknown;
  readonly device: unknown;
  readonly calibration: unknown;
  readonly presentation?: unknown;
}

function nullableText(value: unknown, path: string): string | null {
  return value === null ? null : readString(value, path, 256);
}

function parseControl(value: unknown, deviceKind: DeviceProfile['kind'], path: string): InputControl {
  const control = readRecord(value, path);
  const kind = readChoice(control.kind, ['key', 'button', 'axis'], `${path}.kind`);
  requireCondition(deviceKind === 'keyboard' ? kind === 'key' : kind !== 'key', path, 'Control kind does not match the device.');
  if (kind === 'key') return { kind, code: readString(control.code, `${path}.code`) };
  const pressThreshold = readNumber(control.pressThreshold, `${path}.pressThreshold`, 0, 1);
  const releaseThreshold = readNumber(control.releaseThreshold, `${path}.releaseThreshold`, 0, 1);
  requireCondition(releaseThreshold < pressThreshold, path, 'Release threshold must be below the press threshold.');
  const index = readInteger(control.index, `${path}.index`, 0, 255);
  if (kind === 'button') return { kind, index, pressThreshold, releaseThreshold };
  return { kind, index, pressThreshold, releaseThreshold, direction: readChoice(control.direction, ['positive', 'negative'], `${path}.direction`) };
}

function parseAction(value: unknown, path: string): InputAction {
  const action = readRecord(value, path);
  const kind = readChoice(action.kind, ['fret', 'strum', 'pause'], `${path}.kind`);
  if (kind === 'fret') return { kind, fret: readChoice(action.fret, ['G', 'R', 'Y', 'B', 'O'], `${path}.fret`) };
  if (kind === 'strum') return { kind, direction: readChoice(action.direction, ['up', 'down', 'unknown'], `${path}.direction`) };
  return { kind };
}

export function parseDeviceProfile(value: unknown): DeviceProfile {
  const device = readRecord(value, 'device');
  const capabilities = readRecord(device.capabilities, 'device.capabilities');
  const kind = readChoice(device.kind, ['keyboard', 'gamepad'], 'device.kind');
  const bindings = readArray(device.bindings, 'device.bindings', limits.maximumBindings).map((value, index) => {
    const path = `device.bindings[${index}]`;
    const binding = readRecord(value, path);
    return { control: parseControl(binding.control, kind, `${path}.control`), action: parseAction(binding.action, `${path}.action`) };
  });
  const controls = new Set<string>();
  for (const { control } of bindings) {
    const key = control.kind === 'key' ? `key:${control.code}`
      : control.kind === 'button' ? `button:${control.index}` : `axis:${control.index}:${control.direction}`;
    requireCondition(!controls.has(key), 'device.bindings', 'A physical control cannot have multiple bindings.');
    controls.add(key);
  }
  const parsed: DeviceProfile = {
    ...readReference(device, 'device'),
    schemaVersion: readChoice(device.schemaVersion, [1], 'device.schemaVersion'),
    label: readString(device.label, 'device.label'), kind,
    hardwareId: nullableText(device.hardwareId, 'device.hardwareId'), bindings,
    capabilities: {
      strum: readChoice(capabilities.strum, ['directional', 'undirected', 'unavailable'], 'device.capabilities.strum'),
      maximumSimultaneousFrets: capabilities.maximumSimultaneousFrets === null ? null
        : readChoice(capabilities.maximumSimultaneousFrets, [1, 2, 3, 4, 5], 'device.capabilities.maximumSimultaneousFrets'),
      confirmedChords: readArray(capabilities.confirmedChords, 'device.capabilities.confirmedChords', 26)
        .map((mask) => readNoteFrets(mask, 'device.capabilities.confirmedChords')),
      distinguishableExtraControls: readArray(capabilities.distinguishableExtraControls, 'device.capabilities.distinguishableExtraControls', limits.maximumBindings)
        .map((control) => readString(control, 'device.capabilities.distinguishableExtraControls')),
    },
    calibrations: readArray(device.calibrations, 'device.calibrations', 64)
      .map((reference) => readReference(reference, 'device.calibrations')),
  };
  const confirmed = new Set<number>();
  for (const mask of parsed.capabilities.confirmedChords) {
    const size = countFrets(mask);
    requireCondition(size >= 2 && (parsed.capabilities.maximumSimultaneousFrets === null
      || size <= parsed.capabilities.maximumSimultaneousFrets), 'device.capabilities.confirmedChords', 'Chord conflicts with device capacity.');
    requireCondition(!confirmed.has(mask), 'device.capabilities.confirmedChords', 'Duplicate confirmed chord.');
    confirmed.add(mask);
  }
  return immutableCopy(parsed);
}

export function parseCalibrationProfile(value: unknown): CalibrationProfile {
  const calibration = readRecord(value, 'calibration');
  const context = readRecord(calibration.context, 'calibration.context');
  const parsed: CalibrationProfile = {
    ...readReference(calibration, 'calibration'),
    schemaVersion: readChoice(calibration.schemaVersion, [1], 'calibration.schemaVersion'),
    deviceProfile: readReference(calibration.deviceProfile, 'calibration.deviceProfile'),
    method: readChoice(calibration.method, ['default', 'manual', 'guided-combined'], 'calibration.method'),
    judgmentOffsetMs: readNumber(calibration.judgmentOffsetMs, 'calibration.judgmentOffsetMs', -limits.maximumOffsetMs, limits.maximumOffsetMs),
    visualOffsetMs: readNumber(calibration.visualOffsetMs, 'calibration.visualOffsetMs', -limits.maximumOffsetMs, limits.maximumOffsetMs),
    sampleCount: readInteger(calibration.sampleCount, 'calibration.sampleCount', 0, limits.maximumInputEvents),
    createdAtIso: readIsoDate(calibration.createdAtIso, 'calibration.createdAtIso'),
    context: {
      audioMode: readChoice(context.audioMode, ['enabled', 'silent'], 'calibration.context.audioMode'),
      audioOutputId: nullableText(context.audioOutputId, 'calibration.context.audioOutputId'),
      audioOutputLabel: nullableText(context.audioOutputLabel, 'calibration.context.audioOutputLabel'),
      browser: readString(context.browser, 'calibration.context.browser'),
      operatingSystem: readString(context.operatingSystem, 'calibration.context.operatingSystem'),
      sampleRateHz: context.sampleRateHz === null ? null : readNumber(context.sampleRateHz, 'calibration.context.sampleRateHz', 8000, 384_000),
    },
  };
  requireCondition(parsed.method !== 'default' || (parsed.judgmentOffsetMs === 0 && parsed.visualOffsetMs === 0 && parsed.sampleCount === 0), 'calibration', 'Default calibration must have zero offsets and samples.');
  requireCondition(parsed.method !== 'guided-combined' || parsed.sampleCount > 0, 'calibration.sampleCount', 'Guided calibration requires samples.');
  return immutableCopy(parsed);
}

export function createSessionSnapshot(
  preparation: SessionPreparation,
  identity: SessionIdentity,
  savedChart?: Chart,
): SessionSnapshot {
  const config = parseDrillConfig(preparation.config);
  const generated = generateDrill(config);
  if (savedChart !== undefined) requireSameData(savedChart, generated, 'chart');
  const device = parseDeviceProfile(preparation.device);
  const calibration = parseCalibrationProfile(preparation.calibration);
  const sourceSchemaVersion = (preparation as { readonly schemaVersion?: unknown }).schemaVersion;
  const sourceVersion = sourceSchemaVersion === undefined ? null
    : readChoice(sourceSchemaVersion, [1, 2], 'snapshot.schemaVersion');
  requireCondition(sourceVersion !== 1 || preparation.presentation === undefined || preparation.presentation === null,
    'presentation', 'Session snapshot v1 cannot contain a presentation.');
  requireCondition(sourceVersion !== 2 || (preparation.presentation !== undefined && preparation.presentation !== null),
    'presentation', 'Session snapshot v2 requires a presentation.');
  const presentation = sourceVersion === 1 ? null : preparation.presentation === undefined
    ? DEFAULT_HIGHWAY_PRESENTATION : parseHighwayPresentationSnapshot(preparation.presentation);
  requireCondition(sameReference(calibration.deviceProfile, device), 'calibration.deviceProfile', 'Calibration belongs to another device profile/version.');
  requireCondition(device.capabilities.maximumSimultaneousFrets === null || device.capabilities.maximumSimultaneousFrets >= config.chordSize,
    'device.capabilities.maximumSimultaneousFrets', 'Device cannot hold this chord size.');
  requireCondition(config.articulation === 'tap'
    || (config.articulation === 'strum' && config.automaticStrum)
    || device.capabilities.strum !== 'unavailable',
    'device.capabilities.strum', 'This exercise requires a strum action.');
  return immutableCopy({
    schemaVersion: (presentation === null ? 1 : 2),
    id: readString(identity.id, 'session.id'),
    createdAtIso: readIsoDate(identity.createdAtIso, 'session.createdAtIso'),
    mode: readChoice(preparation.mode, ['practice', 'assessment'], 'session.mode'),
    config, chart: generated, rules: FRETSENSE_V1_RULE_PROFILE, device, calibration, presentation,
  });
}

/** Repetição só aceita snapshots íntegros da versão atualmente suportada. */
export function repeatSessionSnapshot(previous: SessionSnapshot, identity: SessionIdentity): SessionSnapshot {
  readChoice(previous.schemaVersion, [1, 2], 'snapshot.schemaVersion');
  requireCondition(identity.id !== previous.id, 'session.id', 'A repeat needs a new session ID.');
  requireSameData(previous.rules, FRETSENSE_V1_RULE_PROFILE, 'snapshot.rules');
  return createSessionSnapshot(previous, identity, previous.chart);
}

export function varySessionSnapshot(previous: SessionSnapshot, identity: SessionIdentity, seed: string): SessionSnapshot {
  // Primeiro verifica a origem, incluindo a chart e as regras que serão preservadas.
  const repeated = repeatSessionSnapshot(previous, identity);
  readString(seed, 'config.seed');
  requireCondition(seed !== previous.config.seed, 'config.seed', 'A variation needs a different seed.');
  return createSessionSnapshot({ ...repeated, config: { ...repeated.config, seed } }, identity);
}
