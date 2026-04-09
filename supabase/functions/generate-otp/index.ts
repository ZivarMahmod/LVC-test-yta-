// ===========================================
// CorevoSports — Generate OTP Edge Function
// Called after successful password auth.
// Generates 6-digit code, stores hash in DB,
// sends code via SMTP (one.com) to recovery_email.
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

    // Look up recovery_email from organization_members
    const { data: memberData } = await supabase
      .schema("kvittra" as any)
      .from("organization_members")
      .select("recovery_email")
      .eq("user_id", userId)
      .not("recovery_email", "is", null)
      .limit(1)
      .single();

    const recipientEmail = memberData?.recovery_email || email;

    // Send OTP via SMTP (one.com)
    const smtpHost = Deno.env.get("SMTP_HOST") || "send.one.com";
    const smtpPort = Number(Deno.env.get("SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("SMTP_USER") || "support.volleybol@corevo.se";
    const smtpPass = Deno.env.get("SMTP_PASSWORD");
    const smtpFrom = Deno.env.get("SMTP_FROM") || "support.volleybol@corevo.se";

    if (smtpPass) {
      try {
        // Connect to SMTP via Deno TLS
        const conn = await Deno.connectTls({ hostname: smtpHost, port: smtpPort });
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const read = async () => {
          const buf = new Uint8Array(1024);
          const n = await conn.read(buf);
          return decoder.decode(buf.subarray(0, n || 0));
        };

        const write = async (cmd: string) => {
          await conn.write(encoder.encode(cmd + "\r\n"));
          return await read();
        };

        await read(); // greeting
        await write(`EHLO corevosports`);
        await write(`AUTH LOGIN`);
        await write(btoa(smtpUser));
        await write(btoa(smtpPass));
        await write(`MAIL FROM:<${smtpFrom}>`);
        await write(`RCPT TO:<${recipientEmail}>`);
        await write(`DATA`);

        const htmlBody = `
          <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 2rem;">
            <h2 style="color: #1a1a2e;">Corevosports</h2>
            <p>Din inloggningskod:</p>
            <div style="font-size: 2rem; font-weight: bold; letter-spacing: 0.5rem; padding: 1rem; background: #f0f0f0; border-radius: 8px; text-align: center; margin: 1rem 0;">
              ${code}
            </div>
            <p style="color: #666; font-size: 0.9rem;">Koden är giltig i 10 minuter.</p>
          </div>
        `;

        const message = [
          `From: Corevosports <${smtpFrom}>`,
          `To: ${recipientEmail}`,
          `Subject: Din inloggningskod för Corevosports`,
          `MIME-Version: 1.0`,
          `Content-Type: text/html; charset=UTF-8`,
          ``,
          htmlBody,
          `.`,
        ].join("\r\n");

        await write(message);
        await write(`QUIT`);
        conn.close();

        console.log(`OTP email sent to ${recipientEmail}`);
      } catch (smtpErr) {
        // Mail error should not block login flow
        console.error("SMTP error (non-blocking):", (smtpErr as Error).message);
      }
    } else {
      // Log code for development (no SMTP_PASSWORD configured)
      console.log(`[DEV] OTP for ${recipientEmail}: ${code}`);
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
