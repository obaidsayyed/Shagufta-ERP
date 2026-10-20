import React, { useState } from 'react';
import { Bill, TableSession, ParcelOrder, DiningTable, OrderItem, BillAdjustment } from '../../types/database';
import { formatPaiseToINR } from '../../lib/currency';

import { BillDetailModal } from './BillDetailModal';

interface HistoricalBillsViewProps {
  bills: Bill[];
  tableSessions: TableSession[];
  parcelOrders: ParcelOrder[];
  tables: DiningTable[];
  orderItems: OrderItem[];
  adjustments: BillAdjustment[];
}

export const HistoricalBillsView: React.FC<HistoricalBillsViewProps> = ({
  bills,
  tableSessions,
  parcelOrders,
  tables,
  orderItems,
  adjustments,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'settled' | 'unsettled'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'online'>('all');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  const tableMap = new Map(tables.map((t) => [t.id, t.table_number]));
  const sessionTableMap = new Map(
    tableSessions.map((s) => {
      const base = tableMap.get(s.table_id) || 'Table';
      const name = base.includes('(2)') || s.customer_number === 2
        ? (base.includes('(2)') ? base : `${base} (2)`)
        : base;
      return [s.id, name];
    })
  );
  const parcelMap = new Map(parcelOrders.map((p) => [p.id, p.parcel_code]));

  const getTargetTitle = (b: Bill) => {
    if (b.table_session_id) return sessionTableMap.get(b.table_session_id) || 'Dine-In Table';
    if (b.parcel_id) return parcelMap.get(b.parcel_id) || 'Parcel';
    return 'Order';
  };

  const filteredBills = bills.filter((b) => {
    const targetTitle = getTargetTitle(b);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchBillNo = b.bill_number.toLowerCase().includes(q);
      const matchTarget = targetTitle.toLowerCase().includes(q);
      if (!matchBillNo && !matchTarget) return false;
    }

    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (paymentFilter !== 'all' && b.payment_method !== paymentFilter) return false;

    return true;
  });

  const selectedItems = selectedBill
    ? orderItems.filter((oi) => 
        (selectedBill.table_session_id && oi.table_session_id === selectedBill.table_session_id) ||
        (selectedBill.parcel_id && oi.parcel_id === selectedBill.parcel_id)
      )
    : [];

  const selectedAdjustments = selectedBill
    ? adjustments.filter((ba) => ba.bill_id === selectedBill.id)
    : [];

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Historical Bills & Records</h2>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Authoritative audit of all settled transactions and unsettled dining bills
        </span>
      </div>

      {/* Filter Toolbar */}
      <div className="panel" style={{ marginBottom: '12px', padding: '8px 12px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <input
              type="text"
              placeholder="Search by Bill #, Table or Parcel..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', minHeight: '30px', fontSize: '12px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'settled' | 'unsettled')}
              style={{ minHeight: '30px', fontSize: '12px' }}
            >
              <option value="all">All Statuses</option>
              <option value="settled">Settled Only</option>
              <option value="unsettled">Unsettled Only</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as 'all' | 'cash' | 'online')}
              style={{ minHeight: '30px', fontSize: '12px' }}
            >
              <option value="all">All Payment Methods</option>
              <option value="cash">Cash Only</option>
              <option value="online">Online Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bills Table */}
      <div className="panel table-responsive" style={{ padding: 0 }}>
        {filteredBills.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontWeight: 600, fontSize: '13px' }}>No bills match your search criteria</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Bill Number</th>
                <th>Target</th>
                <th>Status</th>
                <th>Created</th>
                <th>Settled At</th>
                <th>Payment</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map((bill) => {
                const target = getTargetTitle(bill);
                const isSettled = bill.status === 'settled';
                return (
                  <tr key={bill.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                      {bill.bill_number}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {target}
                    </td>
                    <td>
                      {isSettled ? (
                        <span className="badge badge-ready">SETTLED</span>
                      ) : (
                        <span className="badge badge-pending">UNSETTLED</span>
                      )}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {new Date(bill.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {bill.settled_at
                        ? new Date(bill.settled_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                        : '-'}
                    </td>
                    <td>
                      {bill.payment_method ? (
                        <span style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '11px' }}>
                          {bill.payment_method}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '14px' }}>
                      {formatPaiseToINR(bill.final_total_paise)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => setSelectedBill(bill)}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Bill Detail Modal */}
      {selectedBill && (
        <BillDetailModal
          isOpen={true}
          onClose={() => setSelectedBill(null)}
          bill={selectedBill}
          identifierTitle={getTargetTitle(selectedBill)}
          orderItems={selectedItems}
          adjustments={selectedAdjustments}
          onOpenAdjustment={() => {}}
          onOpenSettlement={() => {}}
        />
      )}
    </div>
  );
};
