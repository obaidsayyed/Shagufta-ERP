import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb } from '../lib/mockDatabase';
import { api } from '../lib/api';
import { StaffProfile } from '../types/database';
import { rupeesToPaise } from '../lib/currency';

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

  // TEST 11 — Cash Settlement & Exact Change Calculation
  it('Test 11: Accurately computes exact change return for cash settlement and settles properly', () => {
    const table = mockDb.getTables()[1];
    const paneer = mockDb.getMenuItems().find((m) => m.name === 'Paneer Butter Masala')!;

    const orderRes = mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table.id,
      items: [{ menu_item_id: paneer.id, quantity: 1 }],
      caller_staff: waiterStaff,
    });

    const bill = mockDb.getBills().find((b) => b.table_session_id === orderRes.table_session_id)!;
    expect(bill.final_total_paise).toBe(paneer.price_paise); // e.g. ₹220 = 22000 paise

    // Verify change calculation logic:
    // Paneer Butter Masala is ₹250 (25000 paise). If customer gives ₹500 (50000 paise):
    const cashGivenPaise = 50000;
    const changeDuePaise = cashGivenPaise - bill.final_total_paise;
    expect(changeDuePaise).toBe(25000); // ₹250.00 exact change

    // If customer gives exact ₹250 (25000 paise)
    expect(cashGivenPaise - 25000 - bill.final_total_paise).toBe(0);

    // Settle via Cash
    const settleRes = mockDb.rpcSettleBill({
      bill_id: bill.id,
      payment_method: 'cash',
      caller_staff: adminStaff,
    });

    expect(settleRes.status).toBe('success');
    expect(settleRes.payment_method).toBe('cash');

    const updatedBill = mockDb.getBills().find((b) => b.id === bill.id)!;
    expect(updatedBill.status).toBe('settled');
    expect(updatedBill.payment_method).toBe('cash');
  });

  // TEST 12 — Two customers on a single table & capacity limit
  it('Test 12: Allocates up to 2 customers per table with (2) suffix, enforces max 2 limit, and settles separately', async () => {
    const table = mockDb.getTables()[2]; // e.g. T3
    const roti = mockDb.getMenuItems().find((m) => m.name === 'Butter Roti')!;
    const paneer = mockDb.getMenuItems().find((m) => m.name === 'Paneer Butter Masala')!;

    // 1. Allocate Customer 1 on table
    const cust1Res = mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table.id,
      customer_number: 1,
      items: [{ menu_item_id: roti.id, quantity: 2 }],
      caller_staff: waiterStaff,
    });

    const cust1Session = mockDb.getTableSessions().find((s) => s.id === cust1Res.table_session_id)!;
    expect(cust1Session.customer_number).toBe(1);
    const cust1Bill = mockDb.getBills().find((b) => b.id === cust1Res.bill_id)!;
    expect(cust1Bill.bill_number).toContain(table.table_number);
    expect(cust1Bill.bill_number).not.toContain('(2)');

    // 2. Allocate Customer 2 on the SAME table
    const cust2Res = mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table.id,
      customer_number: 2,
      items: [{ menu_item_id: paneer.id, quantity: 1 }],
      caller_staff: waiterStaff,
    });

    const cust2Session = mockDb.getTableSessions().find((s) => s.id === cust2Res.table_session_id)!;
    expect(cust2Session.customer_number).toBe(2);
    expect(cust1Session.id).not.toBe(cust2Session.id); // distinct sessions!

    const cust2Bill = mockDb.getBills().find((b) => b.id === cust2Res.bill_id)!;
    // Suffix (2) must be present for customer 2!
    expect(cust2Bill.bill_number).toContain(`${table.table_number} (2)`);

    // Verify Kitchen tickets show (2) suffix for customer 2
    const prepGroups = api.getKitchenPreparationGroups(
      mockDb.getOrders(),
      mockDb.getOrderItems(),
      mockDb.getTables(),
      mockDb.getParcelOrders()
    );
    const cust2Prep = prepGroups.find((g) => g.table_number === `${table.table_number} (2)`);
    expect(cust2Prep).toBeDefined();
    expect(cust2Prep?.dish_name).toBe('Paneer Butter Masala');

    // 3. Customer 1 existing session can receive more orders without problem
    expect(() => {
      mockDb.rpcSubmitOrder({
        order_type: 'dine_in',
        table_id: table.id,
        customer_number: 1,
        items: [{ menu_item_id: roti.id, quantity: 1 }],
        caller_staff: waiterStaff,
      });
    }).not.toThrow();

    // Verify open sessions count for this physical table is exactly 2 (Customer 1 slot + Customer 2 slot)
    const c2Table = mockDb.getTables().find((t) => t.table_number === `${table.table_number} (2)`)!;
    const openSessions = mockDb.getTableSessions().filter((s) => (s.table_id === table.id || s.table_id === c2Table.id) && s.session_status === 'open');
    expect(openSessions.length).toBe(2);

    // If attempting to open a 3rd customer session on the table -> must throw error
    expect(() => {
      mockDb.rpcSubmitOrder({
        order_type: 'dine_in',
        table_id: table.id,
        customer_number: 3, // Prohibited!
        items: [{ menu_item_id: roti.id, quantity: 1 }],
        caller_staff: waiterStaff,
      });
    }).toThrow(/Table capacity reached: A table cannot accommodate more than 2 customers/);

    // 4. Settle Customer 1
    mockDb.rpcSettleBill({
      bill_id: cust1Bill.id,
      payment_method: 'cash',
      caller_staff: adminStaff,
    });

    expect(cust1Bill.status).toBe('settled');
    // Customer 2 session is still open and running
    expect(cust2Bill.status).toBe('unsettled');
    const remainingOpenSessions = mockDb.getTableSessions().filter((s) => (s.table_id === table.id || s.table_id === c2Table.id) && s.session_status === 'open');
    expect(remainingOpenSessions.length).toBe(1);
    expect(remainingOpenSessions[0].id).toBe(cust2Session.id);

    // Settle Customer 2
    mockDb.rpcSettleBill({
      bill_id: cust2Bill.id,
      payment_method: 'online',
      caller_staff: adminStaff,
    });
    expect(cust2Bill.status).toBe('settled');
  });

  // TEST 13 — Bulk menu file import (CSV / Excel 3-column parser)
  it('Test 13: Bulk menu item parser accepts 3 columns in any order and correctly creates categories and items', async () => {
    // Test parsing with columns in different order: price, name, category
    const sampleRows = [
      ['price', 'name', 'category'],
      [180, 'Crispy Corn', 'Appetizers'],
      ['220.50', 'Veg Kolhapuri', 'Curries'],
      ['45', 'Tandoori Roti', 'Breads'],
    ];

    // Normalize and column mapping logic
    const normalize = (str: any) => String(str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const header = sampleRows[0];
    let nameIdx = -1, catIdx = -1, priceIdx = -1;
    header.forEach((col, idx) => {
      const n = normalize(col);
      if (n === 'name') nameIdx = idx;
      if (n === 'category') catIdx = idx;
      if (n === 'price') priceIdx = idx;
    });

    expect(nameIdx).toBe(1);
    expect(catIdx).toBe(2);
    expect(priceIdx).toBe(0);

    // Import items via api
    const items = sampleRows.slice(1);
    for (const row of items) {
      const name = String(row[nameIdx]);
      const catName = String(row[catIdx]);
      const pricePaise = rupeesToPaise(row[priceIdx]);

      // Category auto-creation if not exists
      let cat = mockDb.getMenuCategories().find((c) => c.name.toLowerCase() === catName.toLowerCase());
      if (!cat) {
        cat = mockDb.createCategory(catName);
      }

      const item = mockDb.createMenuItem({
        name,
        category_id: cat.id,
        price_paise: pricePaise,
      });

      expect(item.name).toBe(name);
      expect(item.price_paise).toBe(pricePaise);
    }

    // Verify created items exist in menu
    const menu = mockDb.getMenuItems();
    const crispyCorn = menu.find((m) => m.name === 'Crispy Corn');
    expect(crispyCorn).toBeDefined();
    expect(crispyCorn?.price_paise).toBe(18000);

    const vegKolhapuri = menu.find((m) => m.name === 'Veg Kolhapuri');
    expect(vegKolhapuri).toBeDefined();
    expect(vegKolhapuri?.price_paise).toBe(22050);
  });

  // TEST 14 — Parallel customer ordering on same table: separate kitchen tickets, active preparation & billing
  it('Test 14: Parallel customer ordering on same table displays separate kitchen items and active preparation without collision', async () => {
    const table = mockDb.getTables()[0]; // T1
    const roti = mockDb.getMenuItems().find((m) => m.name === 'Butter Roti')!;
    const dal = mockDb.getMenuItems().find((m) => m.name === 'Dal Tadka')!;
    const paneer = mockDb.getMenuItems().find((m) => m.name === 'Paneer Butter Masala')!;

    // 1. Submit order for Customer 1
    const cust1Res = mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table.id,
      customer_number: 1,
      items: [{ menu_item_id: roti.id, quantity: 3 }],
      caller_staff: waiterStaff,
    });
    expect(cust1Res.status).toBe('success');

    // 2. Submit order for Customer 2 on the same physical table
    const cust2Res = mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table.id,
      customer_number: 2,
      items: [{ menu_item_id: dal.id, quantity: 1 }, { menu_item_id: paneer.id, quantity: 1 }],
      caller_staff: waiterStaff,
    });
    expect(cust2Res.status).toBe('success');

    // 3. Verify distinct sessions
    expect(cust1Res.table_session_id).not.toBe(cust2Res.table_session_id);

    // 4. Verify Waiter View Active Kitchen Preparation resolution for each customer
    const allOrderItems = mockDb.getOrderItems();
    const cust1ActiveItems = allOrderItems.filter((oi) => oi.table_session_id === cust1Res.table_session_id);
    const cust2ActiveItems = allOrderItems.filter((oi) => oi.table_session_id === cust2Res.table_session_id);

    expect(cust1ActiveItems.length).toBe(1);
    expect(cust1ActiveItems[0].dish_name).toBe('Butter Roti');
    expect(cust1ActiveItems[0].ordered_quantity).toBe(3);

    expect(cust2ActiveItems.length).toBe(2);
    expect(cust2ActiveItems.map((i) => i.dish_name)).toContain('Dal Tadka');
    expect(cust2ActiveItems.map((i) => i.dish_name)).toContain('Paneer Butter Masala');

    // 5. Verify Kitchen View groups items separately with (2) suffix for customer 2
    const prepGroups = api.getKitchenPreparationGroups(
      mockDb.getOrders(),
      mockDb.getOrderItems(),
      mockDb.getTables(),
      mockDb.getParcelOrders(),
      mockDb.getTableSessions()
    );

    const cust1Groups = prepGroups.filter((g) => g.table_session_id === cust1Res.table_session_id);
    const cust2Groups = prepGroups.filter((g) => g.table_session_id === cust2Res.table_session_id);

    expect(cust1Groups.length).toBe(1);
    expect(cust1Groups[0].table_number).toBe(table.table_number);
    expect(cust1Groups[0].dish_name).toBe('Butter Roti');

    expect(cust2Groups.length).toBe(2);
    for (const g of cust2Groups) {
      expect(g.table_number).toBe(`${table.table_number} (2)`);
    }

    // 6. Verify Chef can mark Customer 2 item ready without affecting Customer 1
    const dalGroup = cust2Groups.find((g) => g.dish_name === 'Dal Tadka')!;
    mockDb.rpcMarkPrepGroupReady({
      table_session_id: cust2Res.table_session_id,
      menu_item_id: dal.id,
      quantity_to_ready: 1,
      caller_staff: chefStaff,
    });

    const refreshedItems = mockDb.getOrderItems();
    const readyDal = refreshedItems.find((oi) => oi.table_session_id === cust2Res.table_session_id && oi.dish_name === 'Dal Tadka')!;
    expect(readyDal.prepared_quantity).toBe(1);
    expect(readyDal.status).toBe('ready');

    const unreadyRoti = refreshedItems.find((oi) => oi.table_session_id === cust1Res.table_session_id && oi.dish_name === 'Butter Roti')!;
    expect(unreadyRoti.prepared_quantity).toBe(0);
    expect(unreadyRoti.status).toBe('pending');
  });

  // TEST 15 — Bill Adjustment directly modifies items, quantities and totals without printing messages
  it('Test 15: Bill Adjustment increases, decreases, removes and adds dishes directly with accurate totals', () => {
    const table = mockDb.getTables()[0];
    const menuItems = mockDb.getMenuItems();
    const roti = menuItems.find((m) => m.name === 'Butter Roti')!;
    const paneer = menuItems.find((m) => m.name === 'Paneer Butter Masala')!;
    const dal = menuItems.find((m) => m.name === 'Dal Tadka')!;

    // 1. Submit initial order: 2 rotis and 1 paneer
    const orderRes = mockDb.rpcSubmitOrder({
      order_type: 'dine_in',
      table_id: table.id,
      items: [
        { menu_item_id: roti.id, quantity: 2 },
        { menu_item_id: paneer.id, quantity: 1 },
      ],
      caller_staff: waiterStaff,
    });

    const bill = mockDb.getBills().find((b) => b.table_session_id === orderRes.table_session_id)!;
    expect(bill).toBeDefined();
    const initialExpectedTotal = (roti.price_paise * 2) + paneer.price_paise;
    expect(bill.final_total_paise).toBe(initialExpectedTotal);

    const items = mockDb.getOrderItems().filter((oi) => oi.table_session_id === orderRes.table_session_id);
    const rotiItem = items.find((oi) => oi.menu_item_id === roti.id)!;
    const paneerItem = items.find((oi) => oi.menu_item_id === paneer.id)!;

    // 2. Increase roti quantity from 2 to 3
    const adjustRes1 = mockDb.rpcAdjustBillItem({
      bill_id: bill.id,
      order_item_id: rotiItem.id,
      action: 'increase',
      caller_staff: adminStaff,
    });
    expect(adjustRes1.status).toBe('success');
    expect(adjustRes1.bill.final_total_paise).toBe((roti.price_paise * 3) + paneer.price_paise);

    // 3. Decrease roti quantity from 3 to 2
    const adjustRes2 = mockDb.rpcAdjustBillItem({
      bill_id: bill.id,
      order_item_id: rotiItem.id,
      action: 'decrease',
      caller_staff: adminStaff,
    });
    expect(adjustRes2.status).toBe('success');
    expect(adjustRes2.bill.final_total_paise).toBe((roti.price_paise * 2) + paneer.price_paise);

    // 4. Delete paneer item
    const adjustRes3 = mockDb.rpcAdjustBillItem({
      bill_id: bill.id,
      order_item_id: paneerItem.id,
      action: 'delete',
      caller_staff: adminStaff,
    });
    expect(adjustRes3.status).toBe('success');
    expect(adjustRes3.bill.final_total_paise).toBe(roti.price_paise * 2);
    expect(adjustRes3.order_items.some((oi) => oi.id === paneerItem.id)).toBe(false);

    // 5. Add Dal Tadka to the bill
    const addRes = mockDb.rpcAddDishToBill({
      bill_id: bill.id,
      menu_item_id: dal.id,
      caller_staff: adminStaff,
    });
    expect(addRes.status).toBe('success');
    expect(addRes.bill.final_total_paise).toBe((roti.price_paise * 2) + dal.price_paise);
    expect(addRes.order_items.some((oi) => oi.menu_item_id === dal.id)).toBe(true);

    // 6. Settle the bill and verify payment final total matches
    const settleRes = mockDb.rpcSettleBill({
      bill_id: bill.id,
      payment_method: 'online',
      caller_staff: adminStaff,
    });
    expect(settleRes.status).toBe('success');
    expect(settleRes.final_total_paise).toBe((roti.price_paise * 2) + dal.price_paise);
  });

  // TEST 16 — Parcel Bill Adjustment (Takeaway parcel items increased, decreased, removed and added directly)
  it('Test 16: Parcel Bill adjustments and dish additions for takeaway orders', () => {
    const biryani = mockDb.getMenuItems().find((m) => m.name === 'Veg Biryani')!;
    const naan = mockDb.getMenuItems().find((m) => m.name === 'Butter Naan')!;

    // 1. Submit parcel order
    const parcelOrder = mockDb.rpcSubmitOrder({
      order_type: 'parcel',
      parcel_customer_notes: 'Spicy parcel',
      items: [{ menu_item_id: biryani.id, quantity: 2 }],
      caller_staff: adminStaff,
    });
    expect(parcelOrder.status).toBe('success');
    expect(parcelOrder.parcel_id).toBeDefined();

    const bills = mockDb.getBills();
    const parcelBill = bills.find((b) => b.parcel_id === parcelOrder.parcel_id)!;
    expect(parcelBill).toBeDefined();
    expect(parcelBill.subtotal_paise).toBe(biryani.price_paise * 2);

    const items = mockDb.getOrderItems().filter((oi) => oi.parcel_id === parcelOrder.parcel_id);
    const biryaniItem = items.find((oi) => oi.menu_item_id === biryani.id)!;

    // 2. Increase parcel item quantity
    const incRes = mockDb.rpcAdjustBillItem({
      bill_id: parcelBill.id,
      order_item_id: biryaniItem.id,
      action: 'increase',
      caller_staff: adminStaff,
    });
    expect(incRes.status).toBe('success');
    expect(incRes.bill.subtotal_paise).toBe(biryani.price_paise * 3);

    // 3. Add Butter Naan directly to parcel bill
    const addRes = mockDb.rpcAddDishToBill({
      bill_id: parcelBill.id,
      menu_item_id: naan.id,
      caller_staff: adminStaff,
    });
    expect(addRes.status).toBe('success');
    expect(addRes.bill.subtotal_paise).toBe((biryani.price_paise * 3) + naan.price_paise);

    // 4. Decrease parcel item quantity
    const decRes = mockDb.rpcAdjustBillItem({
      bill_id: parcelBill.id,
      order_item_id: biryaniItem.id,
      action: 'decrease',
      caller_staff: adminStaff,
    });
    expect(decRes.status).toBe('success');
    expect(decRes.bill.subtotal_paise).toBe((biryani.price_paise * 2) + naan.price_paise);

    // 5. Delete Butter Naan from parcel bill
    const freshItems = mockDb.getOrderItems().filter((oi) => oi.parcel_id === parcelOrder.parcel_id);
    const naanItem = freshItems.find((oi) => oi.menu_item_id === naan.id)!;
    const delRes = mockDb.rpcAdjustBillItem({
      bill_id: parcelBill.id,
      order_item_id: naanItem.id,
      action: 'delete',
      caller_staff: adminStaff,
    });
    expect(delRes.status).toBe('success');
    expect(delRes.bill.subtotal_paise).toBe(biryani.price_paise * 2);

    // 6. Settle parcel bill
    const settleRes = mockDb.rpcSettleBill({
      bill_id: parcelBill.id,
      payment_method: 'online',
      caller_staff: adminStaff,
    });
    expect(settleRes.status).toBe('success');
    expect(settleRes.final_total_paise).toBe(biryani.price_paise * 2);
  });
});
