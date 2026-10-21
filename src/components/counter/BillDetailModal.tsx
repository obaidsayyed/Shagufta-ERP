import React, { useState } from 'react';
import { Bill, OrderItem, BillAdjustment, MenuItem } from '../../types/database';
import { formatPaiseToINR } from '../../lib/currency';

interface BillDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill | null;
  identifierTitle: string;
  orderItems: OrderItem[];
  adjustments?: BillAdjustment[];
  menuItems?: MenuItem[];
  onAdjustItem?: (orderItemId: string, action: 'increase' | 'decrease' | 'delete') => Promise<void>;
  onAddDish?: (menuItemId: string) => Promise<void>;
  onOpenAdjustment?: (item: OrderItem) => void;
  onOpenSettlement?: () => void;
}

export const BillDetailModal: React.FC<BillDetailModalProps> = ({
  isOpen,
  onClose,
  bill,
  identifierTitle,
  orderItems,
  menuItems = [],
  onAdjustItem,
  onAddDish,
  onOpenSettlement,
}) => {
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');

  if (!isOpen || !bill) return null;

  const isSettled = bill.status === 'settled';

  // Only display items that have active quantity > 0
  const activeItems = orderItems.filter(
    (item) => item.ordered_quantity - item.cancelled_quantity > 0
  );

  const calculatedSubtotal = activeItems.reduce((acc, item) => {
    const qty = item.ordered_quantity - item.cancelled_quantity;
    return acc + qty * item.unit_price_paise;
  }, 0);

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
          </div>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '12px 14px' }}>
          {/* Order Items Table */}
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              ITEMIZED ORDERS
            </span>

            {activeItems.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No dishes on this bill.</p>
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
                      {isAdjusting && <th style={{ textAlign: 'center' }}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {activeItems.map((item) => {
                      const activeQty = item.ordered_quantity - item.cancelled_quantity;
                      const lineTotal = activeQty * item.unit_price_paise;
                      return (
                        <tr key={item.id}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '12.5px' }}>{item.dish_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.category_name}</div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isAdjusting ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <button
                                  type="button"
                                  className="btn-secondary btn-sm"
                                  style={{ width: '22px', height: '22px', padding: 0, fontWeight: 800, fontSize: '13px', lineHeight: '20px' }}
                                  onClick={() => onAdjustItem?.(item.id, 'decrease')}
                                  title="Decrease quantity"
                                >
                                  -
                                </button>
                                <span style={{ fontWeight: 700, minWidth: '18px', textAlign: 'center' }}>
                                  {activeQty}
                                </span>
                                <button
                                  type="button"
                                  className="btn-secondary btn-sm"
                                  style={{ width: '22px', height: '22px', padding: 0, fontWeight: 800, fontSize: '13px', lineHeight: '20px' }}
                                  onClick={() => onAdjustItem?.(item.id, 'increase')}
                                  title="Increase quantity"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontWeight: 600 }}>{activeQty}</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {item.prepared_quantity >= activeQty && activeQty > 0 ? (
                              <span className="badge badge-ready" style={{ fontSize: '10px' }}>Ready</span>
                            ) : (
                              <span className="badge badge-pending" style={{ fontSize: '10px' }}>
                                {item.prepared_quantity}/{activeQty} Prep
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '12px' }}>{formatPaiseToINR(item.unit_price_paise)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '12.5px' }}>{formatPaiseToINR(lineTotal)}</td>
                          {isAdjusting && (
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn-danger btn-sm"
                                style={{ fontSize: '10.5px', padding: '2px 8px' }}
                                onClick={() => onAdjustItem?.(item.id, 'delete')}
                              >
                                Remove
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add Dish Selector when in adjusting mode */}
            {isAdjusting && menuItems.length > 0 && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px 10px',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  borderRadius: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  ADD DISH:
                </span>
                <select
                  value={selectedMenuItemId}
                  onChange={(e) => setSelectedMenuItemId(e.target.value)}
                  style={{ flex: 1, minHeight: '28px', fontSize: '12px', padding: '2px 6px' }}
                >
                  <option value="">Select dish to add...</option>
                  {menuItems
                    .filter((m) => m.is_available && !m.is_archived)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({formatPaiseToINR(m.price_paise)})
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={!selectedMenuItemId}
                  style={{ fontSize: '11px', padding: '4px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (selectedMenuItemId && onAddDish) {
                      onAddDish(selectedMenuItemId);
                      setSelectedMenuItemId('');
                    }
                  }}
                >
                  + Add to Bill
                </button>
              </div>
            )}
          </div>

          {/* Totals Summary */}
          <div style={{ borderTop: '1px solid var(--border-strong)', paddingTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Gross Subtotal:</span>
              <span>{formatPaiseToINR(calculatedSubtotal)}</span>
            </div>
            {bill.adjustments_paise !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '12px', color: bill.adjustments_paise < 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                <span>Adjustments:</span>
                <span>{bill.adjustments_paise < 0 ? `- ${formatPaiseToINR(Math.abs(bill.adjustments_paise))}` : `+ ${formatPaiseToINR(bill.adjustments_paise)}`}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '15px', marginTop: '4px' }}>
              <span>Final Total Due:</span>
              <span style={{ color: 'var(--text-primary)' }}>{formatPaiseToINR(Math.max(0, calculatedSubtotal + (bill.adjustments_paise || 0)))}</span>
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
          {isAdjusting ? (
            <>
              <button
                type="button"
                className="btn-success btn-sm"
                style={{ fontWeight: 700 }}
                onClick={() => setIsAdjusting(false)}
              >
                Done Adjusting
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
                Close
              </button>
            </>
          ) : (
            <>
              {!isSettled && (
                <>
                  {onOpenSettlement && (
                    <button
                      type="button"
                      className="btn-success btn-sm"
                      style={{ fontWeight: 700 }}
                      onClick={onOpenSettlement}
                    >
                      Collect & Settle Bill
                    </button>
                  )}
                  {onAdjustItem && (
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      style={{ fontWeight: 600 }}
                      onClick={() => setIsAdjusting(true)}
                    >
                      Adjust Bill
                    </button>
                  )}
                </>
              )}
              <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
