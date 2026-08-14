// Kulmi — admin email blast + one-click unsubscribe. Sends via Resend.
// Set RESEND_API_KEY (and optionally BROADCAST_FROM) as Secrets in Supabase — not here.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { ...cors, "Content-Type": "text/html; charset=utf-8" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/smart-service`;

// Per-user unsubscribe token = HMAC(uid, service key). No DB storage needed.
async function tokenFor(uid: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SERVICE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(uid));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const u = url.searchParams.get("u");
  const t = url.searchParams.get("t");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // ---- Unsubscribe (email link click = GET, mail-client one-click = POST) ----
  if (u && t) {
    try {
      const ok = t === (await tokenFor(u));
      if (ok) await admin.from("profiles").update({ email_unsubscribed: true }).eq("id", u);
      if (req.method === "POST") return json({ ok });
      return html(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
        <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:60px auto;padding:0 24px;text-align:center;color:#2D2926">
          <h1 style="color:#1B4332;font-family:Georgia,serif">${ok ? "You've been unsubscribed" : "Link expired"}</h1>
          <p style="color:#5C574F">${ok ? "You won't receive further update emails from Kulmi. You'll still get essential account emails (like password resets)." : "We couldn't verify this unsubscribe link."}</p>
          <p><a href="https://kulmi.uk" style="color:#1B4332">Return to Kulmi</a></p>
        </div>`);
    } catch (e) {
      return html(`<p>Something went wrong: ${String((e as Error)?.message || e)}</p>`, 500);
    }
  }

  // ---- Admin email blast ----
  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: userData, error: uErr } = await admin.auth.getUser(jwt);
    if (uErr || !userData.user) return json({ error: "Not signed in" }, 401);
    const { data: me } = await admin.from("profiles").select("role").eq("id", userData.user.id).single();
    if (me?.role !== "admin") return json({ error: "Admins only" }, 403);

    const { subject, html: bodyHtml, audience } = await req.json();
    if (!subject || !bodyHtml) return json({ error: "Missing subject or message" }, 400);

    let q = admin.from("profiles").select("id, email").not("email", "is", null).not("email_unsubscribed", "is", true);
    if (audience === "verified") q = q.eq("verification_status", "verified");
    const { data: rows } = await q;
    const people = (rows || []).filter((r: { email: string }) => r.email);
    if (people.length === 0) return json({ sent: 0, total: 0 });

    const RESEND = Deno.env.get("RESEND_API_KEY");
    if (!RESEND) return json({ error: "Email sending isn't configured yet (missing RESEND_API_KEY)." }, 400);
    const FROM = Deno.env.get("BROADCAST_FROM") || "Kulmi <noreply@kulmi.uk>";

    let sent = 0;
    for (let i = 0; i < people.length; i += 100) {
      const batch = await Promise.all(people.slice(i, i + 100).map(async (p: { id: string; email: string }) => {
        const unsub = `${FN_URL}?u=${p.id}&t=${await tokenFor(p.id)}`;
        const footer = `<p style="font-size:12px;color:#8B7355;margin-top:20px">Don't want these emails? <a href="${unsub}" style="color:#8B7355">Unsubscribe</a>.</p>`;
        return {
          from: FROM,
          to: [p.email],
          subject,
          html: bodyHtml + footer,
          headers: {
            "List-Unsubscribe": `<${unsub}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        };
      }));
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      if (res.ok) sent += batch.length;
    }
    return json({ sent, total: people.length });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
