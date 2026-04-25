// ✅ Shared CRM intelligence (persists Prospect → Customer)
export interface CompetitionInfo {
  mainCompetitor?: string;
  otherCompetitors?: string;
  estimatedMonthlySpend?: number;
  competitorStrengths?: string;
  switchReason?: string;
}

export interface ShopProfile {
  numberOfEmployees?: number;
  shopSizeM2?: number;
  stockBehavior?: 'keeps_stock' | 'on_demand' | 'mixed';
}

// ✅ CRM draft transport (Prospect only)
export interface TransportDraft {
  transportCompany?: string;
  transportMeans?: string;
}

// ✅ ERP transport (Customer only)
export interface TransportERP {
  transportCompany?: string;
  transportMeans?: string;
}

// ✅ Base commercial entity (CRM-owned)
export interface CommercialEntityBase {
  competitionInfo?: CompetitionInfo;
  shopProfile?: ShopProfile;
}