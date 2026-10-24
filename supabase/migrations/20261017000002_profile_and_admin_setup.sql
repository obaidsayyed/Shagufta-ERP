-- Migration: 20261017000002_profile_and_admin_setup.sql
-- Description: Self profile update RPC and Admin123 provisioning helper

-- 1. Allow any authenticated active staff member to rename their display_name or username
CREATE OR REPLACE FUNCTION public.rpc_update_self_profile(
    p_display_name TEXT,
    p_staff_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_profile public.staff_profiles;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if another staff already uses this staff_id
    IF EXISTS (
        SELECT 1 FROM public.staff_profiles 
        WHERE staff_id = trim(p_staff_id) AND auth_user_id != v_user_id
    ) THEN
        RAISE EXCEPTION 'Username/Staff ID "%" is already taken by another user', trim(p_staff_id);
    END IF;

    UPDATE public.staff_profiles
    SET display_name = COALESCE(NULLIF(trim(p_display_name), ''), display_name),
        staff_id = COALESCE(NULLIF(trim(p_staff_id), ''), staff_id)
    WHERE auth_user_id = v_user_id AND is_active = true
    RETURNING * INTO v_profile;

    IF v_profile.id IS NULL THEN
        RAISE EXCEPTION 'Active staff profile not found';
    END IF;

    RETURN jsonb_build_object(
        'status', 'success',
        'display_name', v_profile.display_name,
        'staff_id', v_profile.staff_id
    );
END;
$$;

-- 2. Robust Admin123 provisioning & repair script for Supabase GoTrue
-- Fixes GoTrue 500 error ("sql: Scan error on column confirmation_token: converting NULL to string is unsupported")
CREATE OR REPLACE FUNCTION public.provision_admin123()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_email TEXT := 'hotelshaguftaaalishan@gmail.com';
    v_encrypted_pw TEXT := extensions.crypt('Admin@123', extensions.gen_salt('bf'));
    v_profile_id UUID;
BEGIN
    -- Check if user already exists in auth.users
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change,
            phone_change,
            phone_change_token,
            email_change_token_current,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            created_at,
            updated_at
        )
        VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated',
            'authenticated',
            v_email,
            v_encrypted_pw,
            now(),
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"display_name":"Administrator","staff_id":"Admin123","role":"admin"}'::jsonb,
            false,
            now(),
            now()
        );
    ELSE
        -- Repair existing user row so GoTrue string scan doesn't encounter NULL
        UPDATE auth.users 
        SET encrypted_password = v_encrypted_pw,
            confirmation_token = COALESCE(confirmation_token, ''),
            recovery_token = COALESCE(recovery_token, ''),
            email_change_token_new = COALESCE(email_change_token_new, ''),
            email_change = COALESCE(email_change, ''),
            phone_change = COALESCE(phone_change, ''),
            phone_change_token = COALESCE(phone_change_token, ''),
            email_change_token_current = COALESCE(email_change_token_current, ''),
            updated_at = now()
        WHERE id = v_user_id;
    END IF;

    -- Ensure auth.identities has the email provider identity
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email') THEN
            INSERT INTO auth.identities (
                id,
                user_id,
                identity_data,
                provider,
                provider_id,
                last_sign_in_at,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid(),
                v_user_id,
                jsonb_build_object('sub', v_user_id::text, 'email', v_email),
                'email',
                v_email,
                now(),
                now(),
                now()
            );
        END IF;
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;

    -- Upsert in public.staff_profiles
    INSERT INTO public.staff_profiles (
        auth_user_id,
        staff_id,
        display_name,
        role,
        is_active
    )
    VALUES (
        v_user_id,
        'Admin123',
        'Administrator',
        'admin',
        true
    )
    ON CONFLICT (auth_user_id) DO UPDATE
    SET staff_id = 'Admin123',
        display_name = 'Administrator',
        role = 'admin',
        is_active = true
    RETURNING id INTO v_profile_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Admin123 provisioned in Supabase Auth & staff_profiles',
        'staff_id', 'Admin123',
        'email', v_email,
        'profile_id', v_profile_id
    );
END;
$$;

-- 3. Execute immediately upon running this script
SELECT public.provision_admin123();

