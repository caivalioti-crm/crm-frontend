export interface CompetitorEntry {
  name: string;
  isPrimary: boolean;
  notes?: string;
}

export interface CompetitionInfo {
  competitors?: CompetitorEntry[];
  estimatedMonthlySpend?: number;
  switchReason?: string;
  // legacy fields — kept for backward compat reading
  mainCompetitor?: string;
  otherCompetitors?: string;
  competitorStrengths?: string;
}

export interface ShopProfile {
  numberOfEmployees?: number;
  shopSizeM2?: number;
  stockBehavior?: 'keeps_stock' | 'on_demand' | 'mixed';
  vehicleTypes?: string[];
  vehicleBrands?: string[];
}

export interface TransportDraft {
  transportCompany?: string;
  transportMeans?: string;
}

export interface TransportERP {
  transportCompany?: string;
  transportMeans?: string;
}

export interface CommercialEntityBase {
  competitionInfo?: CompetitionInfo;
  shopProfile?: ShopProfile;
}