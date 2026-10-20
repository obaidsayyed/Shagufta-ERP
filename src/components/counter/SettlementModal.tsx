import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Bill, PaymentMethod } from '../../types/database';
import { formatPaiseToINR, paiseToRupees } from '../../lib/currency';


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
      <div className="modal-content" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Settle Bill: {identifierTitle}</h3>
          <button type="button" className="btn-secondary btn-sm" onClick={onClose} style={{ padding: '2px 8px', fontSize: '11px' }}>
            Close
          </button>
        </div>

        <div className="modal-body" style={{ padding: '12px 14px' }}>
          {errorMessage && (
            <div className="alert-banner alert-banner-danger" style={{ marginBottom: '10px', padding: '6px 10px' }}>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Amount Due Box */}
          <div
            style={{
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface-subtle)',
              padding: '10px 12px',
              borderRadius: '6px',
              marginBottom: '12px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Authoritative Amount Due
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {formatPaiseToINR(bill.final_total_paise)}
            </div>
            {bill.adjustments_paise !== 0 && (
              <span style={{ fontSize: '10.5px', color: 'var(--danger)', display: 'block', marginTop: '2px' }}>
                Includes {formatPaiseToINR(bill.adjustments_paise)} in authorized deductions
              </span>
            )}
          </div>

          {/* Payment Method Selector */}
          <label style={{ marginBottom: '6px', fontSize: '11.5px', fontWeight: 600, display: 'block' }}>Payment Method</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <button
              type="button"
              className={paymentMethod === 'cash' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              style={{
                minHeight: '34px',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 600,
              }}
              onClick={() => setPaymentMethod('cash')}
            >
              Cash Payment
            </button>

            <button
              type="button"
              className={paymentMethod === 'online' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              style={{
                minHeight: '34px',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 600,
              }}
              onClick={() => setPaymentMethod('online')}
            >
              Online (UPI/Card)
            </button>
          </div>

          {/* Cash Tendered & Change Return Box (When Cash is selected) */}
          {paymentMethod === 'cash' && (
            <div
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-strong)',
                borderRadius: '6px',
                padding: '10px 12px',
                marginBottom: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label
                  htmlFor="cash-tendered-input"
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    margin: 0,
                  }}
                >
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
                      padding: '1px 4px',
                      minHeight: 'auto',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Input Box */}
              <div>
                <input
                  id="cash-tendered-input"
                  type="number"
                  step="any"
                  min="0"
                  placeholder={`Amount (e.g. ${paiseToRupees(bill.final_total_paise)})`}
                  value={cashReceived}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || parseFloat(val) >= 0) {
                      setCashReceived(val);
                    }
                  }}
                  style={{
                    width: '100%',
                    paddingLeft: '10px',
                    paddingRight: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    height: '36px',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    border: isInsufficient
                      ? '1px solid var(--danger-border)'
                      : isCashEntered && changePaise >= 0
                      ? '1px solid var(--success-border)'
                      : '1px solid var(--border-strong)',
                    borderRadius: '5px',
                  }}
                  autoFocus
                />
              </div>

              {/* Quick Presets (Exact + round notes) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  style={{
                    padding: '3px 8px',
                    minHeight: '24px',
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
                    className="btn-secondary btn-sm"
                    style={{
                      padding: '3px 8px',
                      minHeight: '24px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '4px',
                    }}
                    onClick={() => setCashReceived(note.toString())}
                  >
                    {formatPaiseToINR(note * 100, false)}
                  </button>
                ))}
              </div>

              {/* Change Calculation Display */}
              {isCashEntered ? (
                changePaise > 0 ? (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(4, 106, 56, 0.12)',
                      border: '1px solid var(--emerald-green)',
                      borderRadius: '5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          color: 'var(--emerald-green)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          display: 'block',
                        }}
                      >
                        Exact Change to Return
                      </span>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--emerald-green)', lineHeight: 1.2, marginTop: '2px' }}>
                        {formatPaiseToINR(changePaise)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                      <div>Given: <strong style={{ color: 'var(--text-primary)' }}>{formatPaiseToINR(cashReceivedPaise)}</strong></div>
                      <div>Due: <span style={{ color: 'var(--text-muted)' }}>{formatPaiseToINR(bill.final_total_paise)}</span></div>
                    </div>
                  </div>
                ) : changePaise === 0 ? (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(4, 106, 56, 0.08)',
                      border: '1px solid var(--emerald-green)',
                      borderRadius: '5px',
                    }}
                  >
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--emerald-green)', textTransform: 'uppercase' }}>
                      Exact Cash Tendered
                    </span>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--emerald-green)', marginTop: '1px' }}>
                      No Change Due
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(227, 66, 34, 0.12)',
                      border: '1px solid var(--vermilion)',
                      borderRadius: '5px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--vermilion)', textTransform: 'uppercase' }}>
                          Insufficient Amount Tendered
                        </span>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--vermilion)', marginTop: '1px' }}>
                          Short by {formatPaiseToINR(Math.abs(changePaise))}
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Given: {formatPaiseToINR(cashReceivedPaise)}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#C73517', marginTop: '3px' }}>
                      Customer still needs to pay {formatPaiseToINR(Math.abs(changePaise))} more to settle this bill.
                    </div>
                  </div>
                )
              ) : (
                <div
                  style={{
                    marginTop: '8px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>Enter amount given above to compute exact change to return</span>
                </div>
              )}
            </div>
          )}

          <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.3, marginBottom: 0 }}>
            Notice: Confirming settlement marks this session closed and records collection under <strong>{paymentMethod.toUpperCase()}</strong>.
          </p>
        </div>

        <div className="modal-footer" style={{ padding: '8px 14px' }}>
          <button type="button" className="btn-secondary btn-sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary btn-sm"
            style={{ backgroundColor: 'var(--primary-action)', borderColor: 'var(--primary-action)', color: '#FFFFFF', fontWeight: 700, minHeight: '32px' }}
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
