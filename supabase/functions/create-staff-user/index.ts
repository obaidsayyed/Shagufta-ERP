// Supabase Edge Function: create-staff-user
// Privileged administrative staff user provisioning using Supabase Auth Admin API
// Requires caller to be an active admin

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration missing required environment keys" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Verify caller authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Client with caller's JWT to verify caller's identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client with service_role key to check role & create users
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller has 'admin' role in public.staff_profiles
    const { data: callerProfile, error: profileError } = await adminClient
      .from("staff_profiles")
      .select("role, is_active, staff_id")
      .eq("auth_user_id", user.id)
      .single();

    if (profileError || !callerProfile || !callerProfile.is_active || callerProfile.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only active administrators can create staff accounts" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Parse payload
    const body = await req.json();
    const { email, password, display_name, role, staff_id } = body;

    if (!email || !password || !display_name || !role || !staff_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, password, display_name, role, staff_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["admin", "waiter", "chef"].includes(role)) {
      return new Response(
        JSON.stringify({ error: "Invalid role: must be admin, waiter, or chef" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check staff_id uniqueness
    const { data: existingStaff } = await adminClient
      .from("staff_profiles")
      .select("id")
      .eq("staff_id", staff_id)
      .maybeSingle();

    if (existingStaff) {
      return new Response(
        JSON.stringify({ error: `Staff ID "${staff_id}" is already assigned to an existing staff member` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Create Auth User using Admin API
    const { data: newAuthUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name,
        staff_id,
        role,
      },
    });

    if (createError || !newAuthUser.user) {
      return new Response(
        JSON.stringify({ error: createError?.message || "Failed to create user account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Create linked staff profile
    const { data: newProfile, error: insertError } = await adminClient
      .from("staff_profiles")
      .insert({
        auth_user_id: newAuthUser.user.id,
        staff_id,
        display_name,
        role,
        is_active: true,
        created_by_staff_id: callerProfile.staff_id,
      })
      .select()
      .single();

    if (insertError) {
      // Rollback auth user creation if profile creation fails
      await adminClient.auth.admin.deleteUser(newAuthUser.user.id);
      return new Response(
        JSON.stringify({ error: `Profile creation failed: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Return sanitized result
    return new Response(
      JSON.stringify({
        status: "success",
        message: `Staff member ${display_name} (${staff_id}) created successfully`,
        staff: {
          id: newProfile.id,
          staff_id: newProfile.staff_id,
          display_name: newProfile.display_name,
          role: newProfile.role,
          is_active: newProfile.is_active,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
