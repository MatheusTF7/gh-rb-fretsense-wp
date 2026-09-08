import { acceptHMRUpdate, defineStore } from 'pinia';
import type {
  DrillLevel, JudgmentEvent, NormalizedInputEvent, SessionResult, SessionSnapshot, Technique,
} from '@/engine/domain';
import {
  buildEvolutionDashboard,
  compareWithPrevious,
  type EvolutionDashboard,
  type ReportingAttempt,
  type SessionComparison,
} from '@/engine/reporting';
import {
  createSessionExport,
  createStoredSessionRecord,
  getSessionRepository,
  type SessionListFilters,
  type SessionRepository,
  type SessionStorageState,
  type SessionSummary,
  type StoredSessionRecord,
} from '@/platform/storage';

const PAGE_SIZE = 10;
const INITIAL_STORAGE_STATE: SessionStorageState = { mode: 'persistent', issue: null };

function reportingAttempt(record: StoredSessionRecord): ReportingAttempt {
  return {
    snapshot: record.snapshot,
    result: record.result,
    presentation: record.presentation,
    gameEdition: record.gameEdition,
    judgments: record.retainedEvents.status === 'complete' ? record.retainedEvents.judgments : null,
  };
}

async function loadFilteredRecords(
  repository: SessionRepository,
  filters: SessionListFilters,
): Promise<readonly StoredSessionRecord[]> {
  const records: StoredSessionRecord[] = [];
  for (let page = 1; ; page += 1) {
    const result = await repository.list({ page, pageSize: 50, filters });
    const loaded = await Promise.all(result.records.map(({ id }) => repository.get(id)));
    records.push(...loaded.filter((item): item is StoredSessionRecord => item !== null));
    if (page * result.pageSize >= result.total) return records;
  }
}

function localDateBoundary(value: string, afterDay: boolean): string {
  const date = new Date(`${value}T00:00:00`);
  if (afterDay) date.setDate(date.getDate() + 1);
  return date.toISOString();
}

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
    levelFilter: null as DrillLevel | null,
    dateFromFilter: null as string | null,
    dateToFilter: null as string | null,
    evolution: null as EvolutionDashboard | null,
    evolutionLoading: false,
    evolutionError: false,
    comparison: null as SessionComparison | null,
    comparisonForId: null as string | null,
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
      this.evolution = null;
      this.evolutionError = false;
      this.evolutionLoading = true;
      const repository = getSessionRepository();
      try {
        const filters: SessionListFilters = {
          ...(this.modeFilter ? { mode: this.modeFilter } : {}),
          ...(this.endingFilter ? { endingState: this.endingFilter } : {}),
          ...(this.techniqueFilter ? { technique: this.techniqueFilter } : {}),
          ...(this.levelFilter ? { level: this.levelFilter } : {}),
          ...(this.dateFromFilter ? { endedAtOrAfterIso: localDateBoundary(this.dateFromFilter, false) } : {}),
          ...(this.dateToFilter ? { endedBeforeIso: localDateBoundary(this.dateToFilter, true) } : {}),
        };
        const result = await repository.list({
          page: this.page,
          pageSize: this.pageSize,
          filters,
        });
        if (operation !== this.querySequence) return;
        this.records = result.records;
        this.total = result.total;
        this.incompatibleCount = result.incompatibleCount;
        this.storageState = repository.state;
        if (this.page > this.pageCount) {
          this.page = this.pageCount;
          await this.loadPage();
          return;
        }
        this.evolutionLoading = true;
        this.evolutionError = false;
        try {
          const records = await loadFilteredRecords(repository, filters);
          if (operation !== this.querySequence) return;
          this.evolution = buildEvolutionDashboard(records.map(reportingAttempt));
          this.storageState = repository.state;
        } catch {
          if (operation !== this.querySequence) return;
          this.evolution = null;
          this.evolutionError = true;
        } finally {
          if (operation === this.querySequence) this.evolutionLoading = false;
        }
      } catch {
        if (operation !== this.querySequence) return;
        this.error = true;
        this.evolution = null;
        this.evolutionError = true;
        this.storageState = repository.state;
      } finally {
        if (operation === this.querySequence) {
          this.loading = false;
          this.evolutionLoading = false;
        }
      }
    },
    async openSession(id: string) {
      if (this.selectedId === id && this.selectedRecord && this.comparisonForId === id) return this.selectedRecord;
      const operation = ++this.detailSequence;
      this.detailLoading = true;
      this.error = false;
      const repository = getSessionRepository();
      try {
        const record = await repository.get(id);
        if (operation !== this.detailSequence) return null;
        this.selectedId = id;
        this.selectedRecord = record;
        this.comparison = null;
        this.comparisonForId = null;
        this.storageState = repository.state;
        if (record) {
          const candidates = await loadFilteredRecords(repository, { technique: record.snapshot.config.technique });
          if (operation !== this.detailSequence) return null;
          this.comparison = compareWithPrevious(reportingAttempt(record), candidates
            .filter((item) => item.id !== record.id).map(reportingAttempt));
          this.comparisonForId = id;
          this.storageState = repository.state;
        }
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
        this.comparison = null;
        this.comparisonForId = null;
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
