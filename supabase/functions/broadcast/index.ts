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

  // ---- Unsubscribe (GET link click, or mail-client one-click POST) ----
  if (u && t) {
    try {
      const ok = t === (await tokenFor(u));
      if (ok) await admin.from("profiles").update({ email_unsubscribed: true }).eq("id", u);
      if (req.method === "POST") return json({ ok });
      // Redirect to a real page on the site (the function runtime forces text/plain
      // on inline HTML, so we let nginx serve the confirmation page instead).
      return Response.redirect(`https://kulmi.uk/unsubscribed.html?ok=${ok ? 1 : 0}`, 302);
    } catch (_e) {
      return Response.redirect("https://kulmi.uk/unsubscribed.html?ok=0", 302);
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

    // Fetch recipients. Works whether or not the email_unsubscribed column exists.
    const buildQuery = (withUnsub: boolean) => {
      let q = admin.from("profiles").select("id, email").not("email", "is", null);
      if (audience === "verified") q = q.eq("verification_status", "verified");
      if (withUnsub) q = q.not("email_unsubscribed", "is", true);
      return q;
    };
    let { data: rows, error: qErr } = await buildQuery(true);
    if (qErr) ({ data: rows, error: qErr } = await buildQuery(false));
    if (qErr) return json({ error: `Could not load recipients: ${qErr.message}` }, 500);
    const people = (rows || []).filter((r: { email: string }) => r.email);
    if (people.length === 0) return json({ sent: 0, total: 0, note: "No recipients matched this audience." });

    const RESEND = Deno.env.get("RESEND_API_KEY");
    if (!RESEND) return json({ error: "Email sending isn't configured (missing RESEND_API_KEY secret)." }, 400);
    const FROM = Deno.env.get("BROADCAST_FROM") || "Kulmi <noreply@kulmi.uk>";

    let sent = 0;
    const errors: string[] = [];
    for (let i = 0; i < people.length; i += 100) {
      const batch = await Promise.all(people.slice(i, i + 100).map(async (p: { id: string; email: string }) => {
        const unsub = `${FN_URL}?u=${p.id}&t=${await tokenFor(p.id)}`;
        const footer = `<p style="font-size:12px;color:#8B7355;margin-top:20px">Don't want these emails? <a href="${unsub}" style="color:#8B7355">Unsubscribe</a>.</p>`;
        return {
          from: FROM, to: [p.email], subject, html: bodyHtml + footer,
          headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        };
      }));
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      if (res.ok) sent += batch.length;
      else errors.push(`${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    return json({ sent, total: people.length, errors: errors.slice(0, 3) });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
