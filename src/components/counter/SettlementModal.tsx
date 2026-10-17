import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Bill, PaymentMethod } from '../../types/database';
import { formatPaiseToINR } from '../../lib/currency';
import { CheckCircle2, Banknote, Smartphone, X, AlertCircle } from 'lucide-react';

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill | null;
  identifierTitle: string; // e.g. "Table T4" or "Parcel PCL-1002"
  onSettlementComplete: () => void;
}

export const SettlementModal: React.FC<SettlementModalProps> = ({
  isOpen,
  onClose,
  bill,
  identifierTitle,
  onSettlementComplete,
}) => {
  const { currentStaff } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !bill) return null;

  const handleSettle = async () => {
    if (!currentStaff) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const idempotency_key = `settle_${bill.id}_${Date.now()}`;
      await api.settleBill({
        bill_id: bill.id,
        payment_method: paymentMethod,
        caller_staff: currentStaff,
        idempotency_key,
      });

      onSettlementComplete();
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
      <div className="modal-content" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="var(--success)" />
            <h3>Settle Bill — {identifierTitle}</h3>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={onClose} style={{ border: 'none', padding: '4px' }}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {errorMessage && (
            <div className="alert-banner alert-banner-danger" style={{ marginBottom: '12px' }}>
              <AlertCircle size={15} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Amount Due Box */}
          <div
            style={{
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface-subtle)',
              padding: '16px',
              borderRadius: '6px',
              marginBottom: '16px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Authoritative Amount Due
            </span>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
              {formatPaiseToINR(bill.final_total_paise)}
            </div>
            {bill.adjustments_paise !== 0 && (
              <span style={{ fontSize: '11px', color: 'var(--danger)', display: 'block', marginTop: '2px' }}>
                Includes {formatPaiseToINR(bill.adjustments_paise)} in authorized deductions
              </span>
            )}
          </div>

          {/* Payment Method Selector */}
          <label style={{ marginBottom: '8px' }}>Select Recorded Payment Method</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <button
              type="button"
              className={paymentMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}
              style={{
                flexDirection: 'column',
                minHeight: '64px',
                padding: '8px',
                gap: '4px',
              }}
              onClick={() => setPaymentMethod('cash')}
            >
              <Banknote size={20} />
              <span style={{ fontWeight: 600 }}>Cash Payment</span>
            </button>

            <button
              type="button"
              className={paymentMethod === 'online' ? 'btn-primary' : 'btn-secondary'}
              style={{
                flexDirection: 'column',
                minHeight: '64px',
                padding: '8px',
                gap: '4px',
              }}
              onClick={() => setPaymentMethod('online')}
            >
              <Smartphone size={20} />
              <span style={{ fontWeight: 600 }}>Online (UPI/Card)</span>
            </button>
          </div>

          <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Notice: Confirming settlement marks this session closed and records collection under <strong>{paymentMethod.toUpperCase()}</strong>. Future orders for this table will begin a fresh session.
          </p>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ backgroundColor: 'var(--primary-action)', borderColor: 'var(--primary-action)', color: '#FFFFFF', fontWeight: 700 }}
            onClick={handleSettle}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Recording Settlement...' : `Settle Payment (${paymentMethod.toUpperCase()})`}
          </button>
        </div>
      </div>
    </div>
  );
};
