// ===========================================
// Kvittra — Verify OTP Edge Function
// Validates the 6-digit code against stored hash.
// On success: marks code as used, returns user's org memberships.
// ===========================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { userId, code } = await req.json();

    if (!userId || !code) {
      return new Response(
        JSON.stringify({ error: "userId och code krävs" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const codeHash = await hashCode(code);

    // Find matching, unused, non-expired OTP
    // Try kvittra schema first, fallback to default
    let otpData: any = null;
    let otpError: any = null;

    const result = await supabase
      .schema("kvittra" as any)
      .from("otp_codes")
      .select("id, expires_at")
      .eq("user_id", userId)
      .eq("code_hash", codeHash)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    otpData = result.data;
    otpError = result.error;

    if (otpError) {
      // Fallback without schema prefix
      const fallback = await supabase
        .from("otp_codes")
        .select("id, expires_at")
        .eq("user_id", userId)
        .eq("code_hash", codeHash)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      otpData = fallback.data;
      otpError = fallback.error;
    }

    if (!otpData) {
      return new Response(
        JSON.stringify({ error: "Ogiltig eller utgången kod" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as used
    await supabase
      .schema("kvittra" as any)
      .from("otp_codes")
      .update({ used: true })
      .eq("id", otpData.id);

    // Fetch user's organizations
    const { data: memberships } = await supabase
      .schema("kvittra" as any)
      .from("organization_members")
      .select(`
        id, roles, org_id,
        organizations:org_id ( id, name, slug, branding_config )
      `)
      .eq("user_id", userId)
      .eq("is_active", true);

    return new Response(
      JSON.stringify({
        success: true,
        organizations: (memberships || []).map((m: any) => ({
          memberId: m.id,
          orgId: m.org_id,
          roles: m.roles,
          org: m.organizations,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
