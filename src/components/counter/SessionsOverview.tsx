import React from 'react';
import { DiningTable, TableSession, ParcelOrder, Bill, OrderItem } from '../../types/database';
import { formatPaiseToINR } from '../../lib/currency';
import { Plus, Package, Clock, Receipt, Utensils } from 'lucide-react';

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Live Dining Sessions & Takeaway Parcels</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {activeTableSessions.length} active table{activeTableSessions.length !== 1 ? 's' : ''} &bull; {activeParcels.length} active parcel{activeParcels.length !== 1 ? 's' : ''}
          </span>
        </div>

        <button type="button" className="btn-primary" onClick={onCreateParcel}>
          <Plus size={15} />
          Create Takeaway Parcel
        </button>
      </div>

      {/* Grid: Active Tables */}
      <div style={{ marginBottom: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <Utensils size={15} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Active Tables ({activeTableSessions.length})
          </span>
        </div>

        {activeTableSessions.length === 0 ? (
          <div className="panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontWeight: 500 }}>No active table sessions</p>
            <span style={{ fontSize: '12px' }}>All tables are currently vacant</span>
          </div>
        ) : (
          <div className="grid-3">
            {activeTableSessions.map((session) => {
              const tableNumber = tableMap.get(session.table_id) || 'Table';
              const bill = bills.find((b) => b.table_session_id === session.id);
              const items = orderItems.filter((oi) => oi.table_session_id === session.id);
              const totalItems = items.reduce((sum, oi) => sum + (oi.ordered_quantity - oi.cancelled_quantity), 0);
              const readyItems = items.reduce((sum, oi) => sum + oi.prepared_quantity, 0);

              const elapsedMins = Math.floor((Date.now() - new Date(session.opened_at).getTime()) / 60000);

              return (
                <div key={session.id} className="panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 800, fontSize: '17px', color: 'var(--text-primary)' }}>
                        {tableNumber}
                      </span>
                      <span className="badge badge-pending">RUNNING BILL</span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                      <Clock size={12} />
                      <span>Opened {elapsedMins}m ago (by {session.created_by_staff_id})</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', marginBottom: '10px' }}>
                      <span>Items: <strong>{totalItems}</strong></span>
                      <span>Kitchen Prep: <strong style={{ color: readyItems >= totalItems && totalItems > 0 ? 'var(--success)' : 'var(--warning)' }}>{readyItems}/{totalItems} ready</strong></span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Running Total</span>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {formatPaiseToINR(bill?.final_total_paise || 0)}
                      </span>
                    </div>

                    {bill && (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => onOpenBill(bill, tableNumber)}
                      >
                        <Receipt size={13} />
                        View Bill / Settle
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <Package size={15} color="#0284c7" />
          <span style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Active Takeaway Parcels ({activeParcels.length})
          </span>
        </div>

        {activeParcels.length === 0 ? (
          <div className="panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontWeight: 500 }}>No active parcel orders</p>
            <span style={{ fontSize: '12px' }}>Use &quot;Create Takeaway Parcel&quot; above to place new takeaway orders</span>
          </div>
        ) : (
          <div className="grid-3">
            {activeParcels.map((parcel) => {
              const bill = bills.find((b) => b.parcel_id === parcel.id);
              const items = orderItems.filter((oi) => oi.parcel_id === parcel.id);
              const totalItems = items.reduce((sum, oi) => sum + (oi.ordered_quantity - oi.cancelled_quantity), 0);
              const readyItems = items.reduce((sum, oi) => sum + oi.prepared_quantity, 0);

              const elapsedMins = Math.floor((Date.now() - new Date(parcel.created_at).getTime()) / 60000);

              return (
                <div key={parcel.id} className="panel" style={{ borderLeft: '4px solid #0284c7', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 800, fontSize: '16px', color: '#0369a1' }}>
                        {parcel.parcel_code}
                      </span>
                      <span className="badge badge-pending">PARCEL PENDING</span>
                    </div>

                    {parcel.customer_notes && (
                      <p style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        &quot;{parcel.customer_notes}&quot;
                      </p>
                    )}

                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                      <Clock size={12} />
                      <span>Placed {elapsedMins}m ago</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', marginBottom: '10px' }}>
                      <span>Items: <strong>{totalItems}</strong></span>
                      <span>Kitchen Prep: <strong style={{ color: readyItems >= totalItems && totalItems > 0 ? 'var(--success)' : 'var(--warning)' }}>{readyItems}/{totalItems} ready</strong></span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Amount Due</span>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {formatPaiseToINR(bill?.final_total_paise || 0)}
                      </span>
                    </div>

                    {bill && (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => onOpenBill(bill, parcel.parcel_code)}
                      >
                        <Receipt size={13} />
                        Collect & Settle
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
