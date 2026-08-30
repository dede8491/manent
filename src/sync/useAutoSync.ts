import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { hasBackend } from '@/services/supabase';
import { useStore } from '@/store/useStore';

/** Intervalle minimal entre deux synchronisations automatiques. */
const MIN_INTERVAL_MS = 60_000;

/**
 * Synchronise au lancement, puis à chaque retour au premier plan — le moment
 * où l'app a le plus de chances d'avoir du réseau et où l'utilisateur va
 * consulter ses données. Aucun minuteur en tâche de fond : ce serait de la
 * batterie dépensée pour rien.
 */
export function useAutoSync(): void {
  const sync = useStore((s) => s.sync);
  const hydrated = useStore((s) => s.hydrated);
  const lastAttempt = useRef(0);

  useEffect(() => {
    if (!hydrated || !hasBackend()) return;

    const run = () => {
      const now = Date.now();
      if (now - lastAttempt.current < MIN_INTERVAL_MS) return;
      lastAttempt.current = now;
      // Un échec réseau ne doit jamais remonter jusqu'à l'interface : les
      // opérations restent en file et repartiront au passage suivant.
      sync().catch(() => {});
    };

    run();

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') run();
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [hydrated, sync]);
}
