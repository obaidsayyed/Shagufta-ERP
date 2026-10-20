import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Bill, PaymentMethod } from '../../types/database';
import { formatPaiseToINR, paiseToRupees } from '../../lib/currency';
import { CheckCircle2, Banknote, Smartphone, X, AlertCircle, ArrowRightLeft } from 'lucide-react';

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
  const [cashReceived, setCashReceived] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Reset cash tendered whenever bill changes or payment method is switched
  useEffect(() => {
    setCashReceived('');
  }, [bill?.id, paymentMethod]);

  if (!isOpen || !bill) return null;

  const parsedCashRupees = parseFloat(cashReceived);
  const isCashEntered = !isNaN(parsedCashRupees) && cashReceived.trim() !== '' && parsedCashRupees >= 0;
  const cashReceivedPaise = isCashEntered ? Math.round(parsedCashRupees * 100) : 0;
  const changePaise = isCashEntered ? cashReceivedPaise - bill.final_total_paise : 0;
  const isInsufficient = isCashEntered && changePaise < 0;

  // Preset denominations higher than total bill
  const billRupees = Math.ceil(bill.final_total_paise / 100);
  const quickNotes = [50, 100, 200, 500, 1000, 2000]
    .filter((note) => note > billRupees)
    .slice(0, 3);

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
      <div className="modal-content" style={{ maxWidth: '440px' }}>
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

          {/* Cash Tendered & Change Return Box (When Cash is selected) */}
          {paymentMethod === 'cash' && (
            <div
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-strong)',
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label
                  htmlFor="cash-tendered-input"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    margin: 0,
                  }}
                >
                  <Banknote size={15} color="var(--secondary-accent)" />
                  Cash Received from Customer
                </label>
                {cashReceived && (
                  <button
                    type="button"
                    onClick={() => setCashReceived('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '11px',
                      padding: '2px 4px',
                      minHeight: 'auto',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Input Box with Rupee Symbol */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '12px',
                    fontSize: '16px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                >
                  ₹
                </span>
                <input
                  id="cash-tendered-input"
                  type="number"
                  step="any"
                  min="0"
                  placeholder={`e.g. ${paiseToRupees(bill.final_total_paise)}`}
                  value={cashReceived}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || parseFloat(val) >= 0) {
                      setCashReceived(val);
                    }
                  }}
                  style={{
                    width: '100%',
                    paddingLeft: '28px',
                    paddingRight: '12px',
                    fontSize: '16px',
                    fontWeight: 600,
                    height: '42px',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    border: isInsufficient
                      ? '1px solid var(--danger-border)'
                      : isCashEntered && changePaise >= 0
                      ? '1px solid var(--success-border)'
                      : '1px solid var(--border-strong)',
                    borderRadius: '6px',
                  }}
                  autoFocus
                />
              </div>

              {/* Quick Presets (Exact + round notes) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    padding: '4px 10px',
                    minHeight: '28px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '4px',
                  }}
                  onClick={() => setCashReceived(paiseToRupees(bill.final_total_paise).toString())}
                >
                  Exact: {formatPaiseToINR(bill.final_total_paise, false)}
                </button>
                {quickNotes.map((note) => (
                  <button
                    key={note}
                    type="button"
                    className="btn-secondary"
                    style={{
                      padding: '4px 10px',
                      minHeight: '28px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '4px',
                    }}
                    onClick={() => setCashReceived(note.toString())}
                  >
                    ₹{note}
                  </button>
                ))}
              </div>

              {/* Change Calculation Display */}
              {isCashEntered ? (
                changePaise > 0 ? (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '12px 14px',
                      backgroundColor: 'rgba(4, 106, 56, 0.12)',
                      border: '1px solid var(--emerald-green)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--emerald-green)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          display: 'block',
                        }}
                      >
                        Exact Change to Return
                      </span>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--emerald-green)', lineHeight: 1.2, marginTop: '2px' }}>
                        {formatPaiseToINR(changePaise)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      <div>Given: <strong style={{ color: 'var(--text-primary)' }}>{formatPaiseToINR(cashReceivedPaise)}</strong></div>
                      <div>Due: <span style={{ color: 'var(--text-muted)' }}>{formatPaiseToINR(bill.final_total_paise)}</span></div>
                    </div>
                  </div>
                ) : changePaise === 0 ? (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '10px 14px',
                      backgroundColor: 'rgba(4, 106, 56, 0.08)',
                      border: '1px solid var(--emerald-green)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--emerald-green)', textTransform: 'uppercase' }}>
                        Exact Cash Tendered
                      </span>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--emerald-green)', marginTop: '2px' }}>
                        No Change Due (₹0.00)
                      </div>
                    </div>
                    <CheckCircle2 size={22} color="var(--emerald-green)" />
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '10px 14px',
                      backgroundColor: 'rgba(227, 66, 34, 0.12)',
                      border: '1px solid var(--vermilion)',
                      borderRadius: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vermilion)', textTransform: 'uppercase' }}>
                          Insufficient Amount Tendered
                        </span>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--vermilion)', marginTop: '2px' }}>
                          Short by {formatPaiseToINR(Math.abs(changePaise))}
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Given: {formatPaiseToINR(cashReceivedPaise)}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#C73517', marginTop: '4px' }}>
                      Customer still needs to pay {formatPaiseToINR(Math.abs(changePaise))} more to settle this bill.
                    </div>
                  </div>
                )
              ) : (
                <div
                  style={{
                    marginTop: '10px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ArrowRightLeft size={13} />
                  <span>Enter amount given above to compute the exact change to return</span>
                </div>
              )}
            </div>
          )}

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
            disabled={isSubmitting || (paymentMethod === 'cash' && isInsufficient)}
          >
            {isSubmitting ? 'Recording Settlement...' : `Settle Payment (${paymentMethod.toUpperCase()})`}
          </button>
        </div>
      </div>
    </div>
  );
};
