import type { Customer } from '../types/customer';

export function mapErpCustomer(raw: any): Customer {
  return {
    code: String(raw.code),
    name: raw.name,
    nameGreek: raw.nameGreek,
    city: raw.city,

    // ✅ normalize snake_case → camelCase ONCE
    areaCode: String(raw.area_code),
    area: raw.area,

    type: undefined,
    group: undefined,
    lastVisitDate: undefined,
    assignedRepId: undefined,
  };
}