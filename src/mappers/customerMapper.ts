import type { Customer } from '../types/customer';

export function mapErpCustomer(raw: any): Customer {
  return {
    code: String(raw.code),
    name: raw.name,
    city: raw.city,
    areaCode: String(raw.area_code ?? ''),
    area: raw.area,
    trdr_id: raw.trdr_id,
    lastVisitDate: raw.last_visit_date ?? undefined,
    afm: raw.afm ?? undefined,
    address: raw.address ?? undefined,
    email: raw.email ?? undefined,
    phone: raw.phone ?? undefined,
    mobile: raw.mobile ?? undefined,
    fax: raw.fax ?? undefined,
    zip: raw.zip ?? undefined,
    district: raw.district ?? undefined,
    shipmentName: raw.shipment_name ?? undefined,
    carrierName: raw.carrier_name ?? undefined,
    type: undefined,
    group: undefined,
    assignedRepId: undefined,
    salesmanCode: raw.salesman_code ?? undefined,
    is_active: raw.is_active,
    prccategory: raw.prccategory ?? null,
    inserted_date: raw.inserted_date ?? undefined, 
    updated_date: raw.updated_date ?? undefined,
  };
}
