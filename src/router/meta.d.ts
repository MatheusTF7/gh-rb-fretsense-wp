import 'vue-router';
import type { MessageSchema } from '@/i18n';

declare module 'vue-router' {
  interface RouteMeta {
    titleKey?: keyof MessageSchema['navigation'];
    section?: 'home' | 'train' | 'devices' | 'history' | 'settings';
  }
}
