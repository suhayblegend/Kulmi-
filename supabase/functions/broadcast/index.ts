// Kulmi — admin email blast. Sends to registered users via Resend.
// Deploy in Supabase (Edge Functions), then set secrets:
//   RESEND_API_KEY   = your Resend API key
//   BROADCAST_FROM   = Kulmi <noreply@kulmi.uk>   (optional; this is the default)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Only an admin may send a blast.
    const { data: userData, error: uErr } = await admin.auth.getUser(jwt);
    if (uErr || !userData.user) return json({ error: "Not signed in" }, 401);
    const { data: me } = await admin.from("profiles").select("role").eq("id", userData.user.id).single();
    if (me?.role !== "admin") return json({ error: "Admins only" }, 403);

    const { subject, html, audience } = await req.json();
    if (!subject || !html) return json({ error: "Missing subject or message" }, 400);

    let q = admin.from("profiles").select("email").not("email", "is", null);
    if (audience === "verified") q = q.eq("verification_status", "verified");
    const { data: rows } = await q;
    const emails = [...new Set((rows || []).map((r: { email: string }) => r.email).filter(Boolean))];
    if (emails.length === 0) return json({ sent: 0, total: 0 });

    const RESEND = Deno.env.get("RESEND_API_KEY");
    if (!RESEND) return json({ error: "Email sending isn't configured yet (missing RESEND_API_KEY)." }, 400);
    const FROM = Deno.env.get("BROADCAST_FROM") || "Kulmi <noreply@kulmi.uk>";

    let sent = 0;
    for (let i = 0; i < emails.length; i += 100) {
      const batch = emails.slice(i, i + 100).map((to) => ({ from: FROM, to: [to], subject, html }));
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      if (res.ok) sent += batch.length;
    }
    return json({ sent, total: emails.length });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
