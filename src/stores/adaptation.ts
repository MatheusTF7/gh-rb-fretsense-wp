import { acceptHMRUpdate, defineStore } from 'pinia';
import type { DrillConfig, SessionResult, SessionSnapshot } from '@/engine/domain';
import type { AdaptationEvaluation, AdaptationUnavailableReason } from '@/engine/adaptation';
import { evaluateAdaptation } from '@/engine/adaptation';
import {
  createStoredAdaptationRecord, decideStoredAdaptation, getSessionRepository,
  type RecommendationDecision, type SessionStorageState, type StoredAdaptationRecord, type StoredSessionRecord,
} from '@/platform/storage';

const INITIAL_STORAGE_STATE: SessionStorageState = { mode: 'persistent', issue: null };

function attempts(records: readonly StoredSessionRecord[]) {
  return records.map(({ snapshot, result }) => ({ snapshot, result }));
}

export const useAdaptationStore = defineStore('adaptation', {
  state: () => ({
    record: null as StoredAdaptationRecord | null,
    evaluationReason: null as AdaptationUnavailableReason | null,
    observedAttempts: 0,
    requiredAttempts: 0,
    loading: false,
    storageState: INITIAL_STORAGE_STATE,
    pendingAdjustmentId: null as string | null,
    adaptiveEnabled: false,
    adaptiveMaximumBlocks: 3,
    adaptiveCompletedBlocks: 0,
    continueAdaptiveChain: false,
  }),
  getters: {
    recommendation: (state) => state.record?.recommendation ?? null,
    decision: (state): RecommendationDecision | null => state.record?.decision ?? null,
    adaptiveLimitReached: (state) => state.adaptiveEnabled
      && state.adaptiveCompletedBlocks >= state.adaptiveMaximumBlocks,
  },
  actions: {
    configureAdaptive(enabled: boolean, maximumBlocks: number) {
      const normalized = Number.isFinite(maximumBlocks)
        ? Math.min(12, Math.max(1, Math.trunc(maximumBlocks))) : 1;
      if (this.adaptiveEnabled !== enabled || this.adaptiveMaximumBlocks !== normalized) {
        this.adaptiveCompletedBlocks = 0;
        this.continueAdaptiveChain = false;
      }
      this.adaptiveEnabled = enabled;
      this.adaptiveMaximumBlocks = normalized;
    },
    beginAttempt() {
      if (this.adaptiveEnabled && !this.continueAdaptiveChain) this.adaptiveCompletedBlocks = 0;
      this.continueAdaptiveChain = false;
    },
    async evaluate(snapshot: SessionSnapshot, result: SessionResult) {
      if (this.loading || this.record?.sourceSessionId === result.sessionId) return;
      this.loading = true;
      this.record = null;
      this.evaluationReason = null;
      const repository = getSessionRepository();
      try {
        const needed = Math.min(150, Math.max(snapshot.config.goals.consistentAttempts + 4, 12));
        const records: StoredSessionRecord[] = [];
        for (let page = 1; records.length < needed; page += 1) {
          const summaries = await repository.list({ page, pageSize: 50, filters: { technique: snapshot.config.technique } });
          const loaded = await Promise.all(summaries.records.map(({ id }) => repository.get(id)));
          records.push(...loaded.filter((item): item is StoredSessionRecord => item !== null));
          if (page * summaries.pageSize >= summaries.total) break;
        }
        this.storageState = repository.state;
        const evaluation: AdaptationEvaluation = evaluateAdaptation(
          { snapshot, result },
          attempts(records.filter(({ id }) => id !== result.sessionId)),
        );
        if (this.adaptiveEnabled) this.adaptiveCompletedBlocks += 1;
        if (evaluation.status === 'not-recommended') {
          this.evaluationReason = evaluation.reason;
          this.observedAttempts = evaluation.observedAttempts;
          this.requiredAttempts = evaluation.requiredAttempts;
          return;
        }
        const stored = createStoredAdaptationRecord(result.sessionId, evaluation.recommendation);
        await repository.saveAdaptation(stored);
        this.record = await repository.getAdaptation(stored.id) ?? stored;
        this.storageState = repository.state;
        this.observedAttempts = evaluation.recommendation.consistency.observedAttempts;
        this.requiredAttempts = evaluation.recommendation.consistency.requiredAttempts;
      } catch {
        this.storageState = repository.state;
        this.evaluationReason = 'no-actionable-evidence';
        this.observedAttempts = 0;
        this.requiredAttempts = Math.max(snapshot.config.goals.consistentAttempts, 3);
      } finally {
        this.loading = false;
      }
    },
    async loadForSession(sessionId: string) {
      this.loading = true;
      const repository = getSessionRepository();
      try {
        this.record = await repository.getAdaptationForSession(sessionId);
        this.storageState = repository.state;
      }
      finally { this.loading = false; }
    },
    async accept(): Promise<DrillConfig | null> {
      const current = this.record;
      if (!current || current.decision !== 'pending' || this.adaptiveLimitReached) return null;
      const next = decideStoredAdaptation(current, 'accepted', current.recommendation.resultingConfig);
      const repository = getSessionRepository();
      if (!await repository.saveAdaptation(next)) return null;
      this.storageState = repository.state;
      this.record = next;
      this.continueAdaptiveChain = this.adaptiveEnabled;
      return next.resultingConfig;
    },
    async ignore() {
      const current = this.record;
      if (!current || current.decision !== 'pending') return;
      const next = decideStoredAdaptation(current, 'ignored', null);
      const repository = getSessionRepository();
      if (await repository.saveAdaptation(next)) this.record = next;
      this.storageState = repository.state;
      this.continueAdaptiveChain = false;
    },
    async adjust(): Promise<DrillConfig | null> {
      const current = this.record;
      if (!current || current.decision !== 'pending') return null;
      const next = decideStoredAdaptation(current, 'adjusting', current.recommendation.resultingConfig, null);
      const repository = getSessionRepository();
      if (!await repository.saveAdaptation(next)) return null;
      this.storageState = repository.state;
      this.record = next;
      this.pendingAdjustmentId = next.id;
      this.continueAdaptiveChain = false;
      return next.resultingConfig;
    },
    async finalizeAdjustment(config: DrillConfig) {
      const id = this.pendingAdjustmentId;
      if (!id) return;
      const repository = getSessionRepository();
      const current = await repository.getAdaptation(id);
      if (!current || current.decision !== 'adjusting') return;
      const next = decideStoredAdaptation(current, 'adjusted', config);
      if (await repository.saveAdaptation(next)) {
        this.record = next;
        this.pendingAdjustmentId = null;
      }
      this.storageState = repository.state;
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAdaptationStore, import.meta.hot));
}
