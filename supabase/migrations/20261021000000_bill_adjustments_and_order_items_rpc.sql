-- Migration: 20261021000000_bill_adjustments_and_order_items_rpc.sql
-- Description: Direct bill line-item adjustments (+, -, delete, add dish) for unsettled bills with atomic recalculation

-- 1. Ensure Admin has DELETE permission on order_items if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'Admin can delete order items'
  ) THEN
    CREATE POLICY "Admin can delete order items"
      ON public.order_items FOR DELETE
      USING (public.is_staff_role('admin'));
  END IF;
END $$;

-- 2. Atomic RPC: Direct Bill Item Adjustment (increase, decrease, delete)
CREATE OR REPLACE FUNCTION public.rpc_adjust_bill_item(
    p_bill_id UUID,
    p_order_item_id UUID,
    p_action TEXT -- 'increase', 'decrease', 'delete'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_staff public.staff_profiles;
    v_bill RECORD;
    v_item RECORD;
    v_active_qty INTEGER;
    v_new_subtotal BIGINT;
    v_adjustments BIGINT;
    v_final_total BIGINT;
BEGIN
    -- Verify admin role
    v_staff := public.get_current_staff();
    IF v_staff IS NULL OR v_staff.role != 'admin' THEN
        RAISE EXCEPTION 'Permission denied: Only admin can adjust bill line items';
    END IF;

    -- Lookup bill and lock for update
    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id FOR UPDATE;
    IF v_bill.id IS NULL THEN
        RAISE EXCEPTION 'Bill % not found', p_bill_id;
    END IF;

    IF v_bill.status = 'settled' THEN
        RAISE EXCEPTION 'Bill is already settled and locked from modifications';
    END IF;

    -- Lookup order_item and lock for update
    SELECT * INTO v_item FROM public.order_items WHERE id = p_order_item_id FOR UPDATE;
    IF v_item.id IS NULL THEN
        RAISE EXCEPTION 'Order item % not found', p_order_item_id;
    END IF;

    IF p_action = 'increase' THEN
        UPDATE public.order_items
        SET ordered_quantity = ordered_quantity + 1,
            cancelled_quantity = 0,
            status = CASE WHEN status = 'cancelled' THEN 'ready' ELSE status END
        WHERE id = v_item.id;

    ELSIF p_action = 'decrease' THEN
        v_active_qty := v_item.ordered_quantity - v_item.cancelled_quantity;
        IF v_active_qty <= 1 THEN
            DELETE FROM public.order_items WHERE id = v_item.id;
        ELSE
            UPDATE public.order_items
            SET ordered_quantity = v_active_qty - 1,
                cancelled_quantity = 0,
                prepared_quantity = LEAST(prepared_quantity, v_active_qty - 1)
            WHERE id = v_item.id;
        END IF;

    ELSIF p_action = 'delete' THEN
        DELETE FROM public.order_items WHERE id = v_item.id;

    ELSE
        RAISE EXCEPTION 'Invalid action "%": must be increase, decrease, or delete', p_action;
    END IF;

    -- Recalculate bill running totals
    SELECT COALESCE(SUM((ordered_quantity - cancelled_quantity) * unit_price_paise), 0)
    INTO v_new_subtotal
    FROM public.order_items
    WHERE (table_session_id = v_bill.table_session_id OR parcel_id = v_bill.parcel_id);

    SELECT COALESCE(SUM(amount_paise), 0)
    INTO v_adjustments
    FROM public.bill_adjustments
    WHERE bill_id = v_bill.id 
      AND adjustment_type != 'item_cancellation' 
      AND adjustment_type != 'quantity_reduction';

    v_final_total := GREATEST(0, v_new_subtotal + v_adjustments);

    UPDATE public.bills
    SET subtotal_paise = v_new_subtotal,
        adjustments_paise = v_adjustments,
        final_total_paise = v_final_total
    WHERE id = v_bill.id;

    -- Audit log
    INSERT INTO public.audit_logs (action, entity_type, entity_id, performed_by_staff_id, details)
    VALUES (
        'ADJUST_BILL_ITEM',
        'bills',
        v_bill.id::text,
        v_staff.staff_id,
        jsonb_build_object(
            'order_item_id', p_order_item_id,
            'action', p_action,
            'new_subtotal_paise', v_new_subtotal,
            'new_final_total_paise', v_final_total
        )
    );

    RETURN jsonb_build_object(
        'status', 'success',
        'bill_id', v_bill.id,
        'action', p_action,
        'subtotal_paise', v_new_subtotal,
        'final_total_paise', v_final_total
    );
END;
$$;

-- 3. Atomic RPC: Add Dish directly to an unsettled Bill
CREATE OR REPLACE FUNCTION public.rpc_add_dish_to_bill(
    p_bill_id UUID,
    p_menu_item_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_staff public.staff_profiles;
    v_bill RECORD;
    v_menu_item RECORD;
    v_existing_item RECORD;
    v_order_id UUID;
    v_new_subtotal BIGINT;
    v_adjustments BIGINT;
    v_final_total BIGINT;
BEGIN
    -- Verify admin role
    v_staff := public.get_current_staff();
    IF v_staff IS NULL OR v_staff.role != 'admin' THEN
        RAISE EXCEPTION 'Permission denied: Only admin can add dishes to bill';
    END IF;

    -- Lookup bill and lock for update
    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id FOR UPDATE;
    IF v_bill.id IS NULL THEN
        RAISE EXCEPTION 'Bill % not found', p_bill_id;
    END IF;

    IF v_bill.status = 'settled' THEN
        RAISE EXCEPTION 'Bill is already settled and locked from modifications';
    END IF;

    -- Lookup menu item
    SELECT m.id, m.name, m.price_paise, m.is_available, m.is_archived, c.name AS category_name
    INTO v_menu_item
    FROM public.menu_items m
    JOIN public.menu_categories c ON c.id = m.category_id
    WHERE m.id = p_menu_item_id;

    IF v_menu_item.id IS NULL THEN
        RAISE EXCEPTION 'Menu item % not found', p_menu_item_id;
    END IF;

    -- Check if item already exists on this bill
    SELECT * INTO v_existing_item
    FROM public.order_items
    WHERE menu_item_id = p_menu_item_id
      AND ((v_bill.table_session_id IS NOT NULL AND table_session_id = v_bill.table_session_id) OR
           (v_bill.parcel_id IS NOT NULL AND parcel_id = v_bill.parcel_id))
    LIMIT 1
    FOR UPDATE;

    IF v_existing_item.id IS NOT NULL THEN
        -- Increment quantity on existing line
        UPDATE public.order_items
        SET ordered_quantity = (ordered_quantity - cancelled_quantity) + 1,
            cancelled_quantity = 0,
            status = CASE WHEN status = 'cancelled' THEN 'ready' ELSE status END
        WHERE id = v_existing_item.id;
    ELSE
        -- Find or create parent order ticket
        SELECT id INTO v_order_id
        FROM public.orders
        WHERE (v_bill.table_session_id IS NOT NULL AND table_session_id = v_bill.table_session_id) OR
              (v_bill.parcel_id IS NOT NULL AND parcel_id = v_bill.parcel_id)
        ORDER BY created_at ASC
        LIMIT 1;

        IF v_order_id IS NULL THEN
            INSERT INTO public.orders (
                ticket_number,
                order_type,
                table_session_id,
                parcel_id,
                status,
                created_by_staff_id
            )
            VALUES (
                'TKT-' || to_char(now(), 'HH24MISS') || '-' || floor(random() * 900 + 100)::text,
                CASE WHEN v_bill.table_session_id IS NOT NULL THEN 'dine_in' ELSE 'parcel' END,
                v_bill.table_session_id,
                v_bill.parcel_id,
                'ready',
                v_staff.staff_id
            )
            RETURNING id INTO v_order_id;
        END IF;

        -- Insert line item
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
            v_bill.table_session_id,
            v_bill.parcel_id,
            v_menu_item.id,
            v_menu_item.name,
            v_menu_item.category_name,
            v_menu_item.price_paise,
            1,
            1,
            0,
            'ready'
        );
    END IF;

    -- Recalculate bill running totals
    SELECT COALESCE(SUM((ordered_quantity - cancelled_quantity) * unit_price_paise), 0)
    INTO v_new_subtotal
    FROM public.order_items
    WHERE (table_session_id = v_bill.table_session_id OR parcel_id = v_bill.parcel_id);

    SELECT COALESCE(SUM(amount_paise), 0)
    INTO v_adjustments
    FROM public.bill_adjustments
    WHERE bill_id = v_bill.id 
      AND adjustment_type != 'item_cancellation' 
      AND adjustment_type != 'quantity_reduction';

    v_final_total := GREATEST(0, v_new_subtotal + v_adjustments);

    UPDATE public.bills
    SET subtotal_paise = v_new_subtotal,
        adjustments_paise = v_adjustments,
        final_total_paise = v_final_total
    WHERE id = v_bill.id;

    -- Audit log
    INSERT INTO public.audit_logs (action, entity_type, entity_id, performed_by_staff_id, details)
    VALUES (
        'ADD_DISH_TO_BILL',
        'bills',
        v_bill.id::text,
        v_staff.staff_id,
        jsonb_build_object(
            'menu_item_id', p_menu_item_id,
            'dish_name', v_menu_item.name,
            'price_paise', v_menu_item.price_paise,
            'new_subtotal_paise', v_new_subtotal,
            'new_final_total_paise', v_final_total
        )
    );

    RETURN jsonb_build_object(
        'status', 'success',
        'bill_id', v_bill.id,
        'dish_name', v_menu_item.name,
        'subtotal_paise', v_new_subtotal,
        'final_total_paise', v_final_total
    );
END;
$$;
