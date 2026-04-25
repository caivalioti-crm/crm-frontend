import type { VisitApiDTO } from '../types/visitApi';
import type { Visit } from '../types/visit';

/**
 * Map backend Visit DTO → UI Visit
 */
export function mapVisitFromApi(dto: VisitApiDTO): Visit {
  return {
    id: dto.id,
    date: dto.visitDate,
    notes: dto.notes ?? undefined,
  };
}

/**
 * Map list of backend visits → UI visits
 */
export function mapVisitsFromApi(dtos: VisitApiDTO[]): Visit[] {
  return dtos.map(mapVisitFromApi);
}