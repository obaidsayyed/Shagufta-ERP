// Supabase Edge Function: toggle-staff-status
// Privileged administrative toggle to enable or disable staff accounts
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

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller has 'admin' role
    const { data: callerProfile, error: profileError } = await adminClient
      .from("staff_profiles")
      .select("role, is_active, staff_id")
      .eq("auth_user_id", user.id)
      .single();

    if (profileError || !callerProfile || !callerProfile.is_active || callerProfile.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only active administrators can modify staff status" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { staff_profile_id, is_active } = body;

    if (!staff_profile_id || typeof is_active !== "boolean") {
      return new Response(
        JSON.stringify({ error: "Missing required fields: staff_profile_id, is_active (boolean)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Lookup target staff
    const { data: targetProfile, error: targetError } = await adminClient
      .from("staff_profiles")
      .select("*")
      .eq("id", staff_profile_id)
      .single();

    if (targetError || !targetProfile) {
      return new Response(
        JSON.stringify({ error: "Target staff profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent admin from disabling themselves
    if (targetProfile.auth_user_id === user.id) {
      return new Response(
        JSON.stringify({ error: "Action rejected: You cannot disable your own administrator account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update staff profile
    const { error: updateError } = await adminClient
      .from("staff_profiles")
      .update({ is_active })
      .eq("id", staff_profile_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `Update failed: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log administrative action
    await adminClient.from("audit_logs").insert({
      action: is_active ? "ENABLE_STAFF" : "DISABLE_STAFF",
      entity_type: "staff_profiles",
      entity_id: staff_profile_id,
      performed_by_staff_id: callerProfile.staff_id,
      details: {
        target_staff_id: targetProfile.staff_id,
        target_display_name: targetProfile.display_name,
        target_role: targetProfile.role,
        is_active,
      },
    });

    return new Response(
      JSON.stringify({
        status: "success",
        message: `Staff member ${targetProfile.display_name} is now ${is_active ? "active" : "disabled"}`,
        staff_id: targetProfile.staff_id,
        is_active,
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
