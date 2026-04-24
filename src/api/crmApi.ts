const BASE_URL = 'http://localhost:3001';

async function request<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || 'API error');
  }

  return json.data ?? json;
}

/* ---------- WRITE ---------- */

export function recordVisit(payload: {
  entityType: 'customer';
  entityId: string;
  visitDate: string; // dd/mm/yy
  categories: {
    categoryCode: string;
    subcategoryCodes: string[];
  }[];
}) {
  return request('/visits/record', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/* ---------- READ ---------- */

export async function getCustomerDashboard(customerCode: string) {
  // We already verified ERP customers exist,
  // so this only needs to return a compatible shape.

  const customers = await request<any[]>('/api/erp/customers');

  const customer = customers.find(
    c =>
      c.parent_account_code === customerCode ||
      c.branch_code === customerCode
  );

  if (!customer) {
    throw new Error('Customer not found');
  }

  // 🔒 PHASE 1 STUB
  // KPIs based on visits/discussions will be wired in Phase 2
  return {
    categories_discussed_count: 0,
    subcategories_discussed_count: 0,
    last_discussion_date: null,
  };
}

export function getCustomerReadiness(customerCode: string) {
  return request(`/customers/${customerCode}/readiness`);
}

export function getTopCategories(customerCode: string) {
  return request(`/customers/${customerCode}/top-categories`);
}

export function getNeglectedCategories(customerCode: string) {
  return request(`/customers/${customerCode}/neglected-categories`);
}

export function getCustomerCRM(customerCode: string) {
  return request(`/customers/${customerCode}/crm`);
}