import { acceptHMRUpdate, defineStore } from 'pinia';
import type { DeviceProfile } from '@/engine/domain';
import type { GamepadConnection } from '@/platform/input/contracts';
import { getPreferencesRepository } from '@/platform/preferences/repository';

export type ThemePreference = 'dark' | 'light' | 'system';
export interface SelectedGamepad {
  readonly index: number;
  readonly hardwareId: string;
}

/** Preferências persistidas e seleções transitórias compartilhadas durante a visita. */
export const useInterfaceStore = defineStore('interface', {
  state: () => {
    const repository = getPreferencesRepository();
    return {
      locale: repository.snapshot.interface.locale,
      theme: repository.snapshot.interface.theme,
      reducedMotion: repository.snapshot.interface.reducedMotion,
      profiles: repository.snapshot.profiles,
      selectedProfileId: repository.snapshot.selectedProfileId,
      selectedGamepad: null as SelectedGamepad | null,
      storageStatus: repository.status,
      catalogSearch: '',
    };
  },
  actions: {
    persistInterface() {
      const repository = getPreferencesRepository();
      repository.saveInterface({
        locale: this.locale,
        theme: this.theme,
        reducedMotion: this.reducedMotion,
      });
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
    selectGamepad(connection: GamepadConnection | null) {
      this.selectedGamepad = connection
        ? { index: connection.index, hardwareId: connection.hardwareId }
        : null;
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
