// Types for Financial Reports and Dish Analytics

export type DateFilterPreset = 'today' | 'yesterday' | 'last_30_days' | 'previous_month' | 'custom';
export type PaymentFilter = 'all' | 'cash' | 'online';

export interface AnalyticsFilter {
  preset: DateFilterPreset;
  customStartDate?: string; // YYYY-MM-DD
  customEndDate?: string;   // YYYY-MM-DD
  paymentMethod: PaymentFilter;
}

export interface DayMetricPoint {
  date: string; // YYYY-MM-DD
  settledCount: number;
  cashPaise: number;
  onlinePaise: number;
  totalPaise: number;
}

export interface OverallMetrics {
  totalSettledBills: number;
  totalSettledRevenuePaise: number;
  totalCashPaise: number;
  totalOnlinePaise: number;
  averageBillPaise: number;
  activeUnsettledBillsCount: number;
  activeUnsettledPaise: number; // Distinct from collected revenue!
}

export interface DishPerformance {
  dish_name: string;
  category_name: string;
  unit_price_paise: number;
  gross_quantity_ordered: number;
  cancelled_or_adjusted_quantity: number;
  net_quantity_sold: number;
  net_revenue_paise: number;
  category_total_revenue_paise: number;
  category_revenue_share_percent: number;
  rank_in_category: number;
}

export interface CategoryPerformance {
  category_name: string;
  net_quantity_sold: number;
  net_revenue_paise: number;
  total_sales_share_percent: number;
  dish_count: number;
}
