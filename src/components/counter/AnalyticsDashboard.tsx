import React, { useState } from 'react';
import { Bill, OrderItem } from '../../types/database';
import { 
  AnalyticsFilter, 
  DateFilterPreset, 
  PaymentFilter 
} from '../../types/analytics';
import { api } from '../../lib/api';
import { formatPaiseToINR } from '../../lib/currency';
import { 
  TrendingUp, 
  Banknote, 
  Smartphone, 
  Receipt, 
  Calendar, 
  Award,
  Layers,
  PieChart
} from 'lucide-react';

interface AnalyticsDashboardProps {
  bills: Bill[];
  orderItems: OrderItem[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  bills,
  orderItems,
}) => {
  const [filter, setFilter] = useState<AnalyticsFilter>({
    preset: 'today',
    paymentMethod: 'all',
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'dishes' | 'categories'>('overview');

  const { overall, dayMetrics, dishPerformance, categoryPerformance } = api.calculateAnalytics(
    bills,
    orderItems,
    filter
  );

  return (
    <div>
      {/* Analytics Filter Header */}
      <div className="panel" style={{ marginBottom: '16px', padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Financial & Dish Analytics</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Authoritative revenue auditing, payment collections and category-aware dish performance
            </span>
          </div>

          {/* Filter Controls */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Date Preset Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={13} color="var(--text-muted)" />
              <select
                value={filter.preset}
                onChange={(e) => setFilter({ ...filter, preset: e.target.value as DateFilterPreset })}
                style={{ minHeight: '32px', fontSize: '12px' }}
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="previous_month">Previous Calendar Month</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {/* Custom Date Inputs if custom preset */}
            {filter.preset === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="date"
                  value={filter.customStartDate || ''}
                  onChange={(e) => setFilter({ ...filter, customStartDate: e.target.value })}
                  style={{ minHeight: '32px', fontSize: '12px', padding: '2px 6px' }}
                />
                <span style={{ fontSize: '12px' }}>to</span>
                <input
                  type="date"
                  value={filter.customEndDate || ''}
                  onChange={(e) => setFilter({ ...filter, customEndDate: e.target.value })}
                  style={{ minHeight: '32px', fontSize: '12px', padding: '2px 6px' }}
                />
              </div>
            )}

            {/* Payment Filter */}
            <select
              value={filter.paymentMethod}
              onChange={(e) => setFilter({ ...filter, paymentMethod: e.target.value as PaymentFilter })}
              style={{ minHeight: '32px', fontSize: '12px' }}
            >
              <option value="all">All Payments</option>
              <option value="cash">Cash Only</option>
              <option value="online">Online Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Metric Cards - Minimalist, functional proportion */}
      <div className="grid-4" style={{ marginBottom: '16px' }}>
        <div className="panel" style={{ padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Settled Collections
            </span>
            <TrendingUp size={15} color="var(--accent)" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {formatPaiseToINR(overall.totalSettledRevenuePaise)}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {overall.totalSettledBills} settled transaction{overall.totalSettledBills !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="panel" style={{ padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Cash Collections
            </span>
            <Banknote size={15} color="var(--success)" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {formatPaiseToINR(overall.totalCashPaise)}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {overall.totalSettledRevenuePaise > 0
              ? `${Math.round((overall.totalCashPaise / overall.totalSettledRevenuePaise) * 100)}% of total collections`
              : '0% of total'}
          </span>
        </div>

        <div className="panel" style={{ padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Online (UPI/Digital)
            </span>
            <Smartphone size={15} color="#0284c7" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {formatPaiseToINR(overall.totalOnlinePaise)}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {overall.totalSettledRevenuePaise > 0
              ? `${Math.round((overall.totalOnlinePaise / overall.totalSettledRevenuePaise) * 100)}% of total collections`
              : '0% of total'}
          </span>
        </div>

        <div className="panel" style={{ padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Average Settled Bill
            </span>
            <Receipt size={15} color="var(--warning)" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {formatPaiseToINR(overall.averageBillPaise)}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Across {overall.totalSettledBills} settled ticket{overall.totalSettledBills !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Operational Integrity Banner: Explicit distinction between settled revenue and unsettled running bills */}
      <div className="alert-banner alert-banner-info" style={{ marginBottom: '16px' }}>
        <span>
          <strong>Financial Integrity Notice:</strong> Unsettled dining sessions currently total{' '}
          <strong>{formatPaiseToINR(overall.activeUnsettledPaise)}</strong> across {overall.activeUnsettledBillsCount} active bills.{' '}
          These amounts are strictly <strong>excluded</strong> from revenue metrics until the customer pays and the bill is settled.
        </span>
      </div>

      {/* Tabs for Overview Trends vs Dish Performance vs Category Breakdown */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn-sm ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('overview')}
        >
          Daily Revenue Trends
        </button>
        <button
          type="button"
          className={`btn-sm ${activeTab === 'dishes' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('dishes')}
        >
          Dish Performance & Ranking
        </button>
        <button
          type="button"
          className={`btn-sm ${activeTab === 'categories' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('categories')}
        >
          Category Share Breakdown
        </button>
      </div>

      {/* Tab 1: Daily Revenue Trends */}
      {activeTab === 'overview' && (
        <div className="panel table-responsive" style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 700 }}>
            Daily Settlement Breakdown
          </div>
          {dayMetrics.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No settled transactions recorded in selected filter period.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th style={{ textAlign: 'center' }}>Settled Bills</th>
                  <th style={{ textAlign: 'right' }}>Cash Collections</th>
                  <th style={{ textAlign: 'right' }}>Online Collections</th>
                  <th style={{ textAlign: 'right' }}>Total Settled Sales</th>
                </tr>
              </thead>
              <tbody>
                {dayMetrics.map((dm) => (
                  <tr key={dm.date}>
                    <td style={{ fontWeight: 600 }}>{dm.date}</td>
                    <td style={{ textAlign: 'center' }}>{dm.settledCount}</td>
                    <td style={{ textAlign: 'right' }}>{formatPaiseToINR(dm.cashPaise)}</td>
                    <td style={{ textAlign: 'right' }}>{formatPaiseToINR(dm.onlinePaise)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatPaiseToINR(dm.totalPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 2: Category-Aware Dish Performance */}
      {activeTab === 'dishes' && (
        <div className="panel table-responsive" style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>Individual Dish Sales & Category Share</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Historical snapshots preserve dish details even if renamed or repriced later
            </span>
          </div>

          {dishPerformance.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No dish sales recorded in settled bills for this period.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Dish Name</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'center' }}>Cat Rank</th>
                  <th style={{ textAlign: 'center' }}>Net Qty Sold</th>
                  <th style={{ textAlign: 'center' }}>Returns/Adjusted</th>
                  <th style={{ textAlign: 'right' }}>Unit Price</th>
                  <th style={{ textAlign: 'right' }}>Net Sales Revenue</th>
                  <th style={{ textAlign: 'right' }}>Category Share</th>
                </tr>
              </thead>
              <tbody>
                {dishPerformance.map((dp) => (
                  <tr key={dp.dish_name}>
                    <td style={{ fontWeight: 600 }}>{dp.dish_name}</td>
                    <td>
                      <span className="badge badge-settled">{dp.category_name}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '11px',
                          color: dp.rank_in_category === 1 ? 'var(--accent)' : 'var(--text-secondary)',
                        }}
                      >
                        #{dp.rank_in_category}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{dp.net_quantity_sold}</td>
                    <td style={{ textAlign: 'center', color: dp.cancelled_or_adjusted_quantity > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {dp.cancelled_or_adjusted_quantity}
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatPaiseToINR(dp.unit_price_paise)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {formatPaiseToINR(dp.net_revenue_paise)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {dp.category_revenue_share_percent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 3: Category Share Breakdown */}
      {activeTab === 'categories' && (
        <div className="panel table-responsive" style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 700 }}>
            Operational Category Performance
          </div>

          {categoryPerformance.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No category sales recorded in settled bills for this period.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th style={{ textAlign: 'center' }}>Dishes Sold</th>
                  <th style={{ textAlign: 'center' }}>Total Units</th>
                  <th style={{ textAlign: 'right' }}>Total Net Revenue</th>
                  <th style={{ textAlign: 'right' }}>Share of Total Sales</th>
                </tr>
              </thead>
              <tbody>
                {categoryPerformance.map((cp) => (
                  <tr key={cp.category_name}>
                    <td style={{ fontWeight: 700 }}>{cp.category_name}</td>
                    <td style={{ textAlign: 'center' }}>{cp.dish_count}</td>
                    <td style={{ textAlign: 'center' }}>{cp.net_quantity_sold}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatPaiseToINR(cp.net_revenue_paise)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                      {cp.total_sales_share_percent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
