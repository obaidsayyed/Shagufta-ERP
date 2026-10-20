import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { OrderItem, AdjustmentType } from '../../types/database';
import { formatPaiseToINR } from '../../lib/currency';


interface ItemAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderItem: OrderItem | null;
  onAdjustmentComplete: () => void;
}

export const ItemAdjustmentModal: React.FC<ItemAdjustmentModalProps> = ({
  isOpen,
  onClose,
  orderItem,
  onAdjustmentComplete,
}) => {
  const { currentStaff } = useAuth();
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('item_cancellation');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !orderItem) return null;

  const activeOrderedQty = orderItem.ordered_quantity - orderItem.cancelled_quantity;
  const isPrepared = orderItem.prepared_quantity > 0;
  const maxPossibleQty = adjustmentType === 'return' ? orderItem.prepared_quantity : activeOrderedQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStaff || !reason.trim() || quantity <= 0) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await api.adjustOrderItem({
        order_item_id: orderItem.id,
        adjustment_type: adjustmentType,
        quantity_to_adjust: quantity,
        reason: reason.trim(),
        caller_staff: currentStaff,
      });

      onAdjustmentComplete();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Adjust Bill Item: {orderItem.dish_name}</h3>
          <button type="button" className="btn-secondary btn-sm" onClick={onClose} style={{ padding: '2px 8px', fontSize: '11px' }}>
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '12px 14px' }}>
            {errorMessage && (
              <div className="alert-banner alert-banner-danger" style={{ marginBottom: '10px', padding: '6px 10px' }}>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Dish Info Context */}
            <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '8px 10px', borderRadius: '5px', marginBottom: '12px', fontSize: '11.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span>Unit Price: <strong>{formatPaiseToINR(orderItem.unit_price_paise)}</strong></span>
                <span>Active Ordered: <strong>{activeOrderedQty}</strong></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Prepared by Kitchen: <strong>{orderItem.prepared_quantity}</strong></span>
                <span>Cancelled: <strong>{orderItem.cancelled_quantity}</strong></span>
              </div>
            </div>

            {/* Adjustment Type Selection */}
            <div style={{ marginBottom: '10px' }}>
              <label htmlFor="adjustment-type-select" style={{ fontSize: '12px', fontWeight: 600 }}>Adjustment Scenario</label>
              <select
                id="adjustment-type-select"
                value={adjustmentType}
                onChange={(e) => {
                  const val = e.target.value as AdjustmentType;
                  setAdjustmentType(val);
                  setQuantity(1);
                }}
                style={{ width: '100%', minHeight: '30px', fontSize: '12px' }}
              >
                <option value="item_cancellation">Unprepared Item Cancellation (Removes from Kitchen Queue)</option>
                <option value="quantity_reduction">Quantity Reduction (Reduces Unprepared Count)</option>
                <option value="return" disabled={!isPrepared}>
                  Customer Return (Food Prepared - Preserves Kitchen History) {!isPrepared ? '(Not yet prepared)' : ''}
                </option>
              </select>
            </div>

            {/* Quantity */}
            <div style={{ marginBottom: '10px' }}>
              <label htmlFor="adjust-qty-input" style={{ fontSize: '12px', fontWeight: 600 }}>Quantity to Deduct (Max: {maxPossibleQty})</label>
              <input
                id="adjust-qty-input"
                type="number"
                min="1"
                max={maxPossibleQty}
                value={quantity}
                onChange={(e) => setQuantity(Math.min(maxPossibleQty, Math.max(1, parseInt(e.target.value) || 1)))}
                style={{ width: '100%', minHeight: '30px' }}
                required
              />
            </div>

            {/* Deducted Amount Calculation */}
            <div style={{ marginBottom: '12px', fontSize: '12px' }}>
              <span>Bill Deduction Amount: </span>
              <strong style={{ color: 'var(--danger)' }}>
                -{formatPaiseToINR(orderItem.unit_price_paise * quantity)}
              </strong>
            </div>

            {/* Audit Reason */}
            <div>
              <label htmlFor="adjust-reason-input" style={{ fontSize: '12px', fontWeight: 600 }}>Reason for Adjustment / Return (Mandatory Audit Log)</label>
              <textarea
                id="adjust-reason-input"
                rows={2}
                placeholder="e.g. Customer cancelled before cooking started / returned due to taste issue"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ width: '100%', resize: 'none', fontSize: '12px' }}
                required
              />
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '8px 14px' }}>
            <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-danger btn-sm"
              disabled={isSubmitting || !reason.trim() || quantity <= 0}
            >
              {isSubmitting ? 'Recording Adjustment...' : 'Apply Adjustment to Bill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
