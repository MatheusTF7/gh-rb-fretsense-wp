import { acceptHMRUpdate, defineStore } from 'pinia';
import type { MessageLanguages } from '@/i18n';
import type { DeviceProfile } from '@/engine/domain';
import { getPreferencesRepository, type StorageStatus } from '@/platform/preferences/repository';

export type ThemePreference = 'dark' | 'light' | 'system';

/** Preferências pequenas persistidas; busca do catálogo continua restrita à visita. */
export const useInterfaceStore = defineStore('interface', {
  state: () => {
    const repository = getPreferencesRepository();
    return {
      locale: repository.snapshot.interface.locale as MessageLanguages,
      theme: repository.snapshot.interface.theme as ThemePreference,
      reducedMotion: repository.snapshot.interface.reducedMotion,
      profiles: repository.snapshot.profiles as readonly DeviceProfile[],
      selectedProfileId: repository.snapshot.selectedProfileId,
      storageStatus: repository.status as StorageStatus,
      catalogSearch: '',
    };
  },
  actions: {
    persistInterface() {
      const repository = getPreferencesRepository();
      repository.saveInterface({ locale: this.locale, theme: this.theme, reducedMotion: this.reducedMotion });
      this.storageStatus = repository.status;
    },
    saveProfile(profile: DeviceProfile) {
      const repository = getPreferencesRepository();
      repository.saveProfile(profile);
      this.profiles = repository.snapshot.profiles;
      this.selectedProfileId = repository.snapshot.selectedProfileId;
      this.storageStatus = repository.status;
    },
    selectProfile(id: string) {
      const repository = getPreferencesRepository();
      repository.selectProfile(id);
      this.selectedProfileId = repository.snapshot.selectedProfileId;
      this.storageStatus = repository.status;
    },
    retryStorage() {
      const repository = getPreferencesRepository();
      repository.retrySave();
      this.storageStatus = repository.status;
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useInterfaceStore, import.meta.hot));
}
