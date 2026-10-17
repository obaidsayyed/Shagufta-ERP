-- Migration: 20261017000000_initial_hotel_schema.sql
-- Description: Hotel Order Management System - Schema, Constraints, RLS & Transactional RPCs

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Staff Profiles & Roles
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    staff_id TEXT UNIQUE NOT NULL, -- e.g. ADM-001, WTR-101, CHF-201
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'waiter', 'chef')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_staff_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_role ON public.staff_profiles(role);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_staff_id ON public.staff_profiles(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_auth_user ON public.staff_profiles(auth_user_id);

-- 3. Menu Categories
CREATE TABLE IF NOT EXISTS public.menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_order ON public.menu_categories(display_order);

-- 4. Menu Items
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.menu_categories(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    price_paise BIGINT NOT NULL CHECK (price_paise >= 0),
    is_available BOOLEAN NOT NULL DEFAULT true,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON public.menu_items(is_available) WHERE is_archived = false;

-- 5. Dining Tables
CREATE TABLE IF NOT EXISTS public.tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number TEXT UNIQUE NOT NULL, -- e.g. T1, T2, T3
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Table Sessions (Running Bills)
CREATE TABLE IF NOT EXISTS public.table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE RESTRICT,
    session_status TEXT NOT NULL DEFAULT 'open' CHECK (session_status IN ('open', 'settled')),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at TIMESTAMPTZ,
    created_by_staff_id TEXT NOT NULL
);

-- CRITICAL INTEGRITY: Exactly one open session per table at any point in time
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_open_session_per_table 
    ON public.table_sessions (table_id) 
    WHERE (session_status = 'open');

CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON public.table_sessions(session_status);

-- 7. Parcel Orders (Takeaway Sessions)
CREATE TABLE IF NOT EXISTS public.parcel_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_code TEXT UNIQUE NOT NULL, -- e.g. PCL-1001
    customer_notes TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at TIMESTAMPTZ,
    created_by_staff_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_parcel_orders_status ON public.parcel_orders(status);

-- 8. Orders (Kitchen Tickets)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number TEXT NOT NULL,
    order_type TEXT NOT NULL CHECK (order_type IN ('dine_in', 'parcel')),
    table_session_id UUID REFERENCES public.table_sessions(id) ON DELETE RESTRICT,
    parcel_id UUID REFERENCES public.parcel_orders(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial_ready', 'ready', 'cancelled')),
    idempotency_key TEXT UNIQUE,
    created_by_staff_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_order_target CHECK (
        (order_type = 'dine_in' AND table_session_id IS NOT NULL AND parcel_id IS NULL) OR
        (order_type = 'parcel' AND parcel_id IS NOT NULL AND table_session_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_orders_session ON public.orders(table_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_parcel ON public.orders(parcel_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- 9. Order Items (Dish line items with historical snapshot and readiness tracking)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    table_session_id UUID REFERENCES public.table_sessions(id) ON DELETE RESTRICT,
    parcel_id UUID REFERENCES public.parcel_orders(id) ON DELETE RESTRICT,
    menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
    dish_name TEXT NOT NULL, -- Historical snapshot
    category_name TEXT NOT NULL, -- Historical snapshot
    unit_price_paise BIGINT NOT NULL CHECK (unit_price_paise >= 0), -- Historical snapshot
    ordered_quantity INTEGER NOT NULL CHECK (ordered_quantity > 0),
    prepared_quantity INTEGER NOT NULL DEFAULT 0 CHECK (prepared_quantity >= 0),
    cancelled_quantity INTEGER NOT NULL DEFAULT 0 CHECK (cancelled_quantity >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_quantity_validity CHECK (prepared_quantity + cancelled_quantity <= ordered_quantity)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_session_dish ON public.order_items(table_session_id, menu_item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_parcel_dish ON public.order_items(parcel_id, menu_item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON public.order_items(status);

-- 10. Bills
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_number TEXT UNIQUE NOT NULL,
    table_session_id UUID UNIQUE REFERENCES public.table_sessions(id) ON DELETE RESTRICT,
    parcel_id UUID UNIQUE REFERENCES public.parcel_orders(id) ON DELETE RESTRICT,
    subtotal_paise BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_paise >= 0),
    adjustments_paise BIGINT NOT NULL DEFAULT 0,
    final_total_paise BIGINT NOT NULL DEFAULT 0 CHECK (final_total_paise >= 0),
    payment_method TEXT CHECK (payment_method IN ('cash', 'online')),
    status TEXT NOT NULL DEFAULT 'unsettled' CHECK (status IN ('unsettled', 'settled')),
    settled_at TIMESTAMPTZ,
    settled_by_staff_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_bill_target CHECK (
        (table_session_id IS NOT NULL AND parcel_id IS NULL) OR
        (parcel_id IS NOT NULL AND table_session_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_settled_at ON public.bills(settled_at);
CREATE INDEX IF NOT EXISTS idx_bills_payment_method ON public.bills(payment_method);

-- 11. Bill Adjustments (Returns, Cancellations, Corrections)
CREATE TABLE IF NOT EXISTS public.bill_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
    adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('item_cancellation', 'quantity_reduction', 'return', 'post_settlement_adjustment')),
    quantity_adjusted INTEGER NOT NULL DEFAULT 0,
    amount_paise BIGINT NOT NULL, -- Negative or deduction value
    reason TEXT NOT NULL,
    authorized_by_staff_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_adjustments_bill ON public.bill_adjustments(bill_id);

-- 12. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    performed_by_staff_id TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- SECURITY & ROW LEVEL SECURITY (RLS)
-- =========================================================================

-- Helper function: get staff profile of current authenticated user
CREATE OR REPLACE FUNCTION public.get_current_staff()
RETURNS public.staff_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM public.staff_profiles 
    WHERE auth_user_id = auth.uid() AND is_active = true 
    LIMIT 1;
$$;

-- Helper function: check role
CREATE OR REPLACE FUNCTION public.is_staff_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles 
        WHERE auth_user_id = auth.uid() 
          AND is_active = true 
          AND role = required_role
    );
$$;

CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles 
        WHERE auth_user_id = auth.uid() 
          AND is_active = true
    );
$$;

-- Enable RLS on all tables
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Staff Profiles Policies
CREATE POLICY "Active staff can view staff profiles"
    ON public.staff_profiles FOR SELECT
    USING (public.is_active_staff());

CREATE POLICY "Admin can insert staff profiles"
    ON public.staff_profiles FOR INSERT
    WITH CHECK (public.is_staff_role('admin'));

CREATE POLICY "Admin can update staff profiles"
    ON public.staff_profiles FOR UPDATE
    USING (public.is_staff_role('admin'))
    WITH CHECK (public.is_staff_role('admin'));

-- 2. Menu Categories Policies
CREATE POLICY "Active staff can read menu categories"
    ON public.menu_categories FOR SELECT
    USING (public.is_active_staff());

CREATE POLICY "Admin can manage menu categories"
    ON public.menu_categories FOR ALL
    USING (public.is_staff_role('admin'))
    WITH CHECK (public.is_staff_role('admin'));

-- 3. Menu Items Policies
CREATE POLICY "Active staff can read menu items"
    ON public.menu_items FOR SELECT
    USING (public.is_active_staff());

CREATE POLICY "Admin can manage menu items"
    ON public.menu_items FOR ALL
    USING (public.is_staff_role('admin'))
    WITH CHECK (public.is_staff_role('admin'));

-- 4. Tables Policies
CREATE POLICY "Active staff can read tables"
    ON public.tables FOR SELECT
    USING (public.is_active_staff());

CREATE POLICY "Admin can manage tables"
    ON public.tables FOR ALL
    USING (public.is_staff_role('admin'))
    WITH CHECK (public.is_staff_role('admin'));

-- 5. Table Sessions Policies
CREATE POLICY "Active staff can read table sessions"
    ON public.table_sessions FOR SELECT
    USING (public.is_active_staff());

CREATE POLICY "Waiters and Admin can insert table sessions"
    ON public.table_sessions FOR INSERT
    WITH CHECK (public.is_staff_role('admin') OR public.is_staff_role('waiter'));

CREATE POLICY "Admin can update table sessions"
    ON public.table_sessions FOR UPDATE
    USING (public.is_staff_role('admin'))
    WITH CHECK (public.is_staff_role('admin'));

-- 6. Parcel Orders Policies
CREATE POLICY "Active staff can read parcel orders"
    ON public.parcel_orders FOR SELECT
    USING (public.is_active_staff());

CREATE POLICY "Admin can manage parcel orders"
    ON public.parcel_orders FOR ALL
    USING (public.is_staff_role('admin'))
    WITH CHECK (public.is_staff_role('admin'));

-- 7. Orders (Tickets) Policies
CREATE POLICY "Active staff can read orders"
    ON public.orders FOR SELECT
    USING (public.is_active_staff());

CREATE POLICY "Waiters and Admin can insert orders"
    ON public.orders FOR INSERT
    WITH CHECK (public.is_staff_role('admin') OR public.is_staff_role('waiter'));

CREATE POLICY "Chef and Admin can update order status"
    ON public.orders FOR UPDATE
    USING (public.is_staff_role('admin') OR public.is_staff_role('chef'))
    WITH CHECK (public.is_staff_role('admin') OR public.is_staff_role('chef'));

-- 8. Order Items Policies
CREATE POLICY "Active staff can read order items"
    ON public.order_items FOR SELECT
    USING (public.is_active_staff());

CREATE POLICY "Waiters and Admin can insert order items"
    ON public.order_items FOR INSERT
    WITH CHECK (public.is_staff_role('admin') OR public.is_staff_role('waiter'));

CREATE POLICY "Chef and Admin can update preparation status"
    ON public.order_items FOR UPDATE
    USING (public.is_staff_role('admin') OR public.is_staff_role('chef'))
    WITH CHECK (public.is_staff_role('admin') OR public.is_staff_role('chef'));

-- 9. Bills Policies
CREATE POLICY "Admin and Waiters can read bills"
    ON public.bills FOR SELECT
    USING (public.is_staff_role('admin') OR public.is_staff_role('waiter'));

CREATE POLICY "Waiters and Admin can insert bills"
    ON public.bills FOR INSERT
    WITH CHECK (public.is_staff_role('admin') OR public.is_staff_role('waiter'));

CREATE POLICY "Admin can update/settle bills"
    ON public.bills FOR UPDATE
    USING (public.is_staff_role('admin'))
    WITH CHECK (public.is_staff_role('admin'));

-- 10. Bill Adjustments Policies
CREATE POLICY "Admin can read and write bill adjustments"
    ON public.bill_adjustments FOR ALL
    USING (public.is_staff_role('admin'))
    WITH CHECK (public.is_staff_role('admin'));

-- 11. Audit Logs Policies
CREATE POLICY "Admin can read audit logs"
    ON public.audit_logs FOR SELECT
    USING (public.is_staff_role('admin'));

CREATE POLICY "Staff can insert audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (public.is_active_staff());

-- =========================================================================
-- ATOMIC BUSINESS LOGIC FUNCTIONS (POSTGRESQL RPCs)
-- =========================================================================

-- Function 1: Submit Order (Atomic table session lookup/creation, price snapshots, item creation)
CREATE OR REPLACE FUNCTION public.rpc_submit_order(
    p_order_type TEXT,
    p_table_id UUID DEFAULT NULL,
    p_parcel_customer_notes TEXT DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb, -- array of { menu_item_id: UUID, quantity: int }
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_staff public.staff_profiles;
    v_session_id UUID;
    v_parcel_id UUID;
    v_order_id UUID;
    v_ticket_number TEXT;
    v_parcel_code TEXT;
    v_item RECORD;
    v_menu_item RECORD;
    v_subtotal_paise BIGINT := 0;
    v_item_total_paise BIGINT := 0;
    v_item_count INTEGER := 0;
    v_bill_id UUID;
    v_existing_order UUID;
BEGIN
    -- 1. Validate Caller
    v_staff := public.get_current_staff();
    IF v_staff IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Active staff profile required';
    END IF;

    -- Waiters and Admin can place orders
    IF v_staff.role NOT IN ('admin', 'waiter') THEN
        RAISE EXCEPTION 'Permission denied: Role % cannot submit orders', v_staff.role;
    END IF;

    -- 2. Check Idempotency Key
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_order FROM public.orders WHERE idempotency_key = p_idempotency_key;
        IF v_existing_order IS NOT NULL THEN
            -- Already processed, return existing ticket
            RETURN jsonb_build_object(
                'status', 'success',
                'idempotent_replay', true,
                'order_id', v_existing_order
            );
        END IF;
    END IF;

    -- Validate items list
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order submission must contain at least one item';
    END IF;

    -- 3. Resolve Session or Parcel
    IF p_order_type = 'dine_in' THEN
        IF p_table_id IS NULL THEN
            RAISE EXCEPTION 'Table ID is required for dine-in orders';
        END IF;

        -- Validate Table exists & is active
        IF NOT EXISTS (SELECT 1 FROM public.tables WHERE id = p_table_id AND is_active = true) THEN
            RAISE EXCEPTION 'Specified table is inactive or does not exist';
        END IF;

        -- Concurrency-safe retrieval or creation of open session
        SELECT id INTO v_session_id 
        FROM public.table_sessions 
        WHERE table_id = p_table_id AND session_status = 'open'
        FOR UPDATE;

        IF v_session_id IS NULL THEN
            -- Open new session
            INSERT INTO public.table_sessions (table_id, session_status, created_by_staff_id)
            VALUES (p_table_id, 'open', v_staff.staff_id)
            RETURNING id INTO v_session_id;

            -- Initialize bill for this session
            INSERT INTO public.bills (bill_number, table_session_id, subtotal_paise, final_total_paise, status)
            VALUES ('BILL-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || substr(v_session_id::text, 1, 4), v_session_id, 0, 0, 'unsettled')
            RETURNING id INTO v_bill_id;
        ELSE
            SELECT id INTO v_bill_id FROM public.bills WHERE table_session_id = v_session_id;
        END IF;

    ELSIF p_order_type = 'parcel' THEN
        -- Only Admin can create parcel orders as per specification
        IF v_staff.role != 'admin' THEN
            RAISE EXCEPTION 'Permission denied: Only counter admin can create parcel orders';
        END IF;

        v_parcel_code := 'PCL-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((nextval('public.parcel_sequence')::text), 4, '0');
        
        INSERT INTO public.parcel_orders (parcel_code, customer_notes, status, created_by_staff_id)
        VALUES (v_parcel_code, p_parcel_customer_notes, 'open', v_staff.staff_id)
        RETURNING id INTO v_parcel_id;

        -- Initialize bill for parcel
        INSERT INTO public.bills (bill_number, parcel_id, subtotal_paise, final_total_paise, status)
        VALUES ('BILL-' || v_parcel_code, v_parcel_id, 0, 0, 'unsettled')
        RETURNING id INTO v_bill_id;

    ELSE
        RAISE EXCEPTION 'Invalid order_type: must be dine_in or parcel';
    END IF;

    -- 4. Create Order / Ticket
    v_ticket_number := 'TKT-' || to_char(now(), 'HH24MISS') || '-' || floor(random() * 900 + 100)::text;

    INSERT INTO public.orders (
        ticket_number,
        order_type,
        table_session_id,
        parcel_id,
        status,
        idempotency_key,
        created_by_staff_id
    )
    VALUES (
        v_ticket_number,
        p_order_type,
        v_session_id,
        v_parcel_id,
        'pending',
        p_idempotency_key,
        v_staff.staff_id
    )
    RETURNING id INTO v_order_id;

    -- 5. Insert line items with authoritative prices & snapshots
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(menu_item_id UUID, quantity INTEGER)
    LOOP
        IF v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Item quantity must be greater than zero';
        END IF;

        -- Lookup authoritative item details
        SELECT m.id, m.name, m.price_paise, m.is_available, m.is_archived, c.name AS category_name
        INTO v_menu_item
        FROM public.menu_items m
        JOIN public.menu_categories c ON c.id = m.category_id
        WHERE m.id = v_item.menu_item_id;

        IF v_menu_item.id IS NULL THEN
            RAISE EXCEPTION 'Menu item % not found', v_item.menu_item_id;
        END IF;

        IF NOT v_menu_item.is_available OR v_menu_item.is_archived THEN
            RAISE EXCEPTION 'Item "%" is currently unavailable or archived', v_menu_item.name;
        END IF;

        v_item_total_paise := v_menu_item.price_paise * v_item.quantity;
        v_subtotal_paise := v_subtotal_paise + v_item_total_paise;
        v_item_count := v_item_count + v_item.quantity;

        INSERT INTO public.order_items (
            order_id,
            table_session_id,
            parcel_id,
            menu_item_id,
            dish_name,
            category_name,
            unit_price_paise,
            ordered_quantity,
            prepared_quantity,
            cancelled_quantity,
            status
        )
        VALUES (
            v_order_id,
            v_session_id,
            v_parcel_id,
            v_menu_item.id,
            v_menu_item.name,
            v_menu_item.category_name,
            v_menu_item.price_paise,
            v_item.quantity,
            0,
            0,
            'pending'
        );
    END LOOP;

    -- 6. Recalculate bill running totals
    UPDATE public.bills
    SET subtotal_paise = (
        SELECT COALESCE(SUM((ordered_quantity - cancelled_quantity) * unit_price_paise), 0)
        FROM public.order_items
        WHERE (table_session_id = v_session_id OR parcel_id = v_parcel_id)
    ),
    final_total_paise = GREATEST(0, (
        SELECT COALESCE(SUM((ordered_quantity - cancelled_quantity) * unit_price_paise), 0)
        FROM public.order_items
        WHERE (table_session_id = v_session_id OR parcel_id = v_parcel_id)
    ) + adjustments_paise)
    WHERE id = v_bill_id;

    -- 7. Audit Log
    INSERT INTO public.audit_logs (action, entity_type, entity_id, performed_by_staff_id, details)
    VALUES (
        'SUBMIT_ORDER',
        'orders',
        v_order_id::text,
        v_staff.staff_id,
        jsonb_build_object(
            'order_type', p_order_type,
            'table_session_id', v_session_id,
            'parcel_id', v_parcel_id,
            'ticket_number', v_ticket_number,
            'items_count', v_item_count,
            'order_subtotal_paise', v_subtotal_paise
        )
    );

    RETURN jsonb_build_object(
        'status', 'success',
        'order_id', v_order_id,
        'ticket_number', v_ticket_number,
        'table_session_id', v_session_id,
        'parcel_id', v_parcel_id,
        'parcel_code', v_parcel_code,
        'bill_id', v_bill_id
    );
END;
$$;

-- Create sequence for parcel codes if not exists
CREATE SEQUENCE IF NOT EXISTS public.parcel_sequence START 1001;

-- Function 2: Mark Preparation Group Ready
-- Handles grouping of the same dish within the same table session or parcel
CREATE OR REPLACE FUNCTION public.rpc_mark_prep_group_ready(
    p_table_session_id UUID DEFAULT NULL,
    p_parcel_id UUID DEFAULT NULL,
    p_menu_item_id UUID DEFAULT NULL,
    p_quantity_to_ready INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_staff public.staff_profiles;
    v_remaining INTEGER := p_quantity_to_ready;
    v_item RECORD;
    v_can_ready INTEGER;
    v_order_id UUID;
    v_all_items_ready BOOLEAN;
BEGIN
    v_staff := public.get_current_staff();
    IF v_staff IS NULL OR v_staff.role NOT IN ('chef', 'admin') THEN
        RAISE EXCEPTION 'Permission denied: Only chef or admin can mark food ready';
    END IF;

    IF p_quantity_to_ready <= 0 THEN
        RAISE EXCEPTION 'Quantity to ready must be greater than zero';
    END IF;

    IF p_table_session_id IS NULL AND p_parcel_id IS NULL THEN
        RAISE EXCEPTION 'Either table_session_id or parcel_id must be provided';
    END IF;

    -- Loop through pending order_items for this dish and session/parcel, ordered by order time
    FOR v_item IN 
        SELECT id, order_id, ordered_quantity, prepared_quantity, cancelled_quantity
        FROM public.order_items
        WHERE menu_item_id = p_menu_item_id
          AND ((p_table_session_id IS NOT NULL AND table_session_id = p_table_session_id) OR
               (p_parcel_id IS NOT NULL AND parcel_id = p_parcel_id))
          AND (prepared_quantity + cancelled_quantity < ordered_quantity)
        ORDER BY created_at ASC
        FOR UPDATE
    LOOP
        EXIT WHEN v_remaining <= 0;

        v_can_ready := LEAST(v_remaining, (v_item.ordered_quantity - v_item.prepared_quantity - v_item.cancelled_quantity));

        IF v_can_ready > 0 THEN
            UPDATE public.order_items
            SET prepared_quantity = prepared_quantity + v_can_ready,
                status = CASE 
                    WHEN (prepared_quantity + v_can_ready + cancelled_quantity) >= ordered_quantity THEN 'ready' 
                    ELSE 'pending' 
                END
            WHERE id = v_item.id;

            v_remaining := v_remaining - v_can_ready;

            -- Check if parent ticket is ready
            SELECT NOT EXISTS (
                SELECT 1 FROM public.order_items
                WHERE order_id = v_item.order_id
                  AND status != 'ready' AND status != 'cancelled'
            ) INTO v_all_items_ready;

            IF v_all_items_ready THEN
                UPDATE public.orders SET status = 'ready' WHERE id = v_item.order_id;
            ELSE
                UPDATE public.orders SET status = 'partial_ready' WHERE id = v_item.order_id;
            END IF;
        END IF;
    END LOOP;

    -- Audit Log
    INSERT INTO public.audit_logs (action, entity_type, entity_id, performed_by_staff_id, details)
    VALUES (
        'MARK_PREP_READY',
        'order_items',
        p_menu_item_id::text,
        v_staff.staff_id,
        jsonb_build_object(
            'table_session_id', p_table_session_id,
            'parcel_id', p_parcel_id,
            'quantity_marked_ready', (p_quantity_to_ready - v_remaining)
        )
    );

    RETURN jsonb_build_object(
        'status', 'success',
        'quantity_marked_ready', (p_quantity_to_ready - v_remaining)
    );
END;
$$;

-- Function 3: Admin Adjustment (Cancellation, Reduction, Return)
CREATE OR REPLACE FUNCTION public.rpc_adjust_order_item(
    p_order_item_id UUID,
    p_adjustment_type TEXT, -- 'item_cancellation', 'quantity_reduction', 'return'
    p_quantity_to_adjust INTEGER,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_staff public.staff_profiles;
    v_item RECORD;
    v_bill RECORD;
    v_deduction_paise BIGINT;
    v_adjustment_id UUID;
BEGIN
    v_staff := public.get_current_staff();
    IF v_staff IS NULL OR v_staff.role != 'admin' THEN
        RAISE EXCEPTION 'Permission denied: Only admin can perform item adjustments';
    END IF;

    SELECT * INTO v_item FROM public.order_items WHERE id = p_order_item_id FOR UPDATE;
    IF v_item.id IS NULL THEN
        RAISE EXCEPTION 'Order item not found';
    END IF;

    -- Locate corresponding bill
    IF v_item.table_session_id IS NOT NULL THEN
        SELECT * INTO v_bill FROM public.bills WHERE table_session_id = v_item.table_session_id FOR UPDATE;
    ELSE
        SELECT * INTO v_bill FROM public.bills WHERE parcel_id = v_item.parcel_id FOR UPDATE;
    END IF;

    IF v_bill.id IS NULL THEN
        RAISE EXCEPTION 'Associated bill not found';
    END IF;

    IF v_bill.status = 'settled' AND p_adjustment_type != 'post_settlement_adjustment' THEN
        RAISE EXCEPTION 'Bill is already settled. Post-settlement adjustments must be recorded explicitly.';
    END IF;

    -- Scenario A: Unprepared cancellation or reduction
    -- Reduces pending preparation from kitchen queue
    IF p_adjustment_type IN ('item_cancellation', 'quantity_reduction') THEN
        IF p_quantity_to_adjust > (v_item.ordered_quantity - v_item.cancelled_quantity) THEN
            RAISE EXCEPTION 'Cannot cancel more quantity than active ordered quantity';
        END IF;

        UPDATE public.order_items
        SET cancelled_quantity = cancelled_quantity + p_quantity_to_adjust,
            status = CASE 
                WHEN (cancelled_quantity + p_quantity_to_adjust) = ordered_quantity THEN 'cancelled'
                WHEN (prepared_quantity + cancelled_quantity + p_quantity_to_adjust) >= ordered_quantity THEN 'ready'
                ELSE status
            END
        WHERE id = v_item.id;

        v_deduction_paise := -(v_item.unit_price_paise * p_quantity_to_adjust);

    -- Scenario B: Prepared item return / customer return
    -- Kitchen preparation history preserved!
    ELSIF p_adjustment_type = 'return' THEN
        IF p_quantity_to_adjust > v_item.prepared_quantity THEN
            RAISE EXCEPTION 'Cannot return more quantity than has been prepared';
        END IF;

        v_deduction_paise := -(v_item.unit_price_paise * p_quantity_to_adjust);

    ELSE
        RAISE EXCEPTION 'Invalid adjustment type: %', p_adjustment_type;
    END IF;

    -- Insert Adjustment Record
    INSERT INTO public.bill_adjustments (
        bill_id,
        order_item_id,
        adjustment_type,
        quantity_adjusted,
        amount_paise,
        reason,
        authorized_by_staff_id
    )
    VALUES (
        v_bill.id,
        v_item.id,
        p_adjustment_type,
        p_quantity_to_adjust,
        v_deduction_paise,
        p_reason,
        v_staff.staff_id
    )
    RETURNING id INTO v_adjustment_id;

    -- Recalculate bill
    UPDATE public.bills
    SET subtotal_paise = (
        SELECT COALESCE(SUM((ordered_quantity - cancelled_quantity) * unit_price_paise), 0)
        FROM public.order_items
        WHERE (table_session_id = v_item.table_session_id OR parcel_id = v_item.parcel_id)
    ),
    adjustments_paise = (
        SELECT COALESCE(SUM(amount_paise), 0)
        FROM public.bill_adjustments
        WHERE bill_id = v_bill.id AND adjustment_type != 'item_cancellation' AND adjustment_type != 'quantity_reduction'
    ),
    final_total_paise = GREATEST(0, (
        SELECT COALESCE(SUM((ordered_quantity - cancelled_quantity) * unit_price_paise), 0)
        FROM public.order_items
        WHERE (table_session_id = v_item.table_session_id OR parcel_id = v_item.parcel_id)
    ) + (
        SELECT COALESCE(SUM(amount_paise), 0)
        FROM public.bill_adjustments
        WHERE bill_id = v_bill.id AND adjustment_type != 'item_cancellation' AND adjustment_type != 'quantity_reduction'
    ))
    WHERE id = v_bill.id;

    -- Audit Log
    INSERT INTO public.audit_logs (action, entity_type, entity_id, performed_by_staff_id, details)
    VALUES (
        'ADJUST_ORDER_ITEM',
        'bill_adjustments',
        v_adjustment_id::text,
        v_staff.staff_id,
        jsonb_build_object(
            'order_item_id', p_order_item_id,
            'adjustment_type', p_adjustment_type,
            'quantity', p_quantity_to_adjust,
            'amount_paise', v_deduction_paise,
            'reason', p_reason
        )
    );

    RETURN jsonb_build_object(
        'status', 'success',
        'adjustment_id', v_adjustment_id,
        'deduction_paise', v_deduction_paise
    );
END;
$$;

-- Function 4: Settle Bill (Atomic settlement with concurrency lock & idempotency)
CREATE OR REPLACE FUNCTION public.rpc_settle_bill(
    p_bill_id UUID,
    p_payment_method TEXT, -- 'cash', 'online'
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_staff public.staff_profiles;
    v_bill RECORD;
    v_calculated_subtotal BIGINT;
    v_calculated_adjustments BIGINT;
    v_final_amount BIGINT;
BEGIN
    v_staff := public.get_current_staff();
    IF v_staff IS NULL OR v_staff.role != 'admin' THEN
        RAISE EXCEPTION 'Permission denied: Only admin can settle bills and record payments';
    END IF;

    IF p_payment_method NOT IN ('cash', 'online') THEN
        RAISE EXCEPTION 'Invalid payment method: must be cash or online';
    END IF;

    -- Lock bill row for update to prevent concurrent double-settlement
    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id FOR UPDATE;
    IF v_bill.id IS NULL THEN
        RAISE EXCEPTION 'Bill % not found', p_bill_id;
    END IF;

    -- Check if already settled
    IF v_bill.status = 'settled' THEN
        RETURN jsonb_build_object(
            'status', 'already_settled',
            'bill_id', v_bill.id,
            'settled_at', v_bill.settled_at,
            'final_total_paise', v_bill.final_total_paise,
            'payment_method', v_bill.payment_method
        );
    END IF;

    -- Compute authoritative final total
    SELECT COALESCE(SUM((ordered_quantity - cancelled_quantity) * unit_price_paise), 0)
    INTO v_calculated_subtotal
    FROM public.order_items
    WHERE (table_session_id = v_bill.table_session_id OR parcel_id = v_bill.parcel_id);

    SELECT COALESCE(SUM(amount_paise), 0)
    INTO v_calculated_adjustments
    FROM public.bill_adjustments
    WHERE bill_id = v_bill.id AND adjustment_type != 'item_cancellation' AND adjustment_type != 'quantity_reduction';

    v_final_amount := GREATEST(0, v_calculated_subtotal + v_calculated_adjustments);

    -- Settle Bill
    UPDATE public.bills
    SET status = 'settled',
        subtotal_paise = v_calculated_subtotal,
        adjustments_paise = v_calculated_adjustments,
        final_total_paise = v_final_amount,
        payment_method = p_payment_method,
        settled_at = now(),
        settled_by_staff_id = v_staff.staff_id
    WHERE id = v_bill.id;

    -- Settle parent session or parcel
    IF v_bill.table_session_id IS NOT NULL THEN
        UPDATE public.table_sessions
        SET session_status = 'settled',
            settled_at = now()
        WHERE id = v_bill.table_session_id;
    ELSIF v_bill.parcel_id IS NOT NULL THEN
        UPDATE public.parcel_orders
        SET status = 'settled',
            settled_at = now()
        WHERE id = v_bill.parcel_id;
    END IF;

    -- Audit Log
    INSERT INTO public.audit_logs (action, entity_type, entity_id, performed_by_staff_id, details)
    VALUES (
        'SETTLE_BILL',
        'bills',
        v_bill.id::text,
        v_staff.staff_id,
        jsonb_build_object(
            'final_total_paise', v_final_amount,
            'payment_method', p_payment_method,
            'table_session_id', v_bill.table_session_id,
            'parcel_id', v_bill.parcel_id
        )
    );

    RETURN jsonb_build_object(
        'status', 'success',
        'bill_id', v_bill.id,
        'final_total_paise', v_final_amount,
        'payment_method', p_payment_method,
        'settled_at', now()
    );
END;
$$;

-- Enable Realtime for live order tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parcel_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bills;
