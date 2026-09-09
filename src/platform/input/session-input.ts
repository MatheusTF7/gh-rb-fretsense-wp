import type { FretMask, NormalizedInputEvent } from '@/engine/domain';
import type { TrainingSession } from '@/engine/session';
import { BrowserInputAdapter } from './browser-adapter';
import type { AdapterOptions, InputInterruption, InputTimeline } from './contracts';
import { SessionInputTimeline } from '../timing/session-clock';

export interface SessionInputObservers {
  onEvent?(event: NormalizedInputEvent): void;
  onBaseline?(frets: FretMask): void;
}

/** Usa a projeção temporal da sessão; o coordenador jogável é proprietário do descarte. */
export function createSessionInput(
  session: TrainingSession,
  options: Omit<AdapterOptions, 'profile' | 'onEvent' | 'onBaseline' | 'onInterrupt' | 'getMode' | 'canStart' | 'sequenceStart' | 'timeline'> & { readonly timeline?: InputTimeline },
  onInterrupt: (reason: InputInterruption) => void,
  observers: SessionInputObservers = {},
): BrowserInputAdapter {
  const snapshot = session.getSnapshot();
  if (!snapshot) throw new Error('Prepare a session before connecting input');
  return new BrowserInputAdapter({ ...options, profile: snapshot.device,
    timeline: options.timeline ?? new SessionInputTimeline(session),
    getMode: (observedAtMs) => session.openInputWindow(observedAtMs) ? 'events' : 'baseline',
    canStart: () => ['ready', 'countdown', 'paused'].includes(session.getView().state),
    sequenceStart: session.getLastInputSequence() + 1,
    onEvent(event) {
      const state = session.getView().state;
      if (state === 'running') session.recordInput(event);
      else if (state === 'ready' || state === 'countdown' || state === 'paused') session.setInputBaseline(event.activeFrets);
      observers.onEvent?.(event);
    },
    onBaseline(frets) {
      const state = session.getView().state;
      if (state === 'ready' || state === 'countdown' || state === 'paused') session.setInputBaseline(frets);
      observers.onBaseline?.(frets);
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
