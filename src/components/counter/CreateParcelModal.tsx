import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { MenuItem, MenuCategory } from '../../types/database';
import { formatPaiseToINR } from '../../lib/currency';
import { X, Plus, Minus, Package, AlertCircle, Send } from 'lucide-react';

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
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={18} color="var(--accent)" />
            <h3>Create Takeaway Parcel Order</h3>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={onClose} style={{ border: 'none', padding: '4px' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {errorMessage && (
              <div className="alert-banner alert-banner-danger">
                <AlertCircle size={15} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div style={{ marginBottom: '12px' }}>
              <label htmlFor="parcel-notes">Customer Name / Contact / Notes (Optional)</label>
              <input
                id="parcel-notes"
                type="text"
                placeholder="e.g. Mr. Sharma (Pick up in 15 mins, extra chutney)"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            {/* Dish selector */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Filter dishes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1, minHeight: '32px' }}
              />
              <select
                value={selectedCatId}
                onChange={(e) => setSelectedCatId(e.target.value)}
                style={{ minHeight: '32px', fontSize: '12px' }}
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Dishes list: Crisp White cards with Deep Obsidian Black text */}
            <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', padding: '2px' }}>
              {filteredDishes.map((dish) => {
                const qty = cart[dish.id] || 0;
                return (
                  <div
                    key={dish.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      borderRadius: '6px',
                      border: qty > 0 ? '2px solid var(--primary-action)' : '1px solid #E2E8F0',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>{dish.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                          {formatPaiseToINR(dish.price_paise)}
                        </span>
                        <span className="modifier-chip" style={{ fontSize: '10px', padding: '1px 5px' }}>
                          Extra Gravy
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {qty > 0 && (
                        <>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            style={{ width: '26px', height: '26px', padding: 0, backgroundColor: '#F1F5F9', color: '#0F172A', border: '1px solid #CBD5E1' }}
                            onClick={() => removeFromCart(dish.id)}
                          >
                            <Minus size={11} />
                          </button>
                          <span style={{ fontWeight: 800, minWidth: '18px', textAlign: 'center', color: '#0F172A' }}>
                            {qty}
                          </span>
                        </>
                      )}
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        style={{ width: '26px', height: '26px', padding: 0 }}
                        onClick={() => addToCart(dish.id)}
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected items review */}
            {totalQty > 0 && (
              <div style={{ marginTop: '14px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '10px 12px', borderRadius: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Parcel Items Summary ({totalQty} items):
                </span>
                <div style={{ marginTop: '6px' }}>
                  {cartEntries.map((e) => (
                    <div key={e.item!.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '2px 0', color: 'var(--text-primary)' }}>
                      <span>{e.item!.name} × {e.qty}</span>
                      <span style={{ fontWeight: 700 }}>{formatPaiseToINR(e.totalPaise)}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border-strong)', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--text-primary)' }}>
                    <span>Estimated Amount Due</span>
                    <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{formatPaiseToINR(totalPaise)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ fontWeight: 700, minHeight: '40px' }}
              disabled={isSubmitting || totalQty === 0}
            >
              <Send size={15} />
              <span>{isSubmitting ? 'Sending to Kitchen (KOT)...' : `Send to Kitchen (KOT) (${totalQty} items)`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
