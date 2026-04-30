import type { Sale } from '../types/sale';

/**
 * Maps raw ERP / backend sales rows into canonical Sale model.
 * This is the ONLY place that knows ERP field names.
 */
export function mapErpSale(raw: any): Sale {
  return {
    customerCode: String(raw.customerCode ?? raw.trdr),
    trnDate: raw.trnDate ?? raw.trndate,
    netAmount: Number(raw.netAmount ?? raw.netamnt ?? 0),
    series: Number(raw.series),
    salesRepId: String(raw.salesRepId ?? 'demo'), // Phase‑1 placeholder
  };
}