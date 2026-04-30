import type { Sale } from '../types/sale';

export function mapErpSale(raw: any): Sale {
  return {
    customerCode: String(raw.customerCode ?? raw.trdr),
    trnDate: raw.trnDate ?? raw.trndate ?? null,
    netAmount: Number(raw.netAmount ?? raw.netamnt ?? 0),
    invoiceCount: Number(raw.invoiceCount ?? 0),
    series: Number(raw.series ?? 0),
    salesRepId: String(raw.salesRepId ?? 'demo'),
  };
}