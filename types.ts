
export interface VehicleInfo {
  brand: string;
  model: string;
  year: string;
  km: number;
  fipeValue: number;
  description: string;
  imageUrl?: string;
  auctionDate: string;
  lotId: string;
  patio?: string;
  auctionSummary?: string;
  pointsOfAttention?: string[];
}

export interface CalculationParams {
  targetProfitMargin: number; // percentage
  resaleDiscountPercentage: number; // percentage discount on FIPE for resale
  fixedCosts: number; // e.g., towing, paperwork, initial fix
  auctionFeePercentage: number; // usually 5%
}

export interface CalculatedResults {
  maxBid: number;
  projectedProfit: number;
  totalInvestment: number;
  resaleValue: number;
}

export interface AuctionLot extends VehicleInfo {
  id: string;
  url: string;
  status: 'watching' | 'bidding' | 'won' | 'lost';
  params: CalculationParams;
  lastUpdated: string;
  sourceSite?: string;
  groundingSources?: any[];
}

declare global {
  interface Window {
    aistudio?: {
      openSelectKey?: () => Promise<void>;
      hasSelectedApiKey?: () => Promise<boolean>;
    };
  }
}
