// Domain types and models for Hotel Order Management System

export type StaffRole = 'admin' | 'waiter' | 'chef';

export interface StaffProfile {
  id: string;
  auth_user_id: string;
  staff_id: string; // e.g. ADM-001, WTR-101, CHF-201
  display_name: string;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
  created_by_staff_id?: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  price_paise: number; // Stored in integer paise (₹1 = 100 paise)
  is_available: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiningTable {
  id: string;
  table_number: string; // e.g. T1, T2
  is_active: boolean;
  created_at: string;
}

export type SessionStatus = 'open' | 'settled';

export interface TableSession {
  id: string;
  table_id: string;
  customer_number?: number; // 1 or 2 (defaults to 1). If 2, displayed with (2) after table number
  session_status: SessionStatus;
  opened_at: string;
  settled_at?: string | null;
  created_by_staff_id: string;
}

export interface ParcelOrder {
  id: string;
  parcel_code: string; // e.g. PCL-20261017-1001
  customer_notes?: string | null;
  status: SessionStatus;
  created_at: string;
  settled_at?: string | null;
  created_by_staff_id: string;
}

export type OrderType = 'dine_in' | 'parcel';
export type TicketStatus = 'pending' | 'partial_ready' | 'ready' | 'cancelled';
export type ItemStatus = 'pending' | 'ready' | 'cancelled';

export interface OrderTicket {
  id: string;
  ticket_number: string; // e.g. TKT-142015-102
  order_type: OrderType;
  table_session_id?: string | null;
  parcel_id?: string | null;
  status: TicketStatus;
  idempotency_key?: string | null;
  created_by_staff_id: string;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  table_session_id?: string | null;
  parcel_id?: string | null;
  menu_item_id: string;
  dish_name: string; // Immutable historical snapshot
  category_name: string; // Immutable historical snapshot
  unit_price_paise: number; // Immutable historical snapshot
  ordered_quantity: number;
  prepared_quantity: number;
  cancelled_quantity: number;
  status: ItemStatus;
  created_at: string;
}

export type PaymentMethod = 'cash' | 'online';
export type BillStatus = 'unsettled' | 'settled';

export interface Bill {
  id: string;
  bill_number: string;
  table_session_id?: string | null;
  parcel_id?: string | null;
  subtotal_paise: number;
  adjustments_paise: number;
  final_total_paise: number;
  payment_method?: PaymentMethod | null;
  status: BillStatus;
  settled_at?: string | null;
  settled_by_staff_id?: string | null;
  created_at: string;
}

export type AdjustmentType = 
  | 'item_cancellation' 
  | 'quantity_reduction' 
  | 'return' 
  | 'post_settlement_adjustment';

export interface BillAdjustment {
  id: string;
  bill_id: string;
  order_item_id?: string | null;
  adjustment_type: AdjustmentType;
  quantity_adjusted: number;
  amount_paise: number; // Signed: negative for reductions
  reason: string;
  authorized_by_staff_id: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  performed_by_staff_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

// Kitchen grouped preparation unit
export interface KitchenPreparationGroup {
  group_key: string; // session/parcel + dish id
  order_type: OrderType;
  table_session_id?: string;
  table_number?: string;
  parcel_id?: string;
  parcel_code?: string;
  menu_item_id: string;
  dish_name: string;
  category_name: string;
  total_ordered_qty: number;
  total_prepared_qty: number;
  total_cancelled_qty: number;
  pending_qty: number;
  first_ordered_at: string;
  latest_ordered_at: string;
  item_ids: string[];
  order_ids: string[];
}
