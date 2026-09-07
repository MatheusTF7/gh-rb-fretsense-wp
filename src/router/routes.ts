import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/play',
    component: () => import('@/layouts/TrainingLayout.vue'),
    children: [
      {
        path: '',
        name: 'play',
        component: () => import('@/pages/PlayPage.vue'),
        meta: { titleKey: 'play', section: 'train' },
      },
    ],
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/pages/IndexPage.vue'),
        meta: { titleKey: 'home', section: 'home' },
      },
      {
        path: 'train',
        name: 'train',
        component: () => import('@/pages/CatalogPage.vue'),
        meta: { titleKey: 'train', section: 'train' },
      },
      {
        path: 'devices',
        name: 'devices',
        component: () => import('@/pages/DevicesPage.vue'),
        meta: { titleKey: 'devices', section: 'devices' },
      },
      {
        path: 'calibration',
        name: 'calibration',
        component: () => import('@/pages/CalibrationPage.vue'),
        meta: { titleKey: 'calibration', section: 'devices' },
      },
      {
        path: 'history',
        name: 'history',
        component: () => import('@/pages/HistoryPage.vue'),
        meta: { titleKey: 'history', section: 'history' },
      },
      {
        path: 'results/:id',
        name: 'results',
        component: () => import('@/pages/ResultsPage.vue'),
        meta: { titleKey: 'results', section: 'history' },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/pages/SettingsPage.vue'),
        meta: { titleKey: 'settings', section: 'settings' },
      },
      {
        path: ':catchAll(.*)*',
        name: 'not-found',
        component: () => import('@/pages/ErrorNotFound.vue'),
        meta: { titleKey: 'notFound' },
      },
    ],
  },
];

export default routes;
