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

  const baseTables = tables.filter((t) => !t.table_number.includes('(2)'));
  const selectedTable = tables.find((t) => t.id === selectedTableId);
  const cleanSelectedNum = selectedTable?.table_number.replace(/\s*\(2\)\s*$/, '').trim().toLowerCase();
  const c2Table = selectedTable ? tables.find((t) => {
    const cleanT = t.table_number.replace(/\s*\(2\)\s*$/, '').trim().toLowerCase();
    return cleanT === cleanSelectedNum && t.table_number.includes('(2)');
  }) : null;

  const customer1Session = selectedTable ? tableSessions.find((s) => {
    if (s.session_status !== 'open') return false;
    if (s.table_id === selectedTable.id && (s.customer_number === undefined || s.customer_number === null || s.customer_number === 1)) return true;
    const sessTbl = tables.find((t) => t.id === s.table_id);
    if (sessTbl && sessTbl.table_number.trim().toLowerCase() === cleanSelectedNum && !sessTbl.table_number.includes('(2)')) return true;
    return false;
  }) : null;

  const customer2Session = selectedTable ? tableSessions.find((s) => {
    if (s.session_status !== 'open') return false;
    if (c2Table && s.table_id === c2Table.id) return true;
    if (s.table_id === selectedTable.id && s.customer_number === 2) return true;
    const sessTbl = tables.find((t) => t.id === s.table_id);
    if (sessTbl && sessTbl.table_number.trim().toLowerCase() === `${cleanSelectedNum} (2)`) return true;
    return false;
  }) : null;

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

      const targetTableId = (selectedCustomerNumber === 2 && c2Table) ? c2Table.id : selectedTableId;

      const result = await api.submitOrder({
        order_type: 'dine_in',
        table_id: targetTableId,
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

  const sessionOrderIds = new Set(tableSessionOrders.map((o) => o.id));
  const tableSessionOrderItems = currentSession
    ? orderItems.filter((oi) => 
        oi.table_session_id === currentSession.id || 
        (oi.order_id && sessionOrderIds.has(oi.order_id))
      )
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
                {baseTables.map((tbl) => {
                  const cleanTblNum = tbl.table_number.replace(/\s*\(2\)\s*$/, '').trim().toLowerCase();
                  const c2 = tables.find((t) => {
                    const cleanT = t.table_number.replace(/\s*\(2\)\s*$/, '').trim().toLowerCase();
                    return cleanT === cleanTblNum && t.table_number.includes('(2)');
                  });
                  const s1 = tableSessions.find((s) => s.table_id === tbl.id && s.session_status === 'open');
                  const s2 = tableSessions.find((s) => {
                    if (s.session_status !== 'open') return false;
                    if (c2 && s.table_id === c2.id) return true;
                    if (s.table_id === tbl.id && s.customer_number === 2) return true;
                    const st = tables.find((t) => t.id === s.table_id);
                    return st && st.table_number.trim().toLowerCase() === `${cleanTblNum} (2)`;
                  });
                  const count = (s1 ? 1 : 0) + (s2 ? 1 : 0);
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
                        setCart1({});
                        setCart2({});
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
                setCart1({});
                setCart2({});
                setSubmitSuccessTicket(null);
                setErrorMessage('');
              }}
              style={{ minHeight: '30px', padding: '0 10px', fontSize: '12px', fontWeight: 600 }}
            >
              <span>Back to Tables</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
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
              marginBottom: '10px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                Customer Allocation (Max 2)
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                Allocate up to 2 separate customers per table with individual bills
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {/* Customer 1 Slot */}
              <button
                type="button"
                onClick={() => setSelectedCustomerNumber(1)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
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
                  <span className="badge badge-pending" style={{ fontSize: '9px', padding: '1px 4px' }}>
                    Active
                  </span>
                ) : (
                  <span className="badge badge-settled" style={{ fontSize: '9px', padding: '1px 4px' }}>
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
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
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
                  <span className="badge badge-pending" style={{ fontSize: '9px', padding: '1px 4px' }}>
                    Active
                  </span>
                ) : (
                  <span className="badge badge-settled" style={{ fontSize: '9px', padding: '1px 4px' }}>
                    Vacant
                  </span>
                )}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="alert-banner alert-banner-danger" style={{ marginBottom: '10px' }}>
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
                marginBottom: '12px',
              }}
            >
              <div>
                <strong>Order Accepted!</strong> Kitchen ticket <strong>{submitSuccessTicket.ticket_number}</strong> sent for <strong>{submitSuccessTicket.tableDisplay}</strong>.
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
              <div className="panel" style={{ marginBottom: '10px', padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="Search dishes by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%' }}
                  />
                  {searchQuery && (
                    <button type="button" className="btn-secondary btn-sm" onClick={() => setSearchQuery('')}>
                      Clear
                    </button>
                  )}
                </div>

                {/* Category pills - wrapped to prevent horizontal scrolling */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
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
                <div className="panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p style={{ fontWeight: 600 }}>No menu items found</p>
                  <span style={{ fontSize: '11.5px' }}>
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
                        </div>

                        {/* Add / Quantity Controller */}
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          {qtyInCart > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                style={{ width: '26px', height: '26px', padding: 0, backgroundColor: '#F1F5F9', color: '#0F172A', border: '1px solid #CBD5E1', fontSize: '14px', fontWeight: 800 }}
                                onClick={() => removeFromCart(dish.id)}
                              >
                                -
                              </button>
                              <span style={{ fontWeight: 800, minWidth: '18px', textAlign: 'center', color: '#0F172A', fontSize: '13px' }}>
                                {qtyInCart}
                              </span>
                              <button
                                type="button"
                                className="btn-primary btn-sm"
                                style={{ width: '26px', height: '26px', padding: 0, fontSize: '14px', fontWeight: 800 }}
                                onClick={() => addToCart(dish.id)}
                                disabled={!isAvailable}
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn-primary btn-sm"
                              onClick={() => addToCart(dish.id)}
                              disabled={!isAvailable}
                              style={{ width: '100%', minHeight: '28px', fontWeight: 700 }}
                            >
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
              <div className="panel" style={{ position: 'sticky', top: '56px' }}>
                <div className="panel-header">
                  <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Order For {currentDisplayTable}</h3>
                  {totalCartQty > 0 && (
                    <button type="button" className="btn-secondary btn-sm" onClick={clearCart} style={{ border: 'none', color: 'var(--text-muted)' }}>
                      Clear
                    </button>
                  )}
                </div>

                {cartEntries.length === 0 ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600 }}>Cart is empty</p>
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
                            padding: '6px 0',
                            borderBottom: '1px solid var(--border-subtle)',
                            fontSize: '12.5px',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item!.name}</div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                              {formatPaiseToINR(item!.price_paise)} x {quantity}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                style={{ width: '22px', height: '22px', padding: 0, fontSize: '13px', fontWeight: 800 }}
                                onClick={() => removeFromCart(item!.id)}
                              >
                                -
                              </button>
                              <span style={{ fontWeight: 600, minWidth: '16px', textAlign: 'center', color: 'var(--text-primary)' }}>
                                {quantity}
                              </span>
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                style={{ width: '22px', height: '22px', padding: 0, fontSize: '13px', fontWeight: 800 }}
                                onClick={() => addToCart(item!.id)}
                              >
                                +
                              </button>
                            </div>
                            <span style={{ fontWeight: 700, minWidth: '55px', textAlign: 'right', color: 'var(--text-primary)' }}>
                              {formatPaiseToINR(subtotalPaise)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Subtotal */}
                    <div
                      style={{
                        paddingTop: '6px',
                        borderTop: '1px solid var(--border-strong)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Items Total</span>
                      <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{formatPaiseToINR(totalCartPaise)}</span>
                    </div>

                    {/* Primary Action Button: Send to Kitchen (KOT) */}
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ width: '100%', minHeight: '42px', fontSize: '13px', fontWeight: 700 }}
                      onClick={handleSubmitOrder}
                      disabled={isSubmitting || totalCartQty === 0}
                    >
                      {isSubmitting ? 'Sending to Kitchen (KOT)...' : `Send to Kitchen (${currentDisplayTable}) (${totalCartQty} items)`}
                    </button>
                  </div>
                )}

                {/* Preparation Status of Current Customer's Active Session */}
                {currentSession && tableSessionOrderItems.length > 0 && (
                  <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.03em' }}>
                        ACTIVE KITCHEN PREPARATION
                      </span>
                    </div>

                    <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      {tableSessionOrderItems.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 0',
                            fontSize: '11.5px',
                            borderBottom: '1px solid var(--border-subtle)',
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>
                            {item.dish_name} x {item.ordered_quantity - item.cancelled_quantity}
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
