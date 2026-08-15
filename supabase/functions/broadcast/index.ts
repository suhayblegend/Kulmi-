// Kulmi — email blast + unsubscribe + account removal + verification actions.
// Deployed under slug "smart-service".
// Secrets: RESEND_API_KEY (required for email), BROADCAST_FROM (optional).
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
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const RESEND = Deno.env.get("RESEND_API_KEY");
  if (!RESEND) return false;
  const FROM = Deno.env.get("BROADCAST_FROM") || "Kulmi <noreply@kulmi.uk>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  return res.ok;
}

// Remove every file a user owns across all buckets (best-effort).
async function removeUserStorage(admin: ReturnType<typeof createClient>, uid: string) {
  const folders: [string, string][] = [
    ["avatars", uid],
    ["media", uid],
    ["secure", `${uid}/selfie`], ["secure", `${uid}/gallery`],
    ["secure", `${uid}/voice`], ["secure", `${uid}/answer`], ["secure", `${uid}/intro`],
  ];
  for (const [bucket, folder] of folders) {
    try {
      const { data: files } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
      if (files?.length) {
        await admin.storage.from(bucket).remove(files.map((f: { name: string }) => `${folder}/${f.name}`));
      }
    } catch { /* best effort */ }
  }
}

// Full account removal: storage → PII in broadcast_sends → profile row → auth user.
async function destroyAccount(admin: ReturnType<typeof createClient>, uid: string, email: string | null) {
  await removeUserStorage(admin, uid);
  if (email) { try { await admin.from("broadcast_sends").delete().eq("email", email); } catch { /* ok */ } }
  await admin.from("profiles").delete().eq("id", uid);
  const { error } = await admin.auth.admin.deleteUser(uid);
  return error ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const u = url.searchParams.get("u");
  const t = url.searchParams.get("t");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // ---- Wali confirms guardianship (GET link from the invite email) ----
  const w = url.searchParams.get("w");
  const e64 = url.searchParams.get("e");
  if (w && e64 && t) {
    let ok = false;
    let wardName = "";
    try {
      const email = atob(e64.replace(/-/g, "+").replace(/_/g, "/"));
      ok = t === (await hmacHex(`wali|${w}|${email.toLowerCase()}`));
      if (ok) {
        const { data: row } = await admin
          .from("profiles").select("first_name, wali_email").eq("id", w).single();
        if (row && (row.wali_email || "").toLowerCase() === email.toLowerCase()) {
          await admin.from("profiles").update({ wali_confirmed: true }).eq("id", w);
          wardName = row.first_name || "your ward";
        } else ok = false;
      }
    } catch { ok = false; }
    const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
      <body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#FDFBF7;margin:0;padding:40px 20px">
      <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #E5E0D8;border-radius:16px;padding:32px;text-align:center">
      <h1 style="color:#1B4332;font-family:Georgia,serif;font-size:22px">${ok ? "Guardianship confirmed ✓" : "Link invalid or expired"}</h1>
      <p style="color:#5C574F;line-height:1.6">${ok
        ? `Jazakallahu khairan. You are now confirmed as the wali for <b>${esc(wardName)}</b> on Kulmi. Sign in at kulmi.uk/wali with this email address to view their introductions.`
        : "Please ask your family member to re-send the confirmation email from their Kulmi settings."}</p>
      <a href="https://kulmi.uk${ok ? "/wali" : ""}" style="display:inline-block;background:#1B4332;color:#fff;text-decoration:none;padding:12px 24px;border-radius:12px;margin-top:8px">Open Kulmi</a>
      </div></body>`;
    return new Response(html, { status: ok ? 200 : 400, headers: { ...cors, "Content-Type": "text/html; charset=utf-8" } });
  }

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

    // ---- Self-delete: storage + data + profile + login, in a safe order ----
    if (body.action === "delete-account") {
      const delErr = await destroyAccount(admin, caller, userData.user.email ?? null);
      if (delErr) return json({ error: `Could not delete account: ${delErr.message}` }, 500);
      return json({ deleted: true });
    }

    // ---- Member asks us to email their wali a confirmation link ----
    if (body.action === "wali-invite") {
      const { data: meRow } = await admin
        .from("profiles").select("first_name, wali_email").eq("id", caller).single();
      const waliEmail = (meRow?.wali_email || "").trim().toLowerCase();
      if (!waliEmail) return json({ error: "No wali email saved on your profile." }, 400);
      const token = await hmacHex(`wali|${caller}|${waliEmail}`);
      const e64 = btoa(waliEmail).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const link = `${FN_URL}?w=${caller}&e=${e64}&t=${token}`;
      const name = meRow?.first_name || "A family member";
      const sent = await sendEmail(waliEmail, `${name} chose you as their wali on Kulmi`,
        `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#2D2926">
          <h2 style="color:#1B4332;font-family:Georgia,serif">Assalamu alaikum</h2>
          <p><b>${esc(name)}</b> has named you as their wali (guardian) on <b>Kulmi</b>, a serious Somali marriage platform.</p>
          <p>As their wali you'll be able to oversee their introductions — seeing who they're speaking with, with full transparency.</p>
          <p>If you accept this responsibility, please confirm:</p>
          <p><a href="${link}" style="display:inline-block;background:#1B4332;color:#fff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:500">Confirm — I am their wali</a></p>
          <p style="font-size:13px;color:#8B7355">If you don't recognise this person, you can safely ignore this email — nothing will be shared with you.</p>
          <p style="font-size:12px;color:#8B7355;margin-top:20px">Kulmi — kulmi.uk</p>
        </div>`);
      return json({ sent });
    }

    // Everything below is admin-only.
    const { data: me } = await admin.from("profiles").select("role").eq("id", caller).single();
    if (me?.role !== "admin") return json({ error: "Admins only" }, 403);

    // ---- Admin removes (and optionally bans) a member, with an emailed reason ----
    if (body.action === "admin-remove-user") {
      const { data: target } = await admin.from("profiles").select("email, first_name").eq("id", body.userId).single();
      const email = target?.email ?? null;
      const reason = (body.reason || "").trim();
      if (email) {
        if (body.ban) {
          try { await admin.from("banned_emails").upsert({ email: email.toLowerCase(), reason: reason || null }); } catch { /* table may not exist yet */ }
        }
        await sendEmail(email, "Your Kulmi account has been removed",
          `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#2D2926">
            <h2 style="color:#1B4332;font-family:Georgia,serif">Account removed</h2>
            <p>Assalamu alaikum${target?.first_name ? " " + esc(target.first_name) : ""},</p>
            <p>Your Kulmi account has been removed by our moderation team.</p>
            ${reason ? `<p style="background:#FDFBF7;border:1px solid #E5E0D8;border-radius:12px;padding:12px 16px"><b>Reason:</b> ${esc(reason)}</p>` : ""}
            <p>If you believe this was a mistake, reply to this email or contact us at support@kulmi.uk.</p>
            <p style="font-size:12px;color:#8B7355;margin-top:20px">Kulmi — kulmi.uk</p>
          </div>`);
      }
      const delErr = await destroyAccount(admin, body.userId, email);
      if (delErr) return json({ error: `Could not remove user: ${delErr.message}` }, 500);
      return json({ removed: true, emailed: !!email, banned: !!body.ban });
    }

    // ---- Approve/reject a verification (service-role — never blocked by RLS) ----
    if (body.action === "review-verification") {
      const approve = !!body.approve;
      const { error: e2 } = await admin.from("profiles").update({
        photo_verified: approve,
        verification_status: approve ? "verified" : "rejected",
        verification_note: approve ? null : ((body.note || "").trim() || null),
      }).eq("id", body.userId);
      if (e2) return json({ error: e2.message }, 500);
      return json({ ok: true });
    }

    // ---- Email a member that their verification was rejected (with the reason) ----
    if (body.action === "notify-rejection") {
      const { data: target } = await admin.from("profiles").select("email, first_name").eq("id", body.userId).single();
      if (!target?.email) return json({ sent: false, note: "No email on file." });
      const reason = (body.reason || "").trim();
      const sent = await sendEmail(target.email, "Your Kulmi verification",
        `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#2D2926">
          <h2 style="color:#1B4332;font-family:Georgia,serif">Verification not approved</h2>
          <p>Assalamu alaikum${target.first_name ? " " + esc(target.first_name) : ""},</p>
          <p>Thanks for submitting your verification. Unfortunately it wasn't approved this time.</p>
          ${reason ? `<p style="background:#FDFBF7;border:1px solid #E5E0D8;border-radius:12px;padding:12px 16px"><b>Reason:</b> ${esc(reason)}</p>` : ""}
          <p>Please sign in and submit a new, clear <b>live selfie</b> that matches your profile photo to try again.</p>
          <p><a href="https://kulmi.uk" style="display:inline-block;background:#1B4332;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:500">Open Kulmi</a></p>
          <p style="font-size:12px;color:#8B7355;margin-top:20px">Kulmi — kulmi.uk</p>
        </div>`);
      return json({ sent });
    }

    // ---- Formal warning email (step before removal) ----
    if (body.action === "warn-user") {
      const { data: target } = await admin.from("profiles").select("email, first_name").eq("id", body.userId).single();
      if (!target?.email) return json({ sent: false, note: "No email on file." });
      const reason = (body.reason || "").trim();
      const sent = await sendEmail(target.email, "A warning about your Kulmi account",
        `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#2D2926">
          <h2 style="color:#B45309;font-family:Georgia,serif">Official warning</h2>
          <p>Assalamu alaikum${target.first_name ? " " + esc(target.first_name) : ""},</p>
          <p>Our moderation team has issued a warning on your Kulmi account.</p>
          ${reason ? `<p style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:12px 16px"><b>Reason:</b> ${esc(reason)}</p>` : ""}
          <p>Kulmi is a serious marriage platform built on Islamic values and respect. If this behaviour continues, your account will be <b>permanently removed and banned</b>.</p>
          <p style="font-size:12px;color:#8B7355;margin-top:20px">Kulmi — kulmi.uk</p>
        </div>`);
      return json({ sent });
    }

    // ---- Admin email blast (idempotent per campaign) ----
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
