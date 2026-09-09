import type { DeviceProfile, InputAction, InputControl } from '@/engine/domain';
import { parseDeviceProfile } from '@/engine/session/snapshot';
import { requireCondition } from '@/engine/domain/validation';

export const MAPPING_ACTIONS: readonly InputAction[] = [
  ...(['G', 'R', 'Y', 'B', 'O'] as const).map((fret) => ({ kind: 'fret' as const, fret })),
  { kind: 'strum', direction: 'up' }, { kind: 'strum', direction: 'down' },
  { kind: 'strum', direction: 'unknown' }, { kind: 'pause' },
];

export function actionId(action: InputAction): string {
  return action.kind === 'fret' ? action.fret : action.kind === 'strum' ? action.direction : 'pause';
}

export function controlId(control: InputControl): string {
  return control.kind === 'key' ? control.code : control.kind === 'button'
    ? `button:${control.index}` : control.kind === 'axis' ? `axis:${control.index}:${control.direction}`
      : `hid:${control.reportId}:${control.byteIndex}:${control.bitIndex}:${control.activeValue}`;
}

/** Capacidades de direção vêm de ações distintas, não do nome/modelo do controle. */
export function validateMapping(value: unknown, requirePlayable = false): DeviceProfile {
  const profile = parseDeviceProfile(value);
  const actions = new Set<string>();
  for (const binding of profile.bindings) {
    const id = actionId(binding.action);
    requireCondition(!actions.has(id), 'bindings', 'Each action must have a single control.');
    actions.add(id);
    if (binding.control.kind === 'key') {
      requireCondition(!['Tab', 'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(binding.control.code),
        'bindings', 'Reserved navigation/modifier key.');
    }
  }
  requireCondition(!actions.has('unknown') || (!actions.has('up') && !actions.has('down')),
    'bindings', 'Choose directional or undirected strum.');
  const strum = actions.has('unknown') || actions.has('up') || actions.has('down')
    ? actions.has('unknown') ? 'undirected' : 'directional' : 'unavailable';
  requireCondition(profile.capabilities.strum === strum, 'capabilities.strum', 'Capability differs from mapping.');
  if (requirePlayable) {
    requireCondition(['G', 'R', 'Y', 'B', 'O', 'pause'].every((id) => actions.has(id)),
      'bindings', 'Map five frets and pause.');
  }
  return profile;
}

export function withBindings(profile: DeviceProfile, bindings: DeviceProfile['bindings']): DeviceProfile {
  const strums = bindings.filter((binding) => binding.action.kind === 'strum');
  return validateMapping({ ...profile, bindings, calibrations: [], capabilities: {
    strum: strums.length === 0 ? 'unavailable'
      : strums.some((binding) => binding.action.kind === 'strum' && binding.action.direction === 'unknown') ? 'undirected' : 'directional',
    maximumSimultaneousFrets: null, confirmedChords: [], distinguishableExtraControls: [],
  } });
}

export const DEFAULT_KEYBOARD = validateMapping({
  schemaVersion: 1, id: 'keyboard-default', version: '1.0.0', label: 'Keyboard', kind: 'keyboard', hardwareId: null,
  recognition: { category: 'keyboard', family: null, basis: 'built-in', productName: null, vendorId: null, productId: null },
  bindings: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'ArrowUp', 'ArrowDown', '', 'Escape']
    .flatMap((code, index) => code ? [{ control: { kind: 'key', code }, action: MAPPING_ACTIONS[index] }] : []),
  capabilities: { strum: 'directional', maximumSimultaneousFrets: null, confirmedChords: [], distinguishableExtraControls: [] },
  calibrations: [],
}, true);
