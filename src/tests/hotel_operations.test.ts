import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb } from '../lib/mockDatabase';
import { api } from '../lib/api';
import { StaffProfile } from '../types/database';

describe('Hotel Order Management System — Comprehensive Operational Tests', () => {
  let adminStaff: StaffProfile;
  let waiterStaff: StaffProfile;
  let chefStaff: StaffProfile;

  beforeEach(() => {
    mockDb.resetToSeed();
    const profiles = mockDb.getStaffProfiles();
    adminStaff = profiles.find((p) => p.role === 'admin')!;
    waiterStaff = profiles.find((p) => p.role === 'waiter')!;
    chefStaff = profiles.find((p) => p.role === 'chef')!;
  });

  // TEST 1 — Multiple orders at one table
  it('Test 1: Multiple orders at one table attach to single open session and preserve distinct tickets', () => {
    const tables = mockDb.getTables();
    const table1 = tables[0]; // T1
    const menuItems = mockDb.getMenuItems();
    const roti = menuItems.find((m) => m.name === 'Butter Roti')!;
    const dal = menuItems.find((m) => m.name === 'Dal Tadka')!;

    // 1. Submit initial order for Table 1
    const order1Res = mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table1.id,
      items: [{ menu_item_id: roti.id, quantity: 2 }],
      caller_staff: waiterStaff,
    });

    expect(order1Res.status).toBe('success');
    const sessionId1 = order1Res.table_session_id;
    expect(sessionId1).toBeDefined();

    // 2. Submit second order for the same table
    const order2Res = mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table1.id,
      items: [{ menu_item_id: dal.id, quantity: 1 }],
      caller_staff: waiterStaff,
    });

    expect(order2Res.status).toBe('success');
    // Both submissions must attach to the EXACT same open table session
    expect(order2Res.table_session_id).toBe(sessionId1);

    // Tickets must remain distinct for kitchen
    expect(order1Res.order_id).not.toBe(order2Res.order_id);
    expect(order1Res.ticket_number).not.toBe(order2Res.ticket_number);

    // Bill must accumulate both items
    const bills = mockDb.getBills();
    const bill = bills.find((b) => b.table_session_id === sessionId1);
    expect(bill).toBeDefined();
    expect(bill!.subtotal_paise).toBe(roti.price_paise * 2 + dal.price_paise * 1);
  });

  // TEST 2 — Kitchen grouping
  it('Test 2: Kitchen groups pending quantities of same dish for same table while keeping other tables independent', () => {
    const tables = mockDb.getTables();
    const table4 = tables.find((t) => t.table_number === 'T4')!;
    const table7 = tables.find((t) => t.table_number === 'T7')!;
    const roti = mockDb.getMenuItems().find((m) => m.name === 'Butter Roti')!;

    // 1. Table 4 orders 2 rotis
    mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table4.id,
      items: [{ menu_item_id: roti.id, quantity: 2 }],
      caller_staff: waiterStaff,
    });

    // 2. Table 4 later orders 3 more rotis
    mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table4.id,
      items: [{ menu_item_id: roti.id, quantity: 3 }],
      caller_staff: waiterStaff,
    });

    // 3. Table 7 orders 4 rotis
    mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table7.id,
      items: [{ menu_item_id: roti.id, quantity: 4 }],
      caller_staff: waiterStaff,
    });

    // Verify Kitchen Grouping
    const prepGroups = api.getKitchenPreparationGroups(
      mockDb.getOrders(),
      mockDb.getOrderItems(),
      mockDb.getTables(),
      mockDb.getParcelOrders()
    );

    // Table 4 must have pending quantity grouped together as 5 rotis
    const t4Group = prepGroups.find((g) => g.table_number === 'T4' && g.menu_item_id === roti.id);
    expect(t4Group).toBeDefined();
    expect(t4Group!.pending_qty).toBe(5);

    // Table 7 must remain independent as 4 rotis
    const t7Group = prepGroups.find((g) => g.table_number === 'T7' && g.menu_item_id === roti.id);
    expect(t7Group).toBeDefined();
    expect(t7Group!.pending_qty).toBe(4);

    // 4. Chef marks Table 4 rotis ready (all 5)
    mockDb.rpcMarkPrepGroupReady({
      table_session_id: t4Group!.table_session_id,
      menu_item_id: roti.id,
      quantity_to_ready: 5,
      caller_staff: chefStaff,
    });

    // Verify Table 7 was NOT affected
    const prepGroupsAfter = api.getKitchenPreparationGroups(
      mockDb.getOrders(),
      mockDb.getOrderItems(),
      mockDb.getTables(),
      mockDb.getParcelOrders()
    );
    const t7After = prepGroupsAfter.find((g) => g.table_number === 'T7' && g.menu_item_id === roti.id);
    expect(t7After!.pending_qty).toBe(4); // Table 7 still has 4 pending!

    // Table 4 has 0 pending now
    const t4After = prepGroupsAfter.find((g) => g.table_number === 'T4' && g.menu_item_id === roti.id);
    expect(t4After).toBeUndefined(); // Fully prepared items leave active prep queue

    // 5. Order 2 MORE rotis for Table 4
    mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table4.id,
      items: [{ menu_item_id: roti.id, quantity: 2 }],
      caller_staff: waiterStaff,
    });

    // New 2 rotis must form new outstanding preparation work
    const prepGroupsNew = api.getKitchenPreparationGroups(
      mockDb.getOrders(),
      mockDb.getOrderItems(),
      mockDb.getTables(),
      mockDb.getParcelOrders()
    );
    const t4New = prepGroupsNew.find((g) => g.table_number === 'T4' && g.menu_item_id === roti.id);
    expect(t4New!.pending_qty).toBe(2);
    expect(t4New!.total_prepared_qty).toBe(5); // Remembers 5 previously prepared in this session!
  });

  // TEST 3 — Parcel orders
  it('Test 3: Takeaway parcels receive unique parcel IDs, reach kitchen independently and have separate bills', () => {
    const biryani = mockDb.getMenuItems().find((m) => m.name === 'Veg Biryani')!;

    // 1. Create Parcel 1
    const p1 = mockDb.rpcSubmitOrder({
      order_type: 'parcel',
      parcel_customer_notes: 'Customer A',
      items: [{ menu_item_id: biryani.id, quantity: 1 }],
      caller_staff: adminStaff,
    });

    // 2. Create Parcel 2
    const p2 = mockDb.rpcSubmitOrder({
      order_type: 'parcel',
      parcel_customer_notes: 'Customer B',
      items: [{ menu_item_id: biryani.id, quantity: 2 }],
      caller_staff: adminStaff,
    });

    // Confirm unique parcel IDs
    expect(p1.parcel_id).not.toBe(p2.parcel_id);
    expect(p1.parcel_code).not.toBe(p2.parcel_code);
    expect(p1.parcel_code).toMatch(/^PCL-/);
    expect(p2.parcel_code).toMatch(/^PCL-/);

    // Confirm separate bills
    expect(p1.bill_id).not.toBe(p2.bill_id);

    // Confirm kitchen tracks them separately
    const prepGroups = api.getKitchenPreparationGroups(
      mockDb.getOrders(),
      mockDb.getOrderItems(),
      mockDb.getTables(),
      mockDb.getParcelOrders()
    );

    const parcel1Group = prepGroups.find((g) => g.parcel_id === p1.parcel_id);
    const parcel2Group = prepGroups.find((g) => g.parcel_id === p2.parcel_id);

    expect(parcel1Group).toBeDefined();
    expect(parcel2Group).toBeDefined();
    expect(parcel1Group!.pending_qty).toBe(1);
    expect(parcel2Group!.pending_qty).toBe(2);
  });

  // TEST 4 — Menu price history
  it('Test 4: Menu price changes do not alter historical bills or existing orders', () => {
    const paneer = mockDb.getMenuItems().find((m) => m.name === 'Paneer Butter Masala')!;
    const originalPrice = paneer.price_paise; // e.g. 25000 (₹250)
    const table = mockDb.getTables()[0];

    // 1. Submit order at original price
    const orderRes = mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table.id,
      items: [{ menu_item_id: paneer.id, quantity: 1 }],
      caller_staff: waiterStaff,
    });

    const billBefore = mockDb.getBills().find((b) => b.table_session_id === orderRes.table_session_id)!;
    expect(billBefore.final_total_paise).toBe(originalPrice);

    // 2. Admin reprices Paneer Butter Masala to ₹300 (30000 paise)
    mockDb.updateMenuItem(paneer.id, { price_paise: 30000 });

    // 3. Confirm existing order and bill PRESERVE original price snapshot
    const existingItem = mockDb.getOrderItems().find((oi) => oi.order_id === orderRes.order_id)!;
    expect(existingItem.unit_price_paise).toBe(originalPrice);

    const billAfter = mockDb.getBills().find((b) => b.id === billBefore.id)!;
    expect(billAfter.final_total_paise).toBe(originalPrice); // Still ₹250!

    // 4. Confirm new order uses the new price
    const table2 = mockDb.getTables()[1];
    const newOrderRes = mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table2.id,
      items: [{ menu_item_id: paneer.id, quantity: 1 }],
      caller_staff: waiterStaff,
    });

    const newBill = mockDb.getBills().find((b) => b.table_session_id === newOrderRes.table_session_id)!;
    expect(newBill.final_total_paise).toBe(30000); // Uses ₹300!
  });

  // TEST 5 — Returns and Adjustments
  it('Test 5: Unprepared cancellation updates kitchen queue; prepared return preserves kitchen prep history', () => {
    const table = mockDb.getTables()[0];
    const paneer = mockDb.getMenuItems().find((m) => m.name === 'Paneer Butter Masala')!;
    const roti = mockDb.getMenuItems().find((m) => m.name === 'Butter Roti')!;

    // Table orders 2 paneer and 4 rotis
    const orderRes = mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table.id,
      items: [
        { menu_item_id: paneer.id, quantity: 2 },
        { menu_item_id: roti.id, quantity: 4 },
      ],
      caller_staff: waiterStaff,
    });

    const items = mockDb.getOrderItems().filter((oi) => oi.order_id === orderRes.order_id);
    const paneerItem = items.find((i) => i.menu_item_id === paneer.id)!;
    const rotiItem = items.find((i) => i.menu_item_id === roti.id)!;

    // Scenario A: Cancel 1 unprepared paneer before kitchen starts
    mockDb.rpcAdjustOrderItem({
      order_item_id: paneerItem.id,
      adjustment_type: 'item_cancellation',
      quantity_to_adjust: 1,
      reason: 'Customer changed mind before preparation',
      caller_staff: adminStaff,
    });

    // Kitchen queue must reflect only 1 paneer remaining to cook
    const prepGroups = api.getKitchenPreparationGroups(
      mockDb.getOrders(),
      mockDb.getOrderItems(),
      mockDb.getTables(),
      mockDb.getParcelOrders()
    );
    const paneerGroup = prepGroups.find((g) => g.menu_item_id === paneer.id);
    expect(paneerGroup!.pending_qty).toBe(1);

    // Scenario B: Kitchen marks 4 rotis ready
    mockDb.rpcMarkPrepGroupReady({
      table_session_id: orderRes.table_session_id,
      menu_item_id: roti.id,
      quantity_to_ready: 4,
      caller_staff: chefStaff,
    });

    // Customer returns 1 roti due to quality issue
    mockDb.rpcAdjustOrderItem({
      order_item_id: rotiItem.id,
      adjustment_type: 'return',
      quantity_to_adjust: 1,
      reason: 'Customer returned 1 burnt roti',
      caller_staff: adminStaff,
    });

    // Kitchen preparation history MUST be preserved (prepared_quantity remains 4!)
    const updatedRoti = mockDb.getOrderItems().find((i) => i.id === rotiItem.id)!;
    expect(updatedRoti.prepared_quantity).toBe(4);

    // Bill reflects the return deduction
    const bill = mockDb.getBills().find((b) => b.table_session_id === orderRes.table_session_id)!;
    expect(bill.adjustments_paise).toBe(-roti.price_paise);
  });

  // TEST 6 — Settlement
  it('Test 6: Settle open bill via Cash or Online; prevents duplicate settlement', () => {
    const table = mockDb.getTables()[0];
    const lassi = mockDb.getMenuItems().find((m) => m.name === 'Sweet Lassi')!;

    const orderRes = mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table.id,
      items: [{ menu_item_id: lassi.id, quantity: 2 }],
      caller_staff: waiterStaff,
    });

    const bill = mockDb.getBills().find((b) => b.table_session_id === orderRes.table_session_id)!;

    // 1. Settle using Online payment
    const settleRes = mockDb.rpcSettleBill({
      bill_id: bill.id,
      payment_method: 'online',
      caller_staff: adminStaff,
    });

    expect(settleRes.status).toBe('success');
    expect(settleRes.payment_method).toBe('online');

    // Confirm session is closed
    const session = mockDb.getTableSessions().find((s) => s.id === orderRes.table_session_id)!;
    expect(session.session_status).toBe('settled');

    // 2. Attempt duplicate settlement
    const duplicateSettle = mockDb.rpcSettleBill({
      bill_id: bill.id,
      payment_method: 'cash',
      caller_staff: adminStaff,
    });

    // Idempotent return without double recording payment
    expect(duplicateSettle.status).toBe('already_settled');
    expect(duplicateSettle.payment_method).toBe('online');
  });

  // TEST 7 — Security & Role Permissions
  it('Test 7: Enforces strict role gating and blocks disabled accounts', () => {
    const table = mockDb.getTables()[0];
    const bill = mockDb.getBills()[0];

    // Waiter cannot settle bills
    expect(() => {
      mockDb.rpcSettleBill({
        bill_id: 'any-bill',
        payment_method: 'cash',
        caller_staff: waiterStaff,
      });
    }).toThrow(/Permission denied/);

    // Chef cannot submit orders
    expect(() => {
      mockDb.rpcSubmitOrder({
        order_type: 'dine_in',
        table_id: table.id,
        items: [{ menu_item_id: 'any', quantity: 1 }],
        caller_staff: chefStaff,
      });
    }).toThrow(/Permission denied/);

    // Waiter cannot create parcel orders
    expect(() => {
      mockDb.rpcSubmitOrder({
        order_type: 'parcel',
        items: [{ menu_item_id: 'any', quantity: 1 }],
        caller_staff: waiterStaff,
      });
    }).toThrow(/Permission denied/);

    // Disabled account cannot perform operations
    mockDb.toggleStaffStatus(waiterStaff.id, false);
    const disabledWaiter = mockDb.getStaffProfiles().find((p) => p.id === waiterStaff.id)!;
    expect(disabledWaiter.is_active).toBe(false);

    expect(() => {
      mockDb.rpcSubmitOrder({
        order_type: 'dine_in',
        table_id: table.id,
        items: [{ menu_item_id: 'any', quantity: 1 }],
        caller_staff: disabledWaiter,
      });
    }).toThrow(/Unauthorized/);
  });

  // TEST 8 — Real-time event deduplication
  it('Test 8: Real-time subscriptions broadcast new orders without duplicate chimes on re-runs', () => {
    let receivedEventsCount = 0;
    const unsubscribe = mockDb.subscribe((event) => {
      if (event === 'NEW_ORDER') receivedEventsCount++;
    });

    const table = mockDb.getTables()[0];
    const item = mockDb.getMenuItems()[0];

    // Submit order
    mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table.id,
      items: [{ menu_item_id: item.id, quantity: 1 }],
      caller_staff: waiterStaff,
    });

    expect(receivedEventsCount).toBe(1);
    unsubscribe();
  });

  // TEST 9 — Analytics
  it('Test 9: Financial analytics distinguishes collections from unsettled bills and calculates category share', () => {
    const table1 = mockDb.getTables()[0];
    const table2 = mockDb.getTables()[1];
    const lassi = mockDb.getMenuItems().find((m) => m.name === 'Sweet Lassi')!; // Beverages (8000 paise)
    const soda = mockDb.getMenuItems().find((m) => m.name === 'Fresh Lime Soda')!; // Beverages (6000 paise)

    // Table 1 orders Lassi and is SETTLED via Cash
    const o1 = mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table1.id,
      items: [{ menu_item_id: lassi.id, quantity: 1 }],
      caller_staff: waiterStaff,
    });
    const b1 = mockDb.getBills().find((b) => b.table_session_id === o1.table_session_id)!;
    mockDb.rpcSettleBill({ bill_id: b1.id, payment_method: 'cash', caller_staff: adminStaff });

    // Table 2 orders Soda and is UNSETTLED
    mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table2.id,
      items: [{ menu_item_id: soda.id, quantity: 1 }],
      caller_staff: waiterStaff,
    });

    const analytics = api.calculateAnalytics(
      mockDb.getBills(),
      mockDb.getOrderItems(),
      { preset: 'today', paymentMethod: 'all' }
    );

    // Only Table 1 (Lassi: ₹80) should be counted in settled revenue
    expect(analytics.overall.totalSettledRevenuePaise).toBe(8000);
    expect(analytics.overall.totalCashPaise).toBe(8000);
    expect(analytics.overall.totalOnlinePaise).toBe(0);

    // Unsettled Soda (₹60) must be tracked under activeUnsettledPaise, NOT collected revenue!
    expect(analytics.overall.activeUnsettledPaise).toBe(6000);

    // Dish performance check
    const lassiPerf = analytics.dishPerformance.find((d) => d.dish_name === 'Sweet Lassi')!;
    expect(lassiPerf).toBeDefined();
    expect(lassiPerf.net_quantity_sold).toBe(1);
    expect(lassiPerf.category_revenue_share_percent).toBe(100);
  });

  // TEST 10 — Failure handling & Idempotency
  it('Test 10: Idempotency key prevents duplicate orders and bills upon network retries', () => {
    const table = mockDb.getTables()[2];
    const item = mockDb.getMenuItems()[0];
    const idempotencyKey = 'unique-net-retry-key-12345';

    // First attempt
    const res1 = mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table.id,
      items: [{ menu_item_id: item.id, quantity: 2 }],
      idempotency_key: idempotencyKey,
      caller_staff: waiterStaff,
    });

    expect(res1.status).toBe('success');

    // Network retry with exact same idempotency key
    const res2 = mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table.id,
      items: [{ menu_item_id: item.id, quantity: 2 }],
      idempotency_key: idempotencyKey,
      caller_staff: waiterStaff,
    });

    // Must return original ticket without creating a second order or doubling bill!
    expect(res2.order_id).toBe(res1.order_id);
    expect(res2.ticket_number).toBe(res1.ticket_number);

    const allOrders = mockDb.getOrders().filter((o) => o.idempotency_key === idempotencyKey);
    expect(allOrders.length).toBe(1); // Exactly 1 order in database!
  });
});
