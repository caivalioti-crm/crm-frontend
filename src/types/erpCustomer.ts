// Raw shape coming from ERP / backend (DO NOT use in UI)
export type ErpCustomerDTO = {
  code: string;
  parent_account_code?: string;
  name: string;
  nameGreek?: string;
  city: string;

  area_code: string; // ERP canonical
  area: string;      // display name

  is_active?: boolean;
  salesman_code?: string;

  // allow extra fields without breaking
  [key: string]: any;
};