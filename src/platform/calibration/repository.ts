import type { CalibrationProfile } from '@/engine/domain';
import { parseCalibrationProfile } from '@/engine/session/snapshot';
import { readArray, readChoice, readRecord, requireCondition, sameReference } from '@/engine/domain/validation';
import { sameContext } from './profiles';
import type { StorageStatus } from '../preferences/repository';

const KEY = 'fretsense.calibrations.v1';
const MAX_SIZE = 262_144;

export class CalibrationRepository {
  private records: readonly CalibrationProfile[] = Object.freeze([]);
  private state: StorageStatus = 'saved';
  private blocked = false;
  constructor(private readonly getStorage: () => Storage) {
    let text: string | null;
    try { text = getStorage().getItem(KEY); } catch { this.state = 'memory'; return; }
    if (text === null) return;
    try {
      requireCondition(text.length <= MAX_SIZE, 'calibrations', 'Stored data too large.');
      const data = readRecord(JSON.parse(text) as unknown, 'calibrations');
      readChoice(data.schemaVersion, [1], 'calibrations.schemaVersion');
      const records = readArray(data.records, 'calibrations.records', 64).map(parseCalibrationProfile);
      requireCondition(new Set(records.map((record) => record.id)).size === records.length, 'calibrations', 'Duplicate IDs.');
      records.forEach((record, index) => requireCondition(!records.slice(0, index).some((previous) => this.sameSlot(previous, record)), 'calibrations', 'Duplicate contexts.'));
      this.records = Object.freeze(records);
    } catch { this.state = 'incompatible'; this.blocked = true; }
  }
  get snapshot(): readonly CalibrationProfile[] { return this.records; }
  get status(): StorageStatus { return this.state; }
  save(value: CalibrationProfile): void {
    const calibration = parseCalibrationProfile(value);
    const records = [...this.records.filter((record) => !this.sameSlot(record, calibration)), calibration];
    requireCondition(new Set(records.map((record) => record.id)).size === records.length, 'calibrations', 'Duplicate IDs.');
    requireCondition(records.length <= 64 && JSON.stringify(records).length + 64 <= MAX_SIZE, 'calibrations', 'Calibration storage limit reached.');
    this.records = Object.freeze(records);
    this.retrySave();
  }
  retrySave(): void {
    if (this.blocked) return;
    try { this.getStorage().setItem(KEY, JSON.stringify({ schemaVersion: 1, records: this.records })); this.state = 'saved'; }
    catch { this.state = 'memory'; }
  }
  private sameSlot(left: CalibrationProfile, right: CalibrationProfile): boolean {
    return sameReference(left.deviceProfile, right.deviceProfile) && sameContext(left.context, right.context);
  }
}

let repository: CalibrationRepository | undefined;
export function getCalibrationRepository(): CalibrationRepository {
  repository ??= new CalibrationRepository(() => window.localStorage);
  return repository;
}
