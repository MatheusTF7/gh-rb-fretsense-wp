import { acceptHMRUpdate, defineStore } from 'pinia';
import type { DrillConfig, SessionMode, SessionResult, SessionSnapshot, TrainingRecommendation } from '@/engine/domain';
import { immutableCopy, parseDrillConfig, requireCondition } from '@/engine/domain';

export interface InMemorySessionRecord {
  readonly snapshot: SessionSnapshot;
  readonly result: SessionResult;
}

export interface TrainingDraftContext {
  readonly mode: SessionMode;
  readonly profileId: string;
  readonly audioMode: 'enabled' | 'silent';
  readonly calibrationId: string | null;
}

/** Workspace transitório da etapa 10. Persistência e histórico pertencem à etapa 12. */
export const useTrainingStore = defineStore('training', {
  state: () => ({
    draftConfig: null as DrillConfig | null,
    draftPresetId: null as string | null,
    draftFocusSegment: null as string | null,
    draftContext: null as TrainingDraftContext | null,
    latestRecord: null as InMemorySessionRecord | null,
    recommendation: null as TrainingRecommendation | null,
  }),
  actions: {
    saveDraft(value: unknown, presetId: string, focusSegment: string | null, context: TrainingDraftContext) {
      this.draftConfig = parseDrillConfig(value);
      this.draftPresetId = presetId;
      this.draftFocusSegment = focusSegment;
      this.draftContext = immutableCopy(context);
    },
    saveResult(snapshot: SessionSnapshot, result: SessionResult) {
      requireCondition(snapshot.id === result.sessionId, 'training.result', 'Result belongs to another snapshot.');
      this.latestRecord = immutableCopy({ snapshot, result });
    },
    setRecommendation(value: TrainingRecommendation | null) {
      this.recommendation = value === null ? null : immutableCopy(value);
    },
    applyRecommendation(): DrillConfig | null {
      const recommendation = this.recommendation;
      if (!recommendation) return null;
      const config = parseDrillConfig(recommendation.resultingConfig);
      this.draftConfig = config;
      this.recommendation = null;
      return config;
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTrainingStore, import.meta.hot));
}
