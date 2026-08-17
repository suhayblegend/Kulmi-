# Kulmi — Mobile apps (iOS + Android via Capacitor)

The mobile apps reuse the exact same React web app. Capacitor packages the built
`dist/` folder into real native iOS/Android apps you submit to the stores.

The native shell adds: splash screen, correct status bar, hardware back button
(Android), safe-area insets, momentum scrolling, no web tap-flash, and haptic
feedback on key actions (invite / match / send). All of this is a no-op on the
website — the same code powers kulmi.uk unchanged.

## App identity
- App ID: `uk.kulmi.app`
- App name: `Kulmi`
- Config: `capacitor.config.ts`

## One-time prerequisites
- **Android:** [Android Studio](https://developer.android.com/studio) (Windows/Mac/Linux) + a Google Play Console account ($25 once).
- **iOS:** a **Mac with Xcode** *or* a cloud Mac build service (see below) + an Apple Developer account ($99/yr). iOS **cannot** be built on Windows directly.

## Everyday workflow
After any change to the web app:

```bash
npm run mobile:sync        # rebuild web + copy into both native projects
```

### Build & run Android (works on Windows)
```bash
npm run mobile:android     # builds, syncs, opens Android Studio
```
In Android Studio: press ▶ to run on an emulator/device. To ship: **Build → Generate Signed Bundle/APK → Android App Bundle (.aab)**, then upload the `.aab` in the Play Console.

### Build & run iOS (needs a Mac)
On a Mac:
```bash
npm install
npx cap add ios            # first time only
npm run mobile:ios         # builds, syncs, opens Xcode
```
In Xcode: set your Team (signing), pick a device, ▶ to run. To ship: **Product → Archive → Distribute App → App Store Connect**.

**No Mac?** Use a cloud build service that reads this repo and produces an iOS build:
- **Codemagic** or **Ionic Appflow** (both support Capacitor) — connect the repo, they build the iOS app in the cloud and can submit to App Store Connect. You still need the $99/yr Apple Developer account.

## App Store review checklist (marriage/dating apps get extra scrutiny)
- ✅ Age gate **17+** (set in store listing).
- ✅ **Report & block** users — already built.
- ✅ **Live selfie verification** — already built (helps a lot).
- ✅ Public **Privacy Policy** (kulmi.uk/privacy) and **Terms** (kulmi.uk/terms).
- ✅ A **delete-account** path in the app — already built (Apple requires it).
- ⚠️ Apple guideline **4.2 (minimum functionality)** dislikes "just a website" wrappers. We already add native splash/status-bar/back-button/haptics; adding **push notifications** (below) makes the case airtight.
- Provide a **demo account** for the reviewer (a pre-verified login) in App Review notes.

## Follow-up: push notifications (recommended before store launch)
Scaffolding is installed (`@capacitor/push-notifications`). To finish:
1. Firebase project → add Android app → drop `google-services.json` into `android/app/`.
2. Apple: enable Push capability + APNs key; wire via Firebase (FCM) for both.
3. Add a `device_tokens` table + register the token after login.
4. Send from the existing Edge function (or FCM) on invitation/match/message.

This turns the re-engagement emails we built into **push + email** — the single
biggest retention lever for a marriage app.

## Notes
- The apps load the **bundled** app (offline-capable, fast). To push a web update
  to installed apps you must submit a new store build (or add an OTA service later).
- Email-confirmation / password-reset deep links currently open in the browser; if
  you enable Supabase email confirmation for the app, configure a deep link
  (`uk.kulmi.app://`) so the link returns into the app.
