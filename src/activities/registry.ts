import { concepts } from './concepts';
import { discrimination } from './discrimination';
import { followOrders } from './followOrders';
import { listenPoint } from './listenPoint';
import { naming } from './naming';
import { onomatopoeia } from './onomatopoeia';
import { phonemeWords } from './phonemeWords';
import { phrase } from './phrase';
import { praxias } from './praxias';
import { sorting } from './sorting';
import { story } from './story';
import type { Activity } from './types';

/** Todas las actividades, en el orden del brief (1-11). */
export const ACTIVITIES: readonly Activity[] = [
  listenPoint, // 1
  followOrders, // 2
  concepts, // 3
  story, // 4
  naming, // 5
  sorting, // 6
  phrase, // 7
  praxias, // 8
  onomatopoeia, // 9
  phonemeWords, // 10
  discrimination, // 11
];

export function getActivity(id: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.id === id);
}
