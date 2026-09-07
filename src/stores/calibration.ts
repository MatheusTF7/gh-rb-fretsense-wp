import { defineStore } from 'pinia';
import type { CalibrationProfile } from '@/engine/domain';
import { getCalibrationRepository } from '@/platform/calibration/repository';

export const useCalibrationStore = defineStore('calibration', {
  state: () => ({ records: getCalibrationRepository().snapshot, storageStatus: getCalibrationRepository().status }),
  actions: {
    save(profile: CalibrationProfile) {
      const repository = getCalibrationRepository();
      repository.save(profile); this.records = repository.snapshot; this.storageStatus = repository.status;
    },
    retryStorage() {
      const repository = getCalibrationRepository(); repository.retrySave(); this.storageStatus = repository.status;
    },
  },
});
