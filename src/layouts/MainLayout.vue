<template>
  <q-layout view="lHh Lpr lFf" class="app-layout">
    <SkipLink />
    <q-header class="app-header" bordered>
      <q-toolbar class="app-toolbar">
        <q-btn
          id="navigation-toggle"
          flat
          round
          icon="menu"
          class="lt-md"
          :aria-label="t('app.openMenu')"
          :aria-expanded="drawerOpen"
          aria-controls="primary-navigation"
          @click="drawerOpen = !drawerOpen"
        />
        <q-toolbar-title class="toolbar-context">{{ t('app.workspace') }}</q-toolbar-title>
        <span class="status-tag">{{ t('app.preview') }}</span>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="drawerOpen"
      show-if-above
      bordered
      :width="256"
      :breakpoint="1023"
      @show="focusMobileNavigation"
      @before-hide="restoreMenuFocus"
    >
      <div ref="sidebar" class="app-sidebar" @keydown.tab="keepMobileFocus">
        <q-btn
          flat
          round
          icon="close"
          class="sidebar-close lt-md"
          :aria-label="t('app.closeMenu')"
          @click="drawerOpen = false"
        />
        <div class="sidebar-brand">
          <AppBrand />
          <p>{{ t('app.tagline') }}</p>
        </div>
        <nav id="primary-navigation" :aria-label="t('app.navigation')">
          <q-list class="navigation-list">
            <q-item
              v-for="item in navigation"
              :key="item.name"
              :to="{ name: item.name }"
              :active="route.meta.section === item.name"
              :aria-current="route.name === item.name ? 'page' : undefined"
              active-class="navigation-item--active"
              class="navigation-item"
              exact
              @click="closeMobileNavigation"
            >
              <q-item-section avatar><q-icon :name="item.icon" aria-hidden="true" /></q-item-section>
              <q-item-section>{{ t(`navigation.${item.name}`) }}</q-item-section>
            </q-item>
          </q-list>
        </nav>
        <p class="sidebar-footer">{{ t('app.footer') }}</p>
      </div>
    </q-drawer>

    <q-page-container><router-view /></q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import AppBrand from '@/components/AppBrand.vue';
import SkipLink from '@/components/SkipLink.vue';

const { t } = useI18n();
const route = useRoute();
const quasar = useQuasar();
const drawerOpen = ref(false);
const sidebar = ref<HTMLElement | null>(null);
const navigation = [
  { name: 'home', icon: 'space_dashboard' },
  { name: 'train', icon: 'grid_view' },
  { name: 'devices', icon: 'sports_esports' },
  { name: 'history', icon: 'history' },
  { name: 'settings', icon: 'tune' },
] as const;

function closeMobileNavigation() {
  if (quasar.screen.lt.md) drawerOpen.value = false;
}

function focusMobileNavigation() {
  if (quasar.screen.lt.md) {
    const currentLink = sidebar.value?.querySelector<HTMLElement>('nav a[aria-current="page"]');
    const firstLink = sidebar.value?.querySelector<HTMLElement>('nav a');
    (currentLink ?? firstLink)?.focus();
  }
}

function restoreMenuFocus() {
  if (quasar.screen.lt.md && sidebar.value?.contains(document.activeElement)) {
    document.getElementById('navigation-toggle')?.focus({ preventScroll: true });
  }
}

function keepMobileFocus(event: KeyboardEvent) {
  if (!quasar.screen.lt.md || !drawerOpen.value) return;

  const controls = sidebar.value?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
  const first = controls?.item(0);
  const last = controls?.item(controls.length - 1);
  if (!first || !last) return;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
</script>
