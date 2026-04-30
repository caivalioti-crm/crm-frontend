import type { Customer } from '../types/customer';

export function mapErpCustomer(raw: any): Customer {
  return {
    code: String(raw.code),
    name: raw.name,
    nameGreek: raw.nameGreek,
    city: raw.city,

    areaCode: String(raw.area_code),
    area: raw.area,

    trdr_id: raw.trdr_id,

    type: undefined,
    group: undefined,
    lastVisitDate: undefined,
    assignedRepId: undefined,
  };
}