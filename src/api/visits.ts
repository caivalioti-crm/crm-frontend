export interface ProspectVisitPayload {
  prospectId: string;
  notes?: string;
  date?: string;
}

export interface CustomerVisitPayload {
  customerCode: string;
  notes?: string;
  date?: string;
}

const API_BASE = '/api'; // adjust if needed

export async function createProspectVisit(payload: ProspectVisitPayload) {
  const res = await fetch(`${API_BASE}/prospects/visits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error('Failed to create prospect visit');
  }

  return res.json();
}

export async function createCustomerVisit(payload: CustomerVisitPayload) {
  const res = await fetch(`${API_BASE}/customers/visits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error('Failed to create customer visit');
  }

  return res.json();
}