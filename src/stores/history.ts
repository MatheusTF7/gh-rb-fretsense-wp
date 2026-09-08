import { acceptHMRUpdate, defineStore } from 'pinia';
import type { JudgmentEvent, NormalizedInputEvent, SessionResult, SessionSnapshot, Technique } from '@/engine/domain';
import {
  createSessionExport,
  createStoredSessionRecord,
  getSessionRepository,
  type SessionStorageState,
  type SessionSummary,
  type StoredSessionRecord,
} from '@/platform/storage';

const PAGE_SIZE = 10;
const INITIAL_STORAGE_STATE: SessionStorageState = { mode: 'persistent', issue: null };

export const useHistoryStore = defineStore('history', {
  state: () => ({
    records: [] as readonly SessionSummary[],
    selectedRecord: null as StoredSessionRecord | null,
    selectedId: null as string | null,
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    incompatibleCount: 0,
    modeFilter: null as SessionSnapshot['mode'] | null,
    endingFilter: null as SessionResult['ending']['state'] | null,
    techniqueFilter: null as Technique | null,
    loading: true,
    detailLoading: true,
    querySequence: 0,
    detailSequence: 0,
    error: false,
    storageState: INITIAL_STORAGE_STATE,
  }),
  getters: {
    pageCount: (state) => Math.max(1, Math.ceil(state.total / state.pageSize)),
  },
  actions: {
    async persist(
      snapshot: SessionSnapshot,
      result: SessionResult,
      inputs: readonly NormalizedInputEvent[],
      judgments: readonly JudgmentEvent[],
    ) {
      const repository = getSessionRepository();
      const record = createStoredSessionRecord(snapshot, result, inputs, judgments);
      this.selectedId = record.id;
      this.selectedRecord = record;
      this.storageState = await repository.save(record);
    },
    async loadPage(resetPage = false): Promise<void> {
      const operation = ++this.querySequence;
      if (resetPage) this.page = 1;
      this.loading = true;
      this.error = false;
      const repository = getSessionRepository();
      try {
        const result = await repository.list({
          page: this.page,
          pageSize: this.pageSize,
          filters: {
            ...(this.modeFilter ? { mode: this.modeFilter } : {}),
            ...(this.endingFilter ? { endingState: this.endingFilter } : {}),
            ...(this.techniqueFilter ? { technique: this.techniqueFilter } : {}),
          },
        });
        if (operation !== this.querySequence) return;
        this.records = result.records;
        this.total = result.total;
        this.incompatibleCount = result.incompatibleCount;
        this.storageState = repository.state;
        if (this.page > this.pageCount) {
          this.page = this.pageCount;
          await this.loadPage();
        }
      } catch {
        if (operation !== this.querySequence) return;
        this.error = true;
        this.storageState = repository.state;
      } finally {
        if (operation === this.querySequence) this.loading = false;
      }
    },
    async openSession(id: string) {
      if (this.selectedId === id && this.selectedRecord) return this.selectedRecord;
      const operation = ++this.detailSequence;
      this.detailLoading = true;
      this.error = false;
      const repository = getSessionRepository();
      try {
        const record = await repository.get(id);
        if (operation !== this.detailSequence) return null;
        this.selectedId = id;
        this.selectedRecord = record;
        this.storageState = repository.state;
        return record;
      } catch {
        if (operation !== this.detailSequence) return null;
        this.error = true;
        this.storageState = repository.state;
        return null;
      } finally {
        if (operation === this.detailSequence) this.detailLoading = false;
      }
    },
    async removeSession(id: string) {
      const repository = getSessionRepository();
      const removed = await repository.remove(id);
      this.storageState = repository.state;
      if (removed && this.selectedId === id) {
        this.selectedId = null;
        this.selectedRecord = null;
      }
      return removed;
    },
    exportSelected() {
      return this.selectedRecord ? createSessionExport(this.selectedRecord) : null;
    },
    async retryStorage() {
      const repository = getSessionRepository();
      this.storageState = await repository.retry();
      await this.loadPage();
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useHistoryStore, import.meta.hot));
}
