// ===========================================
// Kvittra — Generate OTP Edge Function
// Called after successful password auth.
// Generates 6-digit code, stores hash in DB,
// sends code via email.
// ===========================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Simple hash function for OTP (using Web Crypto API)
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

    const { userId, email } = await req.json();

    if (!userId || !email) {
      return new Response(
        JSON.stringify({ error: "userId och email krävs" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await hashCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Invalidate old unused codes for this user
    await supabase
      .from("otp_codes")
      .update({ used: true })
      .eq("user_id", userId)
      .eq("used", false);

    // Store new code hash
    const { error: insertError } = await supabase
      .schema("kvittra" as any)
      .from("otp_codes")
      .insert({
        user_id: userId,
        code_hash: codeHash,
        expires_at: expiresAt,
      });

    if (insertError) {
      // Fallback: try without schema prefix (depends on PostgREST config)
      const { error: fallbackError } = await supabase
        .from("otp_codes")
        .insert({
          user_id: userId,
          code_hash: codeHash,
          expires_at: expiresAt,
        });
      if (fallbackError) {
        return new Response(
          JSON.stringify({ error: "Kunde inte spara OTP" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Send email with OTP code
    // Configure SMTP or Resend in env vars:
    //   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
    //   or RESEND_API_KEY
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (resendKey) {
      // Send via Resend
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "support@kvittra.se",
          to: email,
          subject: `Din inloggningskod — ${code}`,
          html: `
            <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 2rem;">
              <h2 style="color: #1a1a2e;">Kvittra</h2>
              <p>Din inloggningskod:</p>
              <div style="font-size: 2rem; font-weight: bold; letter-spacing: 0.5rem; padding: 1rem; background: #f0f0f0; border-radius: 8px; text-align: center; margin: 1rem 0;">
                ${code}
              </div>
              <p style="color: #666; font-size: 0.9rem;">Koden är giltig i 10 minuter.</p>
            </div>
          `,
        }),
      });

      if (!emailRes.ok) {
        console.error("Resend error:", await emailRes.text());
      }
    } else {
      // Log code for development (remove in production)
      console.log(`[DEV] OTP for ${email}: ${code}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "OTP skickad" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
