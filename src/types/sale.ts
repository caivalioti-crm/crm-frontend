export type Sale = {
  customerCode: string;
  trnDate: string | null;
  netAmount: number;
  invoiceCount: number;
  series: number;
  salesRepId: string;
};