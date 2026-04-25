export const visitKeys = {
  prospect: (prospectId: string) =>
    ['visits', 'prospect', prospectId] as const,

  customer: (customerCode: string) =>
    ['visits', 'customer', customerCode] as const,
};