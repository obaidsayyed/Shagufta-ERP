import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { MenuItem, MenuCategory } from '../../types/database';
import { formatPaiseToINR } from '../../lib/currency';


interface CreateParcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems: MenuItem[];
  categories: MenuCategory[];
  onOrderCreated: () => void;
}

export const CreateParcelModal: React.FC<CreateParcelModalProps> = ({
  isOpen,
  onClose,
  menuItems,
  categories,
  onOrderCreated,
}) => {
  const { currentStaff } = useAuth();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerNotes, setCustomerNotes] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('all');
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const filteredDishes = menuItems.filter((m) => {
    if (m.is_archived || !m.is_available) return false;
    if (selectedCatId !== 'all' && m.category_id !== selectedCatId) return false;
    if (search.trim() && !m.name.toLowerCase().includes(search.toLowerCase().trim())) return false;
    return true;
  });

  const addToCart = (id: string) => {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const current = prev[id] || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: current - 1 };
    });
  };

  const cartEntries = Object.entries(cart).map(([mId, qty]) => {
    const item = menuItems.find((m) => m.id === mId);
    return { item, qty, totalPaise: (item?.price_paise || 0) * qty };
  }).filter((e) => e.item !== undefined);

  const totalPaise = cartEntries.reduce((sum, e) => sum + e.totalPaise, 0);
  const totalQty = cartEntries.reduce((sum, e) => sum + e.qty, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalQty === 0 || !currentStaff) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const itemsPayload = cartEntries.map((e) => ({
        menu_item_id: e.item!.id,
        quantity: e.qty,
      }));

      const idempotency_key = `pcl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      await api.submitOrder({
        order_type: 'parcel',
        parcel_customer_notes: customerNotes.trim() || undefined,
        items: itemsPayload,
        idempotency_key,
        caller_staff: currentStaff,
      });

      onOrderCreated();
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
      <div className="modal-content" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Create Takeaway Parcel Order</h3>
          <button type="button" className="btn-secondary btn-sm" onClick={onClose} style={{ padding: '2px 8px', fontSize: '11px' }}>
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '12px 14px' }}>
            {errorMessage && (
              <div className="alert-banner alert-banner-danger" style={{ marginBottom: '10px', padding: '6px 10px' }}>
                <span>{errorMessage}</span>
              </div>
            )}

            <div style={{ marginBottom: '10px' }}>
              <label htmlFor="parcel-notes" style={{ fontSize: '12px', fontWeight: 600 }}>Customer Name / Contact / Notes (Optional)</label>
              <input
                id="parcel-notes"
                type="text"
                placeholder="e.g. Mr. Sharma (Pick up in 15 mins, extra chutney)"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                style={{ width: '100%', minHeight: '32px' }}
              />
            </div>

            {/* Dish selector */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <input
                type="text"
                placeholder="Filter dishes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1, minHeight: '30px', fontSize: '12px' }}
              />
              <select
                value={selectedCatId}
                onChange={(e) => setSelectedCatId(e.target.value)}
                style={{ minHeight: '30px', fontSize: '12px' }}
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Dishes list */}
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px', padding: '1px' }}>
              {filteredDishes.map((dish) => {
                const qty = cart[dish.id] || 0;
                return (
                  <div
                    key={dish.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      borderRadius: '5px',
                      border: qty > 0 ? '2px solid var(--primary-action)' : '1px solid #E2E8F0',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#0F172A' }}>{dish.name}</div>
                      <div style={{ marginTop: '1px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A' }}>
                          {formatPaiseToINR(dish.price_paise)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {qty > 0 && (
                        <>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            style={{ width: '24px', height: '24px', padding: 0, backgroundColor: '#F1F5F9', color: '#0F172A', border: '1px solid #CBD5E1', fontSize: '14px', lineHeight: '22px' }}
                            onClick={() => removeFromCart(dish.id)}
                          >
                            -
                          </button>
                          <span style={{ fontWeight: 800, minWidth: '16px', textAlign: 'center', color: '#0F172A', fontSize: '12px' }}>
                            {qty}
                          </span>
                        </>
                      )}
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        style={{ width: '24px', height: '24px', padding: 0, fontSize: '14px', lineHeight: '22px' }}
                        onClick={() => addToCart(dish.id)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected items review */}
            {totalQty > 0 && (
              <div style={{ marginTop: '10px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '8px 10px', borderRadius: '5px' }}>
                <span style={{ fontWeight: 700, fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Parcel Items Summary ({totalQty} items):
                </span>
                <div style={{ marginTop: '4px' }}>
                  {cartEntries.map((e) => (
                    <div key={e.item!.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', padding: '1px 0', color: 'var(--text-primary)' }}>
                      <span>{e.item!.name} x {e.qty}</span>
                      <span style={{ fontWeight: 700 }}>{formatPaiseToINR(e.totalPaise)}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border-strong)', marginTop: '4px', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--text-primary)', fontSize: '12px' }}>
                    <span>Estimated Amount Due</span>
                    <span style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{formatPaiseToINR(totalPaise)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ padding: '8px 14px' }}>
            <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary btn-sm"
              style={{ fontWeight: 700, minHeight: '32px' }}
              disabled={isSubmitting || totalQty === 0}
            >
              {isSubmitting ? 'Sending to Kitchen (KOT)...' : `Send to Kitchen (${totalQty} items)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
