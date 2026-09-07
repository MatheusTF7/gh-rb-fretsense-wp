import type { TrainingSession } from '@/engine/session';
import { BrowserInputAdapter } from './browser-adapter';
import type { AdapterOptions, InputInterruption } from './contracts';

/** A etapa 05 fornece timeline; a etapa 07 será proprietária deste vínculo e do descarte. */
export function createSessionInput(
  session: TrainingSession,
  options: Omit<AdapterOptions, 'profile' | 'onEvent' | 'onBaseline' | 'onInterrupt' | 'getMode' | 'canStart' | 'sequenceStart'>,
  onInterrupt: (reason: InputInterruption) => void,
): BrowserInputAdapter {
  const snapshot = session.getSnapshot();
  if (!snapshot) throw new Error('Prepare a session before connecting input');
  return new BrowserInputAdapter({ ...options, profile: snapshot.device,
    getMode: () => session.getView().state === 'running' ? 'events' : 'baseline',
    canStart: () => ['ready', 'countdown', 'paused'].includes(session.getView().state),
    sequenceStart: (session.getInputs().at(-1)?.sequence ?? -1) + 1,
    onEvent(event) {
      const state = session.getView().state;
      if (state === 'running') session.recordInput(event);
      else if (state === 'ready' || state === 'countdown' || state === 'paused') session.setInputBaseline(event.activeFrets);
    },
    onBaseline(frets) {
      const state = session.getView().state;
      if (state === 'ready' || state === 'countdown' || state === 'paused') session.setInputBaseline(frets);
    },
    onInterrupt(reason) {
      const state = session.getView().state;
      if (state !== 'idle' && state !== 'completed' && state !== 'aborted') {
        if (reason === 'context-changed') session.abort('context-changed');
        else if (state === 'running' || state === 'countdown') session.pause(reason === 'unavailable' ? 'device-disconnected' : reason);
      }
      onInterrupt(reason);
    },
  });
}
