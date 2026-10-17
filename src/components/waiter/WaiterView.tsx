import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { 
  DiningTable, 
  TableSession, 
  MenuCategory, 
  MenuItem, 
  OrderTicket, 
  OrderItem 
} from '../../types/database';
import { formatPaiseToINR } from '../../lib/currency';
import { 
  UtensilsCrossed, 
  Search, 
  Plus, 
  Minus, 
  Send, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  ShoppingBag
} from 'lucide-react';

export const WaiterView: React.FC = () => {
  const { currentStaff } = useAuth();
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [tableSessions, setTableSessions] = useState<TableSession[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<OrderTicket[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cart state: map of menuItemId -> quantity
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessTicket, setSubmitSuccessTicket] = useState<{ ticket_number: string; itemsCount: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = async () => {
    try {
      const [tList, sList, cList, mList, oList, oiList] = await Promise.all([
        api.getTables(),
        api.getTableSessions(),
        api.getMenuCategories(),
        api.getMenuItems(),
        api.getOrders(),
        api.getOrderItems(),
      ]);
      setTables(tList.filter((t) => t.is_active));
      setTableSessions(sList);
      setCategories(cList.filter((c) => c.is_active));
      setMenuItems(mList.filter((m) => !m.is_archived));
      setOrders(oList);
      setOrderItems(oiList);

      if (!selectedTableId && tList.length > 0) {
        setSelectedTableId(tList[0].id);
      }
    } catch (err: unknown) {
      console.error('Error loading waiter data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = api.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  const selectedTable = tables.find((t) => t.id === selectedTableId);
  const activeSession = tableSessions.find((s) => s.table_id === selectedTableId && s.session_status === 'open');

  // Filtered dishes
  const filteredDishes = menuItems.filter((item) => {
    if (selectedCategoryId !== 'all' && item.category_id !== selectedCategoryId) return false;
    if (searchQuery.trim() && !item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())) return false;
    return true;
  });

  const addToCart = (dishId: string) => {
    const dish = menuItems.find((m) => m.id === dishId);
    if (!dish || !dish.is_available) return;
    setCart((prev) => ({
      ...prev,
      [dishId]: (prev[dishId] || 0) + 1,
    }));
  };

  const removeFromCart = (dishId: string) => {
    setCart((prev) => {
      const current = prev[dishId] || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[dishId];
        return next;
      }
      return { ...prev, [dishId]: current - 1 };
    });
  };

  const clearCart = () => {
    setCart({});
  };

  // Cart calculations
  const cartEntries = Object.entries(cart).map(([menuItemId, qty]) => {
    const item = menuItems.find((m) => m.id === menuItemId);
    return {
      item,
      quantity: qty,
      subtotalPaise: (item?.price_paise || 0) * qty,
    };
  }).filter((entry) => entry.item !== undefined);

  const totalCartPaise = cartEntries.reduce((sum, e) => sum + e.subtotalPaise, 0);
  const totalCartQty = cartEntries.reduce((sum, e) => sum + e.quantity, 0);

  const handleSubmitOrder = async () => {
    if (!selectedTableId || totalCartQty === 0 || !currentStaff) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const itemsPayload = cartEntries.map((e) => ({
        menu_item_id: e.item!.id,
        quantity: e.quantity,
      }));

      // Generate idempotency key for this atomic submission
      const idempotency_key = `wtr_${selectedTableId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const result = await api.submitOrder({
        order_type: 'dine_in',
        table_id: selectedTableId,
        items: itemsPayload,
        idempotency_key,
        caller_staff: currentStaff,
      });

      setSubmitSuccessTicket({
        ticket_number: result.ticket_number,
        itemsCount: totalCartQty,
      });
      clearCart();
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Orders for the currently selected table's active session
  const tableSessionOrders = activeSession
    ? orders.filter((o) => o.table_session_id === activeSession.id)
    : [];

  const tableSessionOrderItems = activeSession
    ? orderItems.filter((oi) => oi.table_session_id === activeSession.id)
    : [];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* 1. Table Selector & Operational Status Banner */}
      <div className="panel" style={{ marginBottom: '14px', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            SELECT TABLE
          </span>
          {activeSession ? (
            <span className="badge badge-pending">
              OPEN SESSION (BILL RUNNING)
            </span>
          ) : (
            <span className="badge badge-settled">
              VACANT / NEW SESSION
            </span>
          )}
        </div>

        {/* Horizontal table buttons */}
        {tables.length === 0 ? (
          <div style={{ padding: '12px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            No floor tables configured yet. Counter Admin can add tables in the <strong>Floor Tables</strong> management tab.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))',
              gap: '8px',
            }}
          >
            {tables.map((tbl) => {
              const hasSession = tableSessions.some((s) => s.table_id === tbl.id && s.session_status === 'open');
              const isSelected = tbl.id === selectedTableId;
              return (
                <button
                  key={tbl.id}
                  type="button"
                  onClick={() => {
                    setSelectedTableId(tbl.id);
                    setSubmitSuccessTicket(null);
                  }}
                  style={{
                    minHeight: '44px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px 6px',
                    backgroundColor: isSelected ? 'var(--accent)' : hasSession ? 'var(--warning-bg)' : 'var(--bg-surface)',
                    color: isSelected ? 'var(--text-inverse)' : hasSession ? 'var(--warning)' : 'var(--text-primary)',
                    borderColor: isSelected ? 'var(--accent)' : hasSession ? 'var(--warning-border)' : 'var(--border-strong)',
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>{tbl.table_number}</span>
                  <span style={{ fontSize: '10px', opacity: 0.9 }}>
                    {hasSession ? 'Active' : 'Empty'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="alert-banner alert-banner-danger">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Confirmation of Acceptance */}
      {submitSuccessTicket && (
        <div className="alert-banner alert-banner-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={18} color="var(--success)" />
            <div>
              <strong>Order Accepted!</strong> Kitchen ticket <strong>{submitSuccessTicket.ticket_number}</strong> sent for preparation.
            </div>
          </div>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setSubmitSuccessTicket(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Waiter Work Area: Left = Dishes / Right = Order Cart */}
      <div className="waiter-workspace-grid">
        {/* Left Column: Menu Browsing & Dish Search */}
        <div>
          {/* Search & Categories Bar */}
          <div className="panel" style={{ marginBottom: '12px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search dishes by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', paddingLeft: '32px' }}
                />
              </div>
              {searchQuery && (
                <button type="button" className="btn-secondary btn-sm" onClick={() => setSearchQuery('')}>
                  Clear
                </button>
              )}
            </div>

            {/* Category pills */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
              <button
                type="button"
                className={`btn-sm ${selectedCategoryId === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedCategoryId('all')}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`btn-sm ${selectedCategoryId === c.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedCategoryId(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Dish Grid / List */}
          {filteredDishes.length === 0 ? (
            <div className="panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontWeight: 600 }}>No menu items found</p>
              <span style={{ fontSize: '12px' }}>
                {searchQuery ? 'No dishes match your search query.' : 'Counter Admin can add categories and dishes in "Menu & Pricing".'}
              </span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
              {filteredDishes.map((dish) => {
                const qtyInCart = cart[dish.id] || 0;
                const isAvailable = dish.is_available;
                return (
                  <div
                    key={dish.id}
                    className="item-grid-card"
                    style={{
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      border: qtyInCart > 0 ? '2px solid var(--primary-action)' : '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      opacity: isAvailable ? 1 : 0.6,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A', lineHeight: 1.3 }}>
                          {dish.name}
                        </span>
                        {!isAvailable && (
                          <span className="badge badge-danger" style={{ fontSize: '9px', padding: '1px 4px' }}>
                            Unavailable
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
                        {formatPaiseToINR(dish.price_paise)}
                      </div>

                      {/* Quick Modifiers / Add-on Accents (Spicy Amber Yellow) */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                        <span className="modifier-chip" title="Add special modifier note">
                          Extra Gravy
                        </span>
                        <span className="modifier-chip" title="Add special modifier note">
                          Spicy
                        </span>
                      </div>
                    </div>

                    {/* Add / Quantity Controller */}
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                      {qtyInCart > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            style={{ width: '28px', height: '28px', padding: 0, backgroundColor: '#F1F5F9', color: '#0F172A', border: '1px solid #CBD5E1' }}
                            onClick={() => removeFromCart(dish.id)}
                          >
                            <Minus size={13} />
                          </button>
                          <span style={{ fontWeight: 800, minWidth: '22px', textAlign: 'center', color: '#0F172A', fontSize: '14px' }}>
                            {qtyInCart}
                          </span>
                          <button
                            type="button"
                            className="btn-primary btn-sm"
                            style={{ width: '28px', height: '28px', padding: 0 }}
                            onClick={() => addToCart(dish.id)}
                            disabled={!isAvailable}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          onClick={() => addToCart(dish.id)}
                          disabled={!isAvailable}
                          style={{ width: '100%', minHeight: '32px' }}
                        >
                          <Plus size={13} />
                          Add Item
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Order Summary / Cart */}
        <div>
          <div className="panel" style={{ position: 'sticky', top: '64px' }}>
            <div className="panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShoppingBag size={16} color="var(--primary-action)" />
                <h3 style={{ color: 'var(--text-primary)' }}>Order For {selectedTable?.table_number || 'Table'}</h3>
              </div>
              {totalCartQty > 0 && (
                <button type="button" className="btn-secondary btn-sm" onClick={clearCart} style={{ border: 'none', color: 'var(--text-muted)' }}>
                  Clear
                </button>
              )}
            </div>

            {cartEntries.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                <UtensilsCrossed size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <p style={{ fontSize: '13px' }}>Cart is empty</p>
                <span style={{ fontSize: '11px' }}>Select dishes from the menu to add</span>
              </div>
            ) : (
              <div>
                <div style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '12px' }}>
                  {cartEntries.map(({ item, quantity, subtotalPaise }) => (
                    <div
                      key={item!.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px solid var(--border-subtle)',
                        fontSize: '13px',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item!.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {formatPaiseToINR(item!.price_paise)} × {quantity}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            style={{ width: '22px', height: '22px', padding: 0 }}
                            onClick={() => removeFromCart(item!.id)}
                          >
                            <Minus size={11} />
                          </button>
                          <span style={{ fontWeight: 600, minWidth: '16px', textAlign: 'center', color: 'var(--text-primary)' }}>
                            {quantity}
                          </span>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            style={{ width: '22px', height: '22px', padding: 0 }}
                            onClick={() => addToCart(item!.id)}
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                        <span style={{ fontWeight: 700, minWidth: '60px', textAlign: 'right', color: 'var(--text-primary)' }}>
                          {formatPaiseToINR(subtotalPaise)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotal */}
                <div
                  style={{
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border-strong)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '14px',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Items Total</span>
                  <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>{formatPaiseToINR(totalCartPaise)}</span>
                </div>

                {/* Primary Action Button: Send to Kitchen (KOT) */}
                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: '100%', minHeight: '46px', fontSize: '14px', fontWeight: 700 }}
                  onClick={handleSubmitOrder}
                  disabled={isSubmitting || totalCartQty === 0}
                >
                  <Send size={15} />
                  <span>{isSubmitting ? 'Sending to Kitchen (KOT)...' : `Send to Kitchen (KOT) (${totalCartQty} items)`}</span>
                </button>
              </div>
            )}

            {/* Preparation Status of Current Table's Active Session */}
            {activeSession && tableSessionOrderItems.length > 0 && (
              <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    ACTIVE KITCHEN PREPARATION
                  </span>
                  <Clock size={13} color="var(--text-muted)" />
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {tableSessionOrderItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 0',
                        fontSize: '12px',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>
                        {item.dish_name} × {item.ordered_quantity - item.cancelled_quantity}
                      </span>
                      {item.status === 'ready' ? (
                        <span className="badge badge-ready">READY</span>
                      ) : item.status === 'cancelled' ? (
                        <span className="badge badge-danger">CANCELLED</span>
                      ) : item.prepared_quantity > 0 ? (
                        <span className="badge badge-pending">
                          PREP ({item.prepared_quantity}/{item.ordered_quantity})
                        </span>
                      ) : (
                        <span className="badge badge-pending">PENDING</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
