import { immutableCopy, requireCondition } from '@/engine/domain';
import {
  SESSION_DATABASE_VERSION,
  parseSessionSummary,
  parseStoredSessionRecord,
  summarizeSession,
  type SessionListPage,
  type SessionListRequest,
  type SessionRepository,
  type SessionStorageIssue,
  type SessionStorageState,
  type SessionSummary,
  type StoredSessionRecord,
} from './contracts';
import {
  parseStoredAdaptationRecord,
  type AdaptationRepository,
  type StoredAdaptationRecord,
} from './adaptation-contracts';

const DATABASE_NAME = 'fretsense-sessions';
const DATABASE_VERSION = SESSION_DATABASE_VERSION;
const RECORD_STORE = 'sessions';
const SUMMARY_STORE = 'session-summaries';
const ADAPTATION_STORE = 'recommendations';
const SOURCE_SESSION_INDEX = 'source-session';

type DatabaseFactory = Pick<IDBFactory, 'open'>;

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

function failureIssue(error: unknown, fallback: SessionStorageIssue): SessionStorageIssue {
  return error instanceof DOMException && error.name === 'QuotaExceededError' ? 'quota-exceeded' : fallback;
}

function sameData(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class IndexedDbSessionRepository implements SessionRepository, AdaptationRepository {
  private readonly memory = new Map<string, StoredSessionRecord>();
  private readonly adaptationMemory = new Map<string, StoredAdaptationRecord>();
  private readonly persistedIds = new Set<string>();
  private databasePromise: Promise<IDBDatabase> | null = null;
  private storageState: SessionStorageState = { mode: 'persistent', issue: null };

  constructor(private readonly getFactory: () => DatabaseFactory | null) {}

  get state(): SessionStorageState { return immutableCopy(this.storageState); }

  async save(record: StoredSessionRecord): Promise<SessionStorageState> {
    let accepted: StoredSessionRecord;
    try {
      accepted = parseStoredSessionRecord(record);
    } catch {
      this.memory.set(record.id, record);
      this.setMemory('write-failed');
      return this.state;
    }
    const memoryRecord = this.memory.get(accepted.id);
    if (memoryRecord && !sameData(memoryRecord, accepted)) {
      this.setMemory('id-conflict');
      return this.state;
    }
    this.memory.set(accepted.id, accepted);
    try {
      const database = await this.openDatabase();
      const expectedSummary = summarizeSession(accepted);
      const readTransaction = database.transaction([RECORD_STORE, SUMMARY_STORE], 'readonly');
      const [existing, existingSummary] = await Promise.all([
        requestValue(readTransaction.objectStore(RECORD_STORE).get(accepted.id)),
        requestValue(readTransaction.objectStore(SUMMARY_STORE).get(accepted.id)),
      ]);
      if ((existing !== undefined && !sameData(existing, accepted))
        || (existingSummary !== undefined && !sameData(existingSummary, expectedSummary))) {
        this.setMemory('id-conflict');
        return this.state;
      }
      if (existing === undefined || existingSummary === undefined) {
        const transaction = database.transaction([RECORD_STORE, SUMMARY_STORE], 'readwrite');
        transaction.objectStore(RECORD_STORE).put(accepted);
        transaction.objectStore(SUMMARY_STORE).put(expectedSummary);
        await transactionDone(transaction);
      }
      this.persistedIds.add(accepted.id);
      this.storageState = { mode: 'persistent', issue: null };
    } catch (error) {
      this.setMemory(failureIssue(error, this.storageState.issue === 'migration-failed' ? 'migration-failed' : 'write-failed'));
    }
    return this.state;
  }

  async get(id: string): Promise<StoredSessionRecord | null> {
    const normalizedId = String(id);
    const inMemory = this.memory.get(normalizedId);
    if (inMemory) return inMemory;
    try {
      const database = await this.openDatabase();
      const value = await requestValue(database.transaction(RECORD_STORE, 'readonly').objectStore(RECORD_STORE).get(normalizedId));
      if (value === undefined) return null;
      const record = parseStoredSessionRecord(value);
      this.memory.set(record.id, record);
      this.persistedIds.add(record.id);
      return record;
    } catch (error) {
      if (error instanceof DOMException || error instanceof Error && error.message.startsWith('IndexedDB')) {
        this.setMemory(this.storageState.issue ?? 'unavailable');
      } else {
        this.storageState = { mode: this.storageState.mode, issue: 'incompatible-records' };
      }
      return null;
    }
  }

  async list(request: SessionListRequest): Promise<SessionListPage> {
    const page = Math.max(1, Math.trunc(request.page));
    const pageSize = Math.min(50, Math.max(1, Math.trunc(request.pageSize)));
    let summaries: SessionSummary[] = [];
    let incompatibleCount = 0;
    try {
      const database = await this.openDatabase();
      const values = await requestValue(database.transaction(SUMMARY_STORE, 'readonly').objectStore(SUMMARY_STORE).getAll());
      for (const value of values) {
        try { summaries.push(parseSessionSummary(value)); }
        catch { incompatibleCount += 1; }
      }
      const memorySummaries = [...this.memory.values()].map(summarizeSession);
      const persistentIds = new Set(summaries.map((item) => item.id));
      summaries.push(...memorySummaries.filter((item) => !persistentIds.has(item.id)));
      if (incompatibleCount > 0) this.storageState = { mode: 'persistent', issue: 'incompatible-records' };
    } catch {
      this.setMemory(this.storageState.issue ?? 'unavailable');
      summaries = [...this.memory.values()].map(summarizeSession);
    }
    const filtered = summaries
      .filter((item) => !request.filters.mode || item.mode === request.filters.mode)
      .filter((item) => !request.filters.endingState || item.endingState === request.filters.endingState)
      .filter((item) => !request.filters.technique || item.technique === request.filters.technique)
      .filter((item) => !request.filters.level || item.level === request.filters.level)
      .filter((item) => !request.filters.endedAtOrAfterIso
        || item.endedAtIso >= request.filters.endedAtOrAfterIso)
      .filter((item) => !request.filters.endedBeforeIso
        || item.endedAtIso < request.filters.endedBeforeIso)
      .sort((left, right) => right.endedAtIso.localeCompare(left.endedAtIso));
    const start = (page - 1) * pageSize;
    return immutableCopy({ records: filtered.slice(start, start + pageSize), page, pageSize,
      total: filtered.length, incompatibleCount });
  }

  async saveAdaptation(record: StoredAdaptationRecord): Promise<boolean> {
    let accepted: StoredAdaptationRecord;
    try { accepted = parseStoredAdaptationRecord(record); }
    catch {
      this.setMemory('write-failed');
      return false;
    }
    const memoryRecord = this.adaptationMemory.get(accepted.id);
    if (memoryRecord && memoryRecord.decision !== 'pending' && memoryRecord.decision !== 'adjusting'
      && !sameData(memoryRecord, accepted)) {
      if (accepted.decision === 'pending' && sameData(memoryRecord.recommendation, accepted.recommendation)) return true;
      this.setMemory('id-conflict');
      return false;
    }
    this.adaptationMemory.set(accepted.id, accepted);
    try {
      const database = await this.openDatabase();
      const store = database.transaction(ADAPTATION_STORE, 'readonly').objectStore(ADAPTATION_STORE);
      const rawExisting = await requestValue(store.get(accepted.id));
      if (rawExisting !== undefined) {
        const existing = parseStoredAdaptationRecord(rawExisting);
        const isFinal = existing.decision !== 'pending' && existing.decision !== 'adjusting';
        if (isFinal && !sameData(existing, accepted)) {
          this.adaptationMemory.set(existing.id, existing);
          if (accepted.decision === 'pending' && sameData(existing.recommendation, accepted.recommendation)) return true;
          this.setMemory('id-conflict');
          return false;
        }
      }
      const transaction = database.transaction(ADAPTATION_STORE, 'readwrite');
      transaction.objectStore(ADAPTATION_STORE).put(accepted);
      await transactionDone(transaction);
      return true;
    } catch (error) {
      this.setMemory(failureIssue(error, 'write-failed'));
      return true;
    }
  }

  async getAdaptation(id: string): Promise<StoredAdaptationRecord | null> {
    const memoryRecord = this.adaptationMemory.get(id);
    if (memoryRecord) return memoryRecord;
    try {
      const database = await this.openDatabase();
      const value = await requestValue(database.transaction(ADAPTATION_STORE, 'readonly')
        .objectStore(ADAPTATION_STORE).get(id));
      if (value === undefined) return null;
      const record = parseStoredAdaptationRecord(value);
      this.adaptationMemory.set(record.id, record);
      return record;
    } catch {
      this.storageState = { mode: this.storageState.mode, issue: 'incompatible-records' };
      return null;
    }
  }

  async getAdaptationForSession(sessionId: string): Promise<StoredAdaptationRecord | null> {
    const memoryRecord = [...this.adaptationMemory.values()].find((item) => item.sourceSessionId === sessionId);
    if (memoryRecord) return memoryRecord;
    try {
      const database = await this.openDatabase();
      const store = database.transaction(ADAPTATION_STORE, 'readonly').objectStore(ADAPTATION_STORE);
      const value = await requestValue(store.index(SOURCE_SESSION_INDEX).get(sessionId));
      if (value === undefined) return null;
      const record = parseStoredAdaptationRecord(value);
      this.adaptationMemory.set(record.id, record);
      return record;
    } catch {
      this.storageState = { mode: this.storageState.mode, issue: 'incompatible-records' };
      return null;
    }
  }

  async remove(id: string): Promise<boolean> {
    requireCondition(id.trim().length > 0, 'session.id', 'Session ID is required.');
    const memoryRecord = this.memory.get(id);
    const existedInMemory = this.memory.delete(id);
    const memoryAdaptation = [...this.adaptationMemory.values()].find((item) => item.sourceSessionId === id);
    if (memoryAdaptation) this.adaptationMemory.delete(memoryAdaptation.id);
    if (!this.persistedIds.has(id) && this.storageState.mode === 'memory') return existedInMemory;
    try {
      const database = await this.openDatabase();
      const existing = await requestValue(database.transaction(RECORD_STORE, 'readonly').objectStore(RECORD_STORE).getKey(id));
      if (existing === undefined) return existedInMemory;
      const adaptationKey = await requestValue(database.transaction(ADAPTATION_STORE, 'readonly')
        .objectStore(ADAPTATION_STORE).index(SOURCE_SESSION_INDEX).getKey(id));
      const transaction = database.transaction([RECORD_STORE, SUMMARY_STORE, ADAPTATION_STORE], 'readwrite');
      transaction.objectStore(RECORD_STORE).delete(id);
      transaction.objectStore(SUMMARY_STORE).delete(id);
      if (adaptationKey !== undefined) {
        transaction.objectStore(ADAPTATION_STORE).delete(adaptationKey);
        this.adaptationMemory.delete(String(adaptationKey));
      }
      await transactionDone(transaction);
      this.persistedIds.delete(id);
      return true;
    } catch (error) {
      if (memoryRecord) this.memory.set(id, memoryRecord);
      if (memoryAdaptation) this.adaptationMemory.set(memoryAdaptation.id, memoryAdaptation);
      this.setMemory(failureIssue(error, 'write-failed'));
      return false;
    }
  }

  async retry(): Promise<SessionStorageState> {
    this.databasePromise = null;
    this.storageState = { mode: 'persistent', issue: null };
    try {
      await this.openDatabase();
      for (const record of this.memory.values()) {
        const state = await this.save(record);
        if (state.mode === 'memory') break;
      }
      for (const record of this.adaptationMemory.values()) await this.saveAdaptation(record);
    } catch {
      this.setMemory(this.storageState.issue ?? 'unavailable');
    }
    return this.state;
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    const factory = this.getFactory();
    if (!factory) {
      this.setMemory('unavailable');
      return Promise.reject(new Error('IndexedDB is unavailable.'));
    }
    this.databasePromise = new Promise((resolve, reject) => {
      let migrationFailed = false;
      const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        try {
          const database = request.result;
          if (!database.objectStoreNames.contains(RECORD_STORE)) database.createObjectStore(RECORD_STORE, { keyPath: 'id' });
          if (!database.objectStoreNames.contains(SUMMARY_STORE)) database.createObjectStore(SUMMARY_STORE, { keyPath: 'id' });
          if (!database.objectStoreNames.contains(ADAPTATION_STORE)) {
            const store = database.createObjectStore(ADAPTATION_STORE, { keyPath: 'id' });
            store.createIndex(SOURCE_SESSION_INDEX, 'sourceSessionId', { unique: true });
          }
        } catch {
          migrationFailed = true;
          request.transaction?.abort();
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        if (migrationFailed || request.error?.name === 'VersionError') this.setMemory('migration-failed');
        else this.setMemory('unavailable');
        reject(request.error ?? new Error('IndexedDB could not be opened.'));
      };
      request.onblocked = () => {
        this.setMemory('migration-failed');
        reject(new Error('IndexedDB migration was blocked.'));
      };
    });
    return this.databasePromise;
  }

  private setMemory(issue: SessionStorageIssue): void {
    this.storageState = { mode: 'memory', issue };
  }
}

let repository: IndexedDbSessionRepository | undefined;
export function getSessionRepository(): IndexedDbSessionRepository {
  repository ??= new IndexedDbSessionRepository(() => globalThis.indexedDB ?? null);
  return repository;
}
