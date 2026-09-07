<template>
  <section class="surface-card section-spacing">
    <h2>{{ t('input.mapping') }}</h2>
    <p>{{ t('input.mappingHelp') }}</p>
    <p>{{ t('input.directionHelp') }}</p>
    <p v-if="profile.kind === 'gamepad'">{{ t('input.thresholds') }}</p>
    <ul class="mapping-list">
      <li v-for="action in MAPPING_ACTIONS" :key="actionId(action)">
        <strong>{{ actionLabel(action) }}</strong>
        <span>{{ bindingLabel(action) }}</span>
        <div class="row q-gutter-sm">
          <q-btn outline no-caps :disable="capturing" :label="t('input.assign')" :aria-label="`${t('input.assign')}: ${actionLabel(action)}`" @click="emit('assign', action)" />
          <q-btn flat no-caps :disable="capturing || !findControl(action)" :label="t('input.remove')" :aria-label="`${t('input.remove')}: ${actionLabel(action)}`" @click="emit('remove', action)" />
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { DeviceProfile, InputAction } from '@/engine/domain';
import { MAPPING_ACTIONS, actionId } from '@/platform/input/mapping';
const props = defineProps<{ profile: DeviceProfile; capturing: boolean }>();
const emit = defineEmits<{ assign: [action: InputAction]; remove: [action: InputAction] }>();
const { t } = useI18n();
function actionLabel(action: InputAction) {
  return action.kind === 'fret' ? `${action.fret} · ${t(`frets.${action.fret}`)}` : t(`input.${actionId(action)}`);
}
function findControl(action: InputAction) { return props.profile.bindings.find((binding) => actionId(binding.action) === actionId(action))?.control; }
function bindingLabel(action: InputAction) {
  const control = findControl(action);
  if (!control) return t('input.unassigned');
  if (control.kind === 'key') return control.code;
  if (control.kind === 'button') return t('input.button', { index: control.index });
  return t('input.axis', { index: control.index, direction: t(`input.${control.direction}`) });
}
</script>

<style scoped>
.mapping-list { padding: 0; list-style: none; }
.mapping-list li { display: grid; grid-template-columns: minmax(8rem, 1fr) minmax(8rem, 1fr) auto; gap: 1rem; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid var(--fs-border); }
@media (max-width: 700px) { .mapping-list li { grid-template-columns: 1fr; gap: 0.5rem; } }
</style>
