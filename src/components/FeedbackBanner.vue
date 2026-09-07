<template>
  <q-banner
    rounded
    class="feedback-banner"
    :class="`feedback-banner--${tone}`"
    :role="tone === 'error' ? 'alert' : 'status'"
  >
    <template #avatar>
      <q-icon :name="tone === 'error' ? 'error_outline' : 'info_outline'" aria-hidden="true" />
    </template>
    {{ message }}
    <template v-if="$slots.actions" #action>
      <slot name="actions" />
    </template>
  </q-banner>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ message: string; tone?: 'info' | 'error' }>(), { tone: 'info' });
</script>
