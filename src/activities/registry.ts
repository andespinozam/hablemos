import { concepts } from './concepts';
import { followOrders } from './followOrders';
import { listenPoint } from './listenPoint';
import { story } from './story';
import type { Activity } from './types';

/** Todas las actividades disponibles. Las fases 4-5 agregan las demás aquí. */
export const ACTIVITIES: readonly Activity[] = [listenPoint, followOrders, concepts, story];

export function getActivity(id: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.id === id);
}
