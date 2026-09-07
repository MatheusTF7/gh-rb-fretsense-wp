<template>
  <a class="skip-link" href="#main-content" @click.prevent="focusContent">
    {{ t('app.skipContent') }}
  </a>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

function focusContent() {
  // Evita tratar a âncora de acessibilidade como uma rota no modo hash.
  document.getElementById('main-content')?.focus();
}
</script>
