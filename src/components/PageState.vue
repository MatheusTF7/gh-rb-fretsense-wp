<template>
  <section class="page-state">
    <div class="page-state__icon" aria-hidden="true"><q-icon :name="icon" size="32px" /></div>
    <component :is="heading" class="page-state__title">{{ title }}</component>
    <p>{{ description }}</p>
    <div v-if="$slots.default" class="page-state__actions"><slot /></div>
  </section>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    description: string;
    icon: string;
    heading?: 'h1' | 'h2';
  }>(),
  { heading: 'h2' },
);
</script>
