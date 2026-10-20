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
  ShoppingBag,
  ArrowLeft,
  Users
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
  const [selectedCustomerNumber, setSelectedCustomerNumber] = useState<1 | 2>(1);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cart state per customer slot: map of menuItemId -> quantity
  const [cart1, setCart1] = useState<Record<string, number>>({});
  const [cart2, setCart2] = useState<Record<string, number>>({});
  const cart = selectedCustomerNumber === 1 ? cart1 : cart2;
  const setCart = (updater: React.SetStateAction<Record<string, number>>) => {
    if (selectedCustomerNumber === 1) setCart1(updater);
    else setCart2(updater);
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessTicket, setSubmitSuccessTicket] = useState<{ ticket_number: string; itemsCount: number; tableDisplay: string } | null>(null);
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
  const openSessionsForTable = tableSessions.filter(
    (s) => s.table_id === selectedTableId && s.session_status === 'open'
  );
  const customer1Session = openSessionsForTable.find((s) => (s.customer_number || 1) === 1);
  const customer2Session = openSessionsForTable.find((s) => s.customer_number === 2);
  const currentSession = selectedCustomerNumber === 1 ? customer1Session : customer2Session;
  const currentDisplayTable = selectedCustomerNumber === 2
    ? `${selectedTable?.table_number || 'Table'} (2)`
    : selectedTable?.table_number || 'Table';

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
      const idempotency_key = `wtr_${selectedTableId}_c${selectedCustomerNumber}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const result = await api.submitOrder({
        order_type: 'dine_in',
        table_id: selectedTableId,
        customer_number: selectedCustomerNumber,
        items: itemsPayload,
        idempotency_key,
        caller_staff: currentStaff,
      });

      setSubmitSuccessTicket({
        ticket_number: result.ticket_number,
        itemsCount: totalCartQty,
        tableDisplay: currentDisplayTable,
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

  // Orders for the currently selected customer's active session
  const tableSessionOrders = currentSession
    ? orders.filter((o) => o.table_session_id === currentSession.id)
    : [];

  const tableSessionOrderItems = currentSession
    ? orderItems.filter((oi) => oi.table_session_id === currentSession.id)
    : [];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* 1. When no table is selected: Waiter sees strictly the table squares */}
      {!selectedTableId ? (
        <div>
          <div className="panel" style={{ padding: '20px 24px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Floor Tables
                </h2>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Tap a table to open menu and add dishes
                </span>
              </div>
              {tableSessions.filter((s) => s.session_status === 'open').length > 0 && (
                <span className="badge badge-pending">
                  {tableSessions.filter((s) => s.session_status === 'open').length} Table(s) With Active Bill
                </span>
              )}
            </div>

            {tables.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                No active floor tables configured yet. Counter Admin can add tables in the Floor Tables tab.
              </div>
            ) : (
              <div className="table-square-grid">
                {tables.map((tbl) => {
                  const openSessions = tableSessions.filter((s) => s.table_id === tbl.id && s.session_status === 'open');
                  const count = openSessions.length;
                  const isFull = count >= 2;
                  const isOccupied = count > 0;
                  return (
                    <button
                      key={tbl.id}
                      type="button"
                      className="table-square-btn"
                      onClick={() => {
                        setSelectedTableId(tbl.id);
                        setSelectedCustomerNumber(1);
                        setSubmitSuccessTicket(null);
                        setErrorMessage('');
                      }}
                      style={{
                        backgroundColor: isFull
                          ? 'rgba(227, 66, 34, 0.08)'
                          : isOccupied
                          ? 'var(--warning-bg)'
                          : 'var(--bg-surface-elevated)',
                        borderColor: isFull
                          ? 'var(--vermilion)'
                          : isOccupied
                          ? 'var(--warning-border)'
                          : 'var(--border-strong)',
                        borderWidth: isOccupied ? '2px' : '1px',
                        borderStyle: 'solid',
                        boxShadow: isOccupied ? '0 0 10px rgba(245, 158, 11, 0.15)' : 'none',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2px',
                      }}
                    >
                      {isOccupied && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '5px',
                            right: '5px',
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: isFull ? 'var(--vermilion)' : 'var(--warning)',
                            color: '#ffffff',
                            lineHeight: 1.2,
                          }}
                          title={isFull ? 'Table full (2/2 customers)' : '1 customer seated (1/2)'}
                        >
                          {count}/2
                        </span>
                      )}
                      <span style={{ fontWeight: 800, fontSize: '15px', color: isFull ? 'var(--vermilion)' : isOccupied ? 'var(--warning)' : 'var(--text-primary)' }}>
                        {tbl.table_number}
                      </span>
                      <span style={{ fontSize: '10px', color: isFull ? 'var(--vermilion)' : isOccupied ? 'var(--warning)' : 'var(--text-muted)' }}>
                        {isFull ? '2 Customers (FULL)' : isOccupied ? '1 Customer' : 'Vacant'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 2. When table IS clicked: Back navigation, Menu, and Cart */
        <div>
          {/* Back button and Selected Table indicator */}
          <div
            className="panel"
            style={{
              marginBottom: '12px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSelectedTableId('');
                setSubmitSuccessTicket(null);
                setErrorMessage('');
              }}
              style={{ minHeight: '32px', padding: '0 12px' }}
            >
              <ArrowLeft size={15} />
              <span>Back to Tables</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Table: {currentDisplayTable}
              </span>
              {currentSession ? (
                <span className="badge badge-pending">
                  ACTIVE BILL
                </span>
              ) : (
                <span className="badge badge-settled">
                  VACANT SLOT
                </span>
              )}
            </div>
          </div>

          {/* Customer Allocation Selector Bar (Max 2 Customers per table) */}
          <div
            className="panel"
            style={{
              marginBottom: '12px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} color="var(--primary-action)" />
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                  Customer Allocation (Max 2)
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Allocate up to 2 separate customers per table with individual bills
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {/* Customer 1 Slot */}
              <button
                type="button"
                onClick={() => setSelectedCustomerNumber(1)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  border: selectedCustomerNumber === 1
                    ? '2px solid var(--emerald-green)'
                    : '1px solid var(--border-strong)',
                  backgroundColor: selectedCustomerNumber === 1
                    ? 'rgba(4, 106, 56, 0.12)'
                    : 'var(--bg-surface)',
                  color: selectedCustomerNumber === 1 ? 'var(--emerald-green)' : 'var(--text-primary)',
                }}
              >
                <span>Customer 1 ({selectedTable?.table_number})</span>
                {customer1Session ? (
                  <span className="badge badge-pending" style={{ fontSize: '10px', padding: '1px 5px' }}>
                    Active
                  </span>
                ) : (
                  <span className="badge badge-settled" style={{ fontSize: '10px', padding: '1px 5px' }}>
                    Vacant
                  </span>
                )}
              </button>

              {/* Customer 2 Slot: displays as (2) */}
              <button
                type="button"
                onClick={() => setSelectedCustomerNumber(2)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  border: selectedCustomerNumber === 2
                    ? '2px solid var(--vermilion)'
                    : '1px solid var(--border-strong)',
                  backgroundColor: selectedCustomerNumber === 2
                    ? 'rgba(227, 66, 34, 0.12)'
                    : 'var(--bg-surface)',
                  color: selectedCustomerNumber === 2 ? 'var(--vermilion)' : 'var(--text-primary)',
                }}
              >
                <span>Customer 2 ({selectedTable?.table_number} (2))</span>
                {customer2Session ? (
                  <span className="badge badge-pending" style={{ fontSize: '10px', padding: '1px 5px' }}>
                    Active
                  </span>
                ) : (
                  <span className="badge badge-settled" style={{ fontSize: '10px', padding: '1px 5px' }}>
                    Vacant
                  </span>
                )}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="alert-banner alert-banner-danger">
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Confirmation of Acceptance */}
          {submitSuccessTicket && (
            <div
              className="alert-banner alert-banner-info"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} color="var(--success)" />
                <div>
                  <strong>Order Accepted!</strong> Kitchen ticket <strong>{submitSuccessTicket.ticket_number}</strong> sent for <strong>{submitSuccessTicket.tableDisplay}</strong>.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => setSubmitSuccessTicket(null)}
                >
                  Add More Items
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    setSubmitSuccessTicket(null);
                    setSelectedTableId('');
                  }}
                >
                  Back to Tables
                </button>
              </div>
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
                <div className="waiter-dish-grid">
                  {filteredDishes.map((dish) => {
                    const qtyInCart = cart[dish.id] || 0;
                    const isAvailable = dish.is_available;
                    return (
                      <div
                        key={dish.id}
                        className="item-grid-card"
                        style={{
                          border: qtyInCart > 0 ? '2px solid var(--primary-action)' : '1px solid #E2E8F0',
                          opacity: isAvailable ? 1 : 0.6,
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px' }}>
                            <span className="dish-name" style={{ lineHeight: 1.3 }}>
                              {dish.name}
                            </span>
                            {!isAvailable && (
                              <span className="badge badge-danger" style={{ fontSize: '9px', padding: '1px 4px' }}>
                                Unavailable
                              </span>
                            )}
                          </div>
                          <div className="dish-price">
                            {formatPaiseToINR(dish.price_paise)}
                          </div>

                          {/* Quick Modifiers / Add-on Accents (Spicy Amber Yellow) */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                            <span className="modifier-chip" title="Add special modifier note">
                              Extra Gravy
                            </span>
                            <span className="modifier-chip" title="Add special modifier note">
                              Spicy
                            </span>
                          </div>
                        </div>

                        {/* Add / Quantity Controller */}
                        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          {qtyInCart > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                style={{ width: '26px', height: '26px', padding: 0, backgroundColor: '#F1F5F9', color: '#0F172A', border: '1px solid #CBD5E1' }}
                                onClick={() => removeFromCart(dish.id)}
                              >
                                <Minus size={12} />
                              </button>
                              <span style={{ fontWeight: 800, minWidth: '18px', textAlign: 'center', color: '#0F172A', fontSize: '13px' }}>
                                {qtyInCart}
                              </span>
                              <button
                                type="button"
                                className="btn-primary btn-sm"
                                style={{ width: '26px', height: '26px', padding: 0 }}
                                onClick={() => addToCart(dish.id)}
                                disabled={!isAvailable}
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn-primary btn-sm"
                              onClick={() => addToCart(dish.id)}
                              disabled={!isAvailable}
                              style={{ width: '100%', minHeight: '28px' }}
                            >
                              <Plus size={12} />
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
                    <h3 style={{ color: 'var(--text-primary)' }}>Order For {currentDisplayTable}</h3>
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
                      <span>{isSubmitting ? 'Sending to Kitchen (KOT)...' : `Send to Kitchen (${currentDisplayTable}) (${totalCartQty} items)`}</span>
                    </button>
                  </div>
                )}

                {/* Preparation Status of Current Customer's Active Session */}
                {currentSession && tableSessionOrderItems.length > 0 && (
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
      )}
    </div>
  );
};
