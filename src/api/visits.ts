/* ===================== TYPES ===================== */

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

/* ===================== CONFIG ===================== */

const API_BASE = '/api';

/* ===================== CREATE VISITS ===================== */

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

/* ===================== FETCH VISITS (PAGINATED) ===================== */

export async function fetchProspectVisits(
  prospectId: string,
  params?: {
    cursor?: string;
    limit?: number;
  }
) {
  const searchParams = new URLSearchParams();

  if (params?.cursor) searchParams.append('cursor', params.cursor);
  if (params?.limit) searchParams.append('limit', String(params.limit));

  const query = searchParams.toString();
  const url = `${API_BASE}/prospects/${prospectId}/visits${
    query ? `?${query}` : ''
  }`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error('Failed to fetch prospect visits');
  }

  return res.json(); // { items, nextCursor }
}

export async function fetchCustomerVisits(
  customerCode: string,
  params?: {
    cursor?: string;
    limit?: number;
  }
) {
  const searchParams = new URLSearchParams();

  if (params?.cursor) searchParams.append('cursor', params.cursor);
  if (params?.limit) searchParams.append('limit', String(params.limit));

  const query = searchParams.toString();
  const url = `${API_BASE}/customers/${customerCode}/visits${
    query ? `?${query}` : ''
  }`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error('Failed to fetch customer visits');
  }

  return res.json(); // { items, nextCursor }
}