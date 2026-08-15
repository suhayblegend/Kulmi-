// Kulmi — email blast + unsubscribe + self-delete. Deployed under slug "smart-service".
// Secrets: RESEND_API_KEY (required), BROADCAST_FROM (optional).
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/smart-service`;

async function hmacHex(value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SERVICE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(value: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const u = url.searchParams.get("u");
  const t = url.searchParams.get("t");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // ---- Unsubscribe (GET link, or one-click POST) ----
  if (u && t) {
    try {
      const ok = t === (await hmacHex(u));
      if (ok) await admin.from("profiles").update({ email_unsubscribed: true }).eq("id", u);
      if (req.method === "POST") return json({ ok });
      return Response.redirect(`https://kulmi.uk/unsubscribed.html?ok=${ok ? 1 : 0}`, 302);
    } catch {
      return Response.redirect("https://kulmi.uk/unsubscribed.html?ok=0", 302);
    }
  }

  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: userData, error: uErr } = await admin.auth.getUser(jwt);
    if (uErr || !userData.user) return json({ error: "Not signed in" }, 401);
    const caller = userData.user.id;
    const body = await req.json().catch(() => ({}));

    // ---- Self-delete account. Delete the auth user FIRST (cascades the profile
    // and all their data); then clean up the profile row in case no cascade. ----
    if (body.action === "delete-account") {
      const { error: delErr } = await admin.auth.admin.deleteUser(caller);
      if (delErr) return json({ error: `Could not delete account: ${delErr.message}` }, 500);
      await admin.from("profiles").delete().eq("id", caller);
      return json({ deleted: true });
    }

    // ---- Notify a member their verification was rejected (admin only) ----
    if (body.action === "notify-rejection") {
      const { data: adminRow } = await admin.from("profiles").select("role").eq("id", caller).single();
      if (adminRow?.role !== "admin") return json({ error: "Admins only" }, 403);
      const { data: target } = await admin.from("profiles").select("email, first_name").eq("id", body.userId).single();
      if (!target?.email) return json({ sent: false, note: "No email on file." });
      const RESEND = Deno.env.get("RESEND_API_KEY");
      if (!RESEND) return json({ sent: false, note: "Email not configured." });
      const FROM = Deno.env.get("BROADCAST_FROM") || "Kulmi <noreply@kulmi.uk>";
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const reason = (body.reason || "").trim();
      const emailHtml = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#2D2926">
        <h2 style="color:#1B4332;font-family:Georgia,serif">Verification not approved</h2>
        <p>Assalamu alaikum${target.first_name ? " " + esc(target.first_name) : ""},</p>
        <p>Thanks for submitting your verification. Unfortunately it wasn't approved this time.</p>
        ${reason ? `<p style="background:#FDFBF7;border:1px solid #E5E0D8;border-radius:12px;padding:12px 16px"><b>Reason:</b> ${esc(reason)}</p>` : ""}
        <p>Please sign in and submit a new, clear <b>live selfie</b> that matches your profile photo to try again.</p>
        <p><a href="https://kulmi.uk" style="display:inline-block;background:#1B4332;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:500">Open Kulmi</a></p>
        <p style="font-size:12px;color:#8B7355;margin-top:20px">Kulmi — kulmi.uk</p>
      </div>`;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [target.email], subject: "Your Kulmi verification", html: emailHtml }),
      });
      return json({ sent: res.ok });
    }

    // ---- Admin email blast ----
    const { data: me } = await admin.from("profiles").select("role").eq("id", caller).single();
    if (me?.role !== "admin") return json({ error: "Admins only" }, 403);

    const { subject, html: bodyHtml, audience } = body;
    if (!subject || !bodyHtml) return json({ error: "Missing subject or message" }, 400);

    const buildQuery = (withUnsub: boolean) => {
      let q = admin.from("profiles").select("id, email").not("email", "is", null);
      if (audience === "verified") q = q.eq("verification_status", "verified");
      if (withUnsub) q = q.not("email_unsubscribed", "is", true);
      return q;
    };
    let { data: rows, error: qErr } = await buildQuery(true);
    if (qErr) ({ data: rows, error: qErr } = await buildQuery(false));
    if (qErr) return json({ error: `Could not load recipients: ${qErr.message}` }, 500);
    let people = (rows || []).filter((r: { email: string }) => r.email);

    // Idempotency: skip anyone this exact campaign (subject+body) already reached,
    // so a retry after a partial failure never double-sends.
    const campaign = (await sha256Hex(subject + "\n" + bodyHtml)).slice(0, 32);
    const { data: already } = await admin.from("broadcast_sends").select("email").eq("campaign", campaign);
    const done = new Set((already || []).map((r: { email: string }) => r.email));
    people = people.filter((p: { email: string }) => !done.has(p.email));
    if (people.length === 0) return json({ sent: 0, total: 0, note: "Everyone in this audience was already sent this message." });

    const RESEND = Deno.env.get("RESEND_API_KEY");
    if (!RESEND) return json({ error: "Missing RESEND_API_KEY secret." }, 400);
    const FROM = Deno.env.get("BROADCAST_FROM") || "Kulmi <noreply@kulmi.uk>";

    let sent = 0;
    const errors: string[] = [];
    for (let i = 0; i < people.length; i += 100) {
      const slice = people.slice(i, i + 100);
      const batch = await Promise.all(slice.map(async (p: { id: string; email: string }) => {
        const unsub = `${FN_URL}?u=${p.id}&t=${await hmacHex(p.id)}`;
        const footer = `<p style="font-size:12px;color:#8B7355;margin-top:20px">Don't want these emails? <a href="${unsub}" style="color:#8B7355">Unsubscribe</a>.</p>`;
        return { from: FROM, to: [p.email], subject, html: bodyHtml + footer, headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } };
      }));
      const res = await fetch("https://api.resend.com/emails/batch", { method: "POST", headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" }, body: JSON.stringify(batch) });
      if (res.ok) {
        sent += slice.length;
        await admin.from("broadcast_sends").insert(slice.map((p: { email: string }) => ({ campaign, email: p.email })));
      } else {
        errors.push(`${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
    }
    return json({ sent, total: people.length, errors: errors.slice(0, 3) });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
