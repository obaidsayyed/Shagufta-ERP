import React from 'react';
import { DiningTable, TableSession, ParcelOrder, Bill, OrderItem } from '../../types/database';
import { formatPaiseToINR } from '../../lib/currency';


interface SessionsOverviewProps {
  tables: DiningTable[];
  tableSessions: TableSession[];
  parcelOrders: ParcelOrder[];
  bills: Bill[];
  orderItems: OrderItem[];
  onOpenBill: (bill: Bill, title: string) => void;
  onCreateParcel: () => void;
}

export const SessionsOverview: React.FC<SessionsOverviewProps> = ({
  tables,
  tableSessions,
  parcelOrders,
  bills,
  orderItems,
  onOpenBill,
  onCreateParcel,
}) => {
  const activeTableSessions = tableSessions.filter((s) => s.session_status === 'open');
  const activeParcels = parcelOrders.filter((p) => p.status === 'open');

  const tableMap = new Map(tables.map((t) => [t.id, t.table_number]));

  return (
    <div>
      {/* Top action row */}
      <div className="sessions-header-row">
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Live Dining Sessions & Takeaway Parcels</h2>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {activeTableSessions.length} active table{activeTableSessions.length !== 1 ? 's' : ''}, {activeParcels.length} active parcel{activeParcels.length !== 1 ? 's' : ''}
          </span>
        </div>

        <button type="button" className="btn-primary btn-sm" onClick={onCreateParcel} style={{ whiteSpace: 'nowrap' }}>
          Create Takeaway Parcel
        </button>
      </div>

      {/* Grid: Active Tables */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <span style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Active Tables ({activeTableSessions.length})
          </span>
        </div>

        {activeTableSessions.length === 0 ? (
          <div className="panel" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontWeight: 500, fontSize: '13px' }}>No active table sessions</p>
            <span style={{ fontSize: '11px' }}>All tables are currently vacant</span>
          </div>
        ) : (
          <div className="sessions-grid">
            {activeTableSessions.map((session) => {
              const rawTableNumber = tableMap.get(session.table_id) || 'Table';
              const tableNumber = rawTableNumber.includes('(2)') || session.customer_number === 2
                ? (rawTableNumber.includes('(2)') ? rawTableNumber : `${rawTableNumber} (2)`)
                : rawTableNumber;
              const bill = bills.find((b) => b.table_session_id === session.id);
              const items = orderItems.filter((oi) => oi.table_session_id === session.id);
              const totalItems = items.reduce((sum, oi) => sum + (oi.ordered_quantity - oi.cancelled_quantity), 0);
              const readyItems = items.reduce((sum, oi) => sum + oi.prepared_quantity, 0);

              const elapsedMins = Math.floor((Date.now() - new Date(session.opened_at).getTime()) / 60000);

              return (
                <div key={session.id} className="session-bill-card">
                  {/* Card Header: Table identifier + Status badge + Running total */}
                  <div className="session-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexWrap: 'wrap' }}>
                      <span className="session-card-title">
                        {tableNumber}
                      </span>
                      <span className="badge badge-pending" style={{ fontSize: '10px', padding: '1px 6px', whiteSpace: 'nowrap' }}>
                        RUNNING
                      </span>
                    </div>

                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span className="session-card-amount-label">Running Total</span>
                      <span className="session-card-amount">
                        {formatPaiseToINR(bill?.final_total_paise || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Card Details: Items, Kitchen prep progress, Elapsed time */}
                  <div className="session-card-meta">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>Items: <strong style={{ color: 'var(--text-primary)' }}>{totalItems}</strong></span>
                      <span>
                        Kitchen: <strong style={{ color: readyItems >= totalItems && totalItems > 0 ? 'var(--emerald-green)' : 'var(--warning)' }}>
                          {readyItems}/{totalItems} ready
                        </strong>
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {elapsedMins}m ago
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="session-card-footer">
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      By {session.created_by_staff_id}
                    </span>
                    {bill && (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => onOpenBill(bill, tableNumber)}
                        style={{ padding: '3px 10px', minHeight: '26px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        <span>View / Settle</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid: Active Parcels */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <span style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Active Takeaway Parcels ({activeParcels.length})
          </span>
        </div>

        {activeParcels.length === 0 ? (
          <div className="panel" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontWeight: 500, fontSize: '13px' }}>No active parcel orders</p>
            <span style={{ fontSize: '11px' }}>Use &quot;Create Takeaway Parcel&quot; above to place new takeaway orders</span>
          </div>
        ) : (
          <div className="sessions-grid">
            {activeParcels.map((parcel) => {
              const bill = bills.find((b) => b.parcel_id === parcel.id);
              const items = orderItems.filter((oi) => oi.parcel_id === parcel.id);
              const totalItems = items.reduce((sum, oi) => sum + (oi.ordered_quantity - oi.cancelled_quantity), 0);
              const readyItems = items.reduce((sum, oi) => sum + oi.prepared_quantity, 0);

              const elapsedMins = Math.floor((Date.now() - new Date(parcel.created_at).getTime()) / 60000);

              return (
                <div key={parcel.id} className="session-bill-card parcel-card">
                  <div className="session-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexWrap: 'wrap' }}>
                      <span className="session-card-title" style={{ color: 'var(--emerald-green)' }}>
                        {parcel.parcel_code}
                      </span>
                      <span className="badge badge-pending" style={{ fontSize: '10px', padding: '1px 6px', whiteSpace: 'nowrap' }}>
                        PARCEL
                      </span>
                    </div>

                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span className="session-card-amount-label">Amount Due</span>
                      <span className="session-card-amount">
                        {formatPaiseToINR(bill?.final_total_paise || 0)}
                      </span>
                    </div>
                  </div>

                  {parcel.customer_notes && (
                    <p style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--text-secondary)', margin: '2px 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      &quot;{parcel.customer_notes}&quot;
                    </p>
                  )}

                  <div className="session-card-meta">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>Items: <strong>{totalItems}</strong></span>
                      <span>
                        Kitchen: <strong style={{ color: readyItems >= totalItems && totalItems > 0 ? 'var(--emerald-green)' : 'var(--warning)' }}>
                          {readyItems}/{totalItems} ready
                        </strong>
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {elapsedMins}m ago
                    </div>
                  </div>

                  <div className="session-card-footer">
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Takeaway Order
                    </span>
                    {bill && (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => onOpenBill(bill, parcel.parcel_code)}
                        style={{ padding: '3px 10px', minHeight: '26px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        <span>Collect & Settle</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
