# Kulmi — setup & test

Real flow: **signup → onboarding (with photo) → discover → invite → accept →
guided compatibility session → both say yes → chat.**

No third-party AI. The compatibility score is computed locally from the two
profiles — nothing ever leaves your Supabase database.

## 1. Set up the database (one copy-paste)

1. Go to your project on **supabase.com**.
2. In the left sidebar click **SQL Editor**, then **New query**.
3. Open **`kulmi_setup.sql`** (in this project folder), copy everything, paste it in.
4. Click **Run** (bottom right). You should see "Success".

That's it — it creates every table, security rule, and the photo storage bucket.
It's safe to run again if you're ever unsure.

> **Re-run `kulmi_setup.sql` after each update** — it's idempotent and now also
> locks down profile privacy (RLS) and adds the new onboarding fields.

*(The same content is also split into `migration.sql`, `migration_sessions.sql`,
`migration_storage.sql`, `migration_v2.sql`, and `migration_v3.sql` if you prefer
running them one at a time — but `kulmi_setup.sql` is all of them together.)*

## 2. Run the app

Make sure `.env.local` has your Supabase URL + anon key (see `.env.example`), then:

```bash
npm install
npm run dev
```

## 3. Test it end-to-end (use TWO accounts, opposite gender)

1. **Account A** — Join Now → sign up → verify email → sign in → onboarding
   (set gender, add a photo). Lands on **Discover**.
2. **Account B** — same in a second browser / incognito window, opposite gender.
3. **A** sees **B** as a candidate → **Invite**.
4. **B** sees the invitation at the top of Discover → **Accept**. A compatibility
   session opens.
5. **Both** answer the 5 questions (each finds it under "Compatibility sessions"
   on Discover). Answers reveal to each other only after both finish, with a
   compatibility score.
6. **Both** privately choose **Yes** → the chat unlocks and appears under **Chats**
   (messages are live). If either chooses No, the session ends and no chat is made.

## 4. Make yourself an admin / wali

In the SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
-- or 'wali' for the guardian portal
```

Sign out and back in — an **Admin** (or **Wali**) link appears in the nav,
hidden from everyone else.

## Photo verification (real review)

Users submit a selfie → it goes to a **Pending** queue (they can't self-verify; a
DB rule blocks it). An **admin** approves/rejects it in the Admin dashboard →
Verifications tab. Approved users get the verified badge.

## Voice notes

The mic button in a chat records real audio (asks for microphone permission),
uploads it to the `media` bucket, and sends it as a playable message.

## Wali (guardian) oversight

In **Settings → Family Mode**, a user enters their Wali's email. Anyone signed in
with a **Wali account** (role = `wali`) whose email matches sees those wards'
sessions and conversations (read-only) in the Wali dashboard.

## What's real vs. still to build

**Real:** auth, onboarding + photo upload, discover, invitations, guided
compatibility session, local compatibility analysis, private decisions gating the
match, chat + realtime + voice notes, chats list, profile load/save/photo,
photo verification review, reporting, progress stats, Admin dashboard
(users/verifications/sessions/conversations/reports), Wali oversight, real Settings.

**Still to build:** premium plan / invitation limits (billing); phone verification
& 2FA (the Security rows); success-stories/testimonials moderation.
