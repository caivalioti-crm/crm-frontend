import type { Visit } from '../types/visit';

/**
 * Sort visits for UI display:
 * 1. Optimistic visits first
 * 2. Newest date first
 */
export function sortVisits(visits: Visit[]): Visit[] {
  return [...visits].sort((a, b) => {
    // Optimistic visits always on top
    if (a.__optimistic && !b.__optimistic) return -1;
    if (!a.__optimistic && b.__optimistic) return 1;

    // Newest date first
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}
