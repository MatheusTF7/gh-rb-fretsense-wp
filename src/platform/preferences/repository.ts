import type { DeviceProfile } from '@/engine/domain';
import { immutableCopy } from '@/engine/domain/immutable';
import { readArray, readBoolean, readChoice, readRecord, readString, requireCondition } from '@/engine/domain/validation';
import { DEFAULT_KEYBOARD, validateMapping } from '../input/mapping';

export interface InterfacePreferences {
  readonly locale: 'pt-BR' | 'en-US';
  readonly theme: 'dark' | 'light' | 'system';
  readonly reducedMotion: boolean;
}
export interface PreferencesData {
  readonly schemaVersion: 1;
  readonly interface: InterfacePreferences;
  readonly profiles: readonly DeviceProfile[];
  readonly selectedProfileId: string;
}
export type StorageStatus = 'saved' | 'memory' | 'incompatible';
const KEY = 'fretsense.preferences.v1';
const MAX_SIZE = 262_144;

function parse(value: unknown): PreferencesData {
  const data = readRecord(value, 'preferences');
  readChoice(data.schemaVersion, [1], 'preferences.schemaVersion');
  const ui = readRecord(data.interface, 'preferences.interface');
  const profiles = readArray(data.profiles, 'preferences.profiles', 16).map((profile) => validateMapping(profile, true));
  requireCondition(profiles.length > 0 && new Set(profiles.map((profile) => profile.id)).size === profiles.length, 'profiles', 'Profile IDs must be unique.');
  const selectedProfileId = readString(data.selectedProfileId, 'preferences.selectedProfileId');
  requireCondition(profiles.some((profile) => profile.id === selectedProfileId), 'selectedProfileId', 'Selected profile is missing.');
  return immutableCopy({ schemaVersion: 1, profiles, selectedProfileId, interface: {
    locale: readChoice(ui.locale, ['pt-BR', 'en-US'], 'preferences.locale'),
    theme: readChoice(ui.theme, ['dark', 'light', 'system'], 'preferences.theme'),
    reducedMotion: readBoolean(ui.reducedMotion, 'preferences.reducedMotion'),
  } });
}

export class PreferencesRepository {
  private data: PreferencesData = immutableCopy({ schemaVersion: 1,
    interface: { locale: 'pt-BR', theme: 'dark', reducedMotion: false },
    profiles: [DEFAULT_KEYBOARD], selectedProfileId: DEFAULT_KEYBOARD.id,
  });
  private state: StorageStatus = 'saved';
  private blocked = false;

  constructor(private readonly getStorage: () => Storage) {
    let text: string | null;
    try { text = getStorage().getItem(KEY); }
    catch { this.state = 'memory'; return; }
    if (text === null) { this.retrySave(); return; }
    try {
      requireCondition(text.length <= MAX_SIZE, 'preferences', 'Stored data is too large.');
      this.data = parse(JSON.parse(text) as unknown);
    } catch {
      // Preserva o valor original: nenhuma gravação automática sobre dados incompatíveis.
      this.state = 'incompatible';
      this.blocked = true;
    }
  }

  get snapshot(): PreferencesData { return this.data; }
  get status(): StorageStatus { return this.state; }

  saveInterface(preferences: InterfacePreferences): void { this.update({ ...this.data, interface: preferences }); }
  selectProfile(id: string): void { this.update({ ...this.data, selectedProfileId: id }); }
  saveProfile(profile: DeviceProfile): void {
    const current = this.data.profiles.find((item) => item.id === profile.id);
    requireCondition(!current || current.version !== profile.version, 'profile.version', 'Changes require a new profile version.');
    const profiles = this.data.profiles.filter((item) => item.id !== profile.id);
    this.update({ ...this.data, profiles: [...profiles, profile], selectedProfileId: profile.id });
  }

  retrySave(): void {
    if (this.blocked) return;
    try { this.getStorage().setItem(KEY, JSON.stringify(this.data)); this.state = 'saved'; }
    catch { this.state = 'memory'; }
  }

  private update(value: PreferencesData): void {
    const data = parse(value);
    requireCondition(JSON.stringify(data).length <= MAX_SIZE, 'preferences', 'Preferences exceed the size limit.');
    this.data = data;
    this.retrySave();
  }
}

let repository: PreferencesRepository | undefined;
export function getPreferencesRepository(): PreferencesRepository {
  repository ??= new PreferencesRepository(() => window.localStorage);
  return repository;
}
