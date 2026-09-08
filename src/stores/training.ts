import { acceptHMRUpdate, defineStore } from 'pinia';
import type { DrillConfig, SessionMode, SessionResult, SessionSnapshot } from '@/engine/domain';
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

/** Workspace transitório da tentativa atual; o histórico durável fica no repositório de sessões. */
export const useTrainingStore = defineStore('training', {
  state: () => ({
    draftConfig: null as DrillConfig | null,
    draftPresetId: null as string | null,
    draftFocusSegment: null as string | null,
    draftContext: null as TrainingDraftContext | null,
    latestRecord: null as InMemorySessionRecord | null,
  }),
  actions: {
    saveDraft(value: unknown, presetId: string, focusSegment: string | null, context: TrainingDraftContext) {
      this.draftConfig = parseDrillConfig(value);
      this.draftPresetId = presetId;
      this.draftFocusSegment = focusSegment;
      this.draftContext = immutableCopy(context);
    },
    prepareSavedSession(snapshot: SessionSnapshot, focusSegment: string | null = null) {
      this.prepareConfig(snapshot.config, snapshot, focusSegment);
    },
    prepareConfig(value: unknown, context: SessionSnapshot, focusSegment: string | null = null) {
      const config = parseDrillConfig(value);
      this.draftConfig = config;
      this.draftPresetId = config.pattern.id;
      this.draftFocusSegment = focusSegment;
      this.draftContext = immutableCopy({
        mode: context.mode,
        profileId: context.device.id,
        audioMode: context.calibration.context.audioMode,
        calibrationId: context.calibration.method === 'default' ? null : context.calibration.id,
      });
    },
    saveResult(snapshot: SessionSnapshot, result: SessionResult) {
      requireCondition(snapshot.id === result.sessionId, 'training.result', 'Result belongs to another snapshot.');
      this.latestRecord = immutableCopy({ snapshot, result });
    },
    discardResult(id: string) {
      if (this.latestRecord?.snapshot.id === id) this.latestRecord = null;
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTrainingStore, import.meta.hot));
}
