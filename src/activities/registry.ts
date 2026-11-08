import { concepts } from './concepts';
import { followOrders } from './followOrders';
import { listenPoint } from './listenPoint';
import { naming } from './naming';
import { phrase } from './phrase';
import { sorting } from './sorting';
import { story } from './story';
import type { Activity } from './types';

/** Todas las actividades disponibles. La fase 5 agrega las demás aquí. */
export const ACTIVITIES: readonly Activity[] = [listenPoint, followOrders, concepts, story, naming, sorting, phrase];

export function getActivity(id: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.id === id);
}
