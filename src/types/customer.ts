export type Customer = {
  code: string;
  name: string;
  nameGreek?: string;
  city: string;

  areaCode: string;
  area: string;

  type?: string;
  group?: string;
  lastVisitDate?: string;
  assignedRepId?: string;
  trdr_id?: number;
};