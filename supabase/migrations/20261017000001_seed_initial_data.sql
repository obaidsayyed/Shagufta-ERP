-- Migration: 20261017000001_seed_initial_data.sql
-- Description: Starter Menu Categories, Dishes, Tables & Initial Admin Provisioning Helper

-- 1. Insert Initial Tables (T1 to T12)
INSERT INTO public.tables (table_number, is_active)
VALUES 
    ('T1', true),
    ('T2', true),
    ('T3', true),
    ('T4', true),
    ('T5', true),
    ('T6', true),
    ('T7', true),
    ('T8', true),
    ('T9', true),
    ('T10', true),
    ('T11', true),
    ('T12', true)
ON CONFLICT (table_number) DO NOTHING;

-- 2. Insert Default Menu Categories
INSERT INTO public.menu_categories (id, name, display_order, is_active)
VALUES 
    ('c0000000-0000-0000-0000-000000000001', 'Breads', 1, true),
    ('c0000000-0000-0000-0000-000000000002', 'Rice', 2, true),
    ('c0000000-0000-0000-0000-000000000003', 'Starters', 3, true),
    ('c0000000-0000-0000-0000-000000000004', 'Main courses', 4, true),
    ('c0000000-0000-0000-0000-000000000005', 'Beverages', 5, true),
    ('c0000000-0000-0000-0000-000000000006', 'Desserts', 6, true),
    ('c0000000-0000-0000-0000-000000000007', 'Accompaniments', 7, true)
ON CONFLICT (name) DO NOTHING;

-- 3. Insert Starter Menu Dishes (Prices stored in integer paise: ₹1 = 100 paise)
INSERT INTO public.menu_items (id, category_id, name, price_paise, is_available, is_archived)
VALUES
    -- Breads
    ('m0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Tandoori Roti', 2000, true, false),
    ('m0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Butter Roti', 2500, true, false),
    ('m0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'Butter Naan', 4500, true, false),
    ('m0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'Garlic Naan', 6000, true, false),
    
    -- Rice
    ('m0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 'Steamed Basmati Rice', 11000, true, false),
    ('m0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', 'Jeera Rice', 14000, true, false),
    ('m0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000002', 'Veg Biryani', 22000, true, false),
    
    -- Starters
    ('m0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000003', 'Paneer Tikka', 24000, true, false),
    ('m0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000003', 'Veg Crispy', 18000, true, false),
    ('m0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000003', 'Hara Bhara Kabab', 19000, true, false),
    
    -- Main courses
    ('m0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000004', 'Dal Tadka', 16000, true, false),
    ('m0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000004', 'Dal Makhani', 21000, true, false),
    ('m0000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000004', 'Paneer Butter Masala', 25000, true, false),
    ('m0000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000004', 'Kadhai Paneer', 26000, true, false),
    ('m0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000004', 'Mix Veg Curry', 19000, true, false),
    
    -- Beverages
    ('m0000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000005', 'Sweet Lassi', 8000, true, false),
    ('m0000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-000000000005', 'Fresh Lime Soda', 6000, true, false),
    ('m0000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-000000000005', 'Masala Buttermilk', 4000, true, false),
    
    -- Desserts
    ('m0000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000006', 'Gulab Jamun (2 pcs)', 8000, true, false),
    ('m0000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000006', 'Rasmalai (2 pcs)', 10000, true, false),
    
    -- Accompaniments
    ('m0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000007', 'Roasted Papad', 2500, true, false),
    ('m0000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000007', 'Masala Papad', 4500, true, false),
    ('m0000000-0000-0000-0000-000000000023', 'c0000000-0000-0000-0000-000000000007', 'Boondi Raita', 7500, true, false)
ON CONFLICT (id) DO NOTHING;

-- 4. Secure Helper Function to link newly signed up Admin user to Staff Profile
-- Can be called once during initial setup or via Supabase dashboard / auth hook
CREATE OR REPLACE FUNCTION public.provision_initial_admin(
    p_auth_email TEXT,
    p_display_name TEXT,
    p_staff_id TEXT DEFAULT 'ADM-001'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_profile_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_auth_email;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Auth user with email % does not exist in auth.users. Please create user in Supabase Auth first.', p_auth_email;
    END IF;

    -- Upsert staff profile
    INSERT INTO public.staff_profiles (auth_user_id, staff_id, display_name, role, is_active)
    VALUES (v_user_id, p_staff_id, p_display_name, 'admin', true)
    ON CONFLICT (auth_user_id) DO UPDATE
    SET role = 'admin', is_active = true, display_name = p_display_name
    RETURNING id INTO v_profile_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Initial admin provisioned successfully',
        'staff_profile_id', v_profile_id,
        'staff_id', p_staff_id
    );
END;
$$;
