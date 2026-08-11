# Deploying Kulmi

Kulmi is a static front-end (Vite/React) + Supabase (already cloud). Deploying =
hosting the front-end on a service that gives you HTTPS + a domain. Vercel or
Netlify are free and take ~10 minutes. HTTPS is required for the camera, mic
(voice notes), and password-reset links to work — hosting gives you that.

## 0. Before you deploy
- **Run `kulmi_setup.sql`** on your PRODUCTION Supabase project (SQL Editor → paste → Run).
  It's the whole schema + all security fixes. Safe to re-run.
- **Replace placeholders** with your real domain / email:
  - `index.html` — the `https://kulmi.app` in canonical + Open Graph tags
  - `public/robots.txt` — the Sitemap line
  - `src/components/Settings.tsx` — `SUPPORT_EMAIL`

## 1. Put the code on GitHub
1. Create a new **private** repo on github.com.
2. From the project folder:
   ```bash
   git init
   git add .
   git commit -m "Kulmi"
   git branch -M main
   git remote add origin https://github.com/YOU/kulmi.git
   git push -u origin main
   ```
   (`.env.local` is git-ignored, so your keys are NOT pushed — good.)

## 2. Deploy on Vercel (recommended)
1. Go to **vercel.com** → sign in with GitHub → **Add New → Project** → import your repo.
2. Framework preset: **Vite** (auto-detected). Build command `npm run build`, output `dist` (auto).
3. **Environment Variables** — add these two (from your `.env.local`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy**. You'll get a URL like `https://kulmi.vercel.app`.
   (SPA routing is handled by `vercel.json`; on Netlify it's `public/_redirects`.)

## 3. Point Supabase at your live URL (important)
Supabase → **Authentication → URL Configuration**:
- **Site URL**: your deployed URL (e.g. `https://kulmi.vercel.app` or your domain)
- **Redirect URLs**: add the same URL (and `http://localhost:3000` for local dev)

This makes **email verification** and **password-reset** links land back on your app.

## 4. Email delivery (so signups/resets actually arrive)
Supabase's built-in email is fine for testing but rate-limited. For real users,
Supabase → **Authentication → Emails / SMTP** → set up a custom SMTP sender
(e.g. Resend, SendGrid, Postmark) so verification and reset emails deliver reliably.

## 5. Custom domain (optional)
In Vercel → Project → **Domains**, add your domain (e.g. `kulmi.app`) and follow the
DNS steps. Then update the placeholders in step 0 to that domain and redeploy.

## 6. After deploy — smoke test on real devices
- Sign up → verify email → onboarding → **live selfie** (camera works on HTTPS) →
  approve from `/admin` → discover → invite → session → chat + voice note.
- Try the **phone QR** on the verification screen from a laptop.
- Try **forgot password**.

That's it — you're live.
