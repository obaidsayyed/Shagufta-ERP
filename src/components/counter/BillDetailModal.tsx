import React from 'react';
import { Bill, OrderItem, BillAdjustment } from '../../types/database';
import { formatPaiseToINR } from '../../lib/currency';


interface BillDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill | null;
  identifierTitle: string;
  orderItems: OrderItem[];
  adjustments: BillAdjustment[];
  onOpenAdjustment: (item: OrderItem) => void;
  onOpenSettlement: () => void;
}

export const BillDetailModal: React.FC<BillDetailModalProps> = ({
  isOpen,
  onClose,
  bill,
  identifierTitle,
  orderItems,
  adjustments,
  onOpenAdjustment,
  onOpenSettlement,
}) => {
  if (!isOpen || !bill) return null;

  const isSettled = bill.status === 'settled';

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Bill: {bill.bill_number}</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Target: <strong>{identifierTitle}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isSettled ? (
              <span className="badge badge-ready">
                SETTLED ({bill.payment_method?.toUpperCase()})
              </span>
            ) : (
              <span className="badge badge-pending">UNSETTLED RUNNING BILL</span>
            )}
            <button type="button" className="btn-secondary btn-sm" onClick={onClose} style={{ padding: '2px 8px', fontSize: '11px' }}>
              Close
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '12px 14px' }}>
          {/* Order Items Table */}
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              ITEMIZED ORDERS
            </span>

            {orderItems.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No dishes ordered yet.</p>
            ) : (
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                      <th style={{ textAlign: 'center' }}>Kitchen Prep</th>
                      <th style={{ textAlign: 'right' }}>Price</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      {!isSettled && <th style={{ textAlign: 'center' }}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item) => {
                      const activeQty = item.ordered_quantity - item.cancelled_quantity;
                      const lineTotal = activeQty * item.unit_price_paise;
                      return (
                        <tr key={item.id} style={{ opacity: item.status === 'cancelled' ? 0.6 : 1 }}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '12.5px' }}>{item.dish_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.category_name}</div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>
                            {activeQty}
                            {item.cancelled_quantity > 0 && (
                              <span style={{ fontSize: '10px', color: 'var(--danger)', display: 'block' }}>
                                (-{item.cancelled_quantity} cancl)
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {item.prepared_quantity >= activeQty && activeQty > 0 ? (
                              <span className="badge badge-ready" style={{ fontSize: '10px' }}>Ready</span>
                            ) : item.cancelled_quantity === item.ordered_quantity ? (
                              <span className="badge badge-danger" style={{ fontSize: '10px' }}>Cancelled</span>
                            ) : (
                              <span className="badge badge-pending" style={{ fontSize: '10px' }}>
                                {item.prepared_quantity}/{activeQty} Prep
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '12px' }}>{formatPaiseToINR(item.unit_price_paise)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '12.5px' }}>{formatPaiseToINR(lineTotal)}</td>
                          {!isSettled && (
                            <td style={{ textAlign: 'center' }}>
                              {activeQty > 0 && (
                                <button
                                  type="button"
                                  className="btn-secondary btn-sm"
                                  style={{ fontSize: '10.5px', padding: '2px 6px' }}
                                  onClick={() => onOpenAdjustment(item)}
                                >
                                  Adjust
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Adjustments Section */}
          {adjustments.length > 0 && (
            <div style={{ marginBottom: '12px', backgroundColor: 'var(--bg-surface-subtle)', padding: '8px 10px', borderRadius: '5px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                RECORDED ADJUSTMENTS & RETURNS
              </span>
              {adjustments.map((adj) => (
                <div key={adj.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', padding: '2px 0' }}>
                  <div>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                      {adj.adjustment_type.replace(/_/g, ' ')}
                    </span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
                      ({adj.reason} by {adj.authorized_by_staff_id})
                    </span>
                  </div>
                  <strong style={{ color: 'var(--danger)' }}>
                    {formatPaiseToINR(adj.amount_paise)}
                  </strong>
                </div>
              ))}
            </div>
          )}

          {/* Totals Summary */}
          <div style={{ borderTop: '1px solid var(--border-strong)', paddingTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Gross Subtotal:</span>
              <span>{formatPaiseToINR(bill.subtotal_paise)}</span>
            </div>
            {bill.adjustments_paise !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '12px', color: 'var(--danger)' }}>
                <span>Adjustments / Returns:</span>
                <span>{formatPaiseToINR(bill.adjustments_paise)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '15px', marginTop: '4px' }}>
              <span>Final Total Due:</span>
              <span style={{ color: 'var(--text-primary)' }}>{formatPaiseToINR(bill.final_total_paise)}</span>
            </div>
          </div>

          {isSettled && (
            <div style={{ marginTop: '10px', padding: '6px 10px', backgroundColor: 'var(--success-bg)', borderRadius: '5px', fontSize: '11.5px', color: 'var(--success)' }}>
              <span>
                Settled on {bill.settled_at ? new Date(bill.settled_at).toLocaleString('en-IN') : 'N/A'} via <strong>{bill.payment_method?.toUpperCase()}</strong> by staff {bill.settled_by_staff_id || 'Admin'}.
              </span>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ padding: '8px 14px' }}>
          <button
            type="button"
            className="btn-primary btn-sm"
            style={{ backgroundColor: 'var(--primary-action)', borderColor: 'var(--primary-action)', color: '#FFFFFF', fontWeight: 700 }}
            onClick={() => window.print()}
          >
            <span>Print Bill</span>
          </button>
          {!isSettled && (
            <button
              type="button"
              className="btn-success btn-sm"
              style={{ fontWeight: 700 }}
              onClick={onOpenSettlement}
            >
              Collect & Settle Bill
            </button>
          )}
          <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
