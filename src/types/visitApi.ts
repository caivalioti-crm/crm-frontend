/**
 * Visit shape as returned by the backend API
 * (DO NOT use directly in UI)
 */
export type VisitApiDTO = {
  id: string;
  visitDate: string;     // backend naming
  notes?: string | null;
};