import type { Activity } from './types';
import { warmup } from './warmup';

/** Todas las actividades disponibles. Las fases 3-5 agregan las demás aquí. */
export const ACTIVITIES: readonly Activity[] = [warmup];

export function getActivity(id: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.id === id);
}
