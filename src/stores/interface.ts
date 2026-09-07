import { acceptHMRUpdate, defineStore } from 'pinia';
import type { MessageLanguages } from '@/i18n';

export type ThemePreference = 'dark' | 'light' | 'system';

/** Estado da visita; persistência de preferências pertence à etapa 04. */
export const useInterfaceStore = defineStore('interface', {
  state: () => ({
    locale: 'pt-BR' as MessageLanguages,
    theme: 'dark' as ThemePreference,
    reducedMotion: false,
    catalogSearch: '',
  }),
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useInterfaceStore, import.meta.hot));
}
