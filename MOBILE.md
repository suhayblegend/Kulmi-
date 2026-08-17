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

## Push notifications — mostly built, needs Firebase credentials
The whole pipeline is already wired: the app registers a device token after
login (`device_tokens` table, migration_v42), and the Edge function sends a
native push on **invitation received** and **it's a match** (alongside the
emails), deep-linking into the app when tapped. You only need to plug in Firebase:

1. Create a **Firebase project** → **Project settings → Cloud Messaging**.
2. **Android:** add an Android app with package `uk.kulmi.app`, download
   `google-services.json`, and place it in `android/app/`. (FCM plugin autodetects it.)
3. **iOS:** add an iOS app (bundle `uk.kulmi.app`); in the Apple Developer portal
   create an **APNs key** and upload it to Firebase → Cloud Messaging. On a Mac,
   enable the **Push Notifications** capability in Xcode.
4. **Service account** (lets the server send): Firebase → Project settings →
   **Service accounts → Generate new private key** (downloads a JSON). Add it as a
   Supabase secret named **`FCM_SERVICE_ACCOUNT`** (paste the whole JSON):
   ```bash
   supabase secrets set FCM_SERVICE_ACCOUNT="$(cat service-account.json)"
   ```
5. Run the latest `kulmi_setup.sql` (adds `device_tokens`) and redeploy the
   `smart-service` Edge function.

Until `FCM_SERVICE_ACCOUNT` is set, push simply no-ops (emails still send). Once
set, invitations and matches arrive as **push + email** — the biggest retention
lever for a marriage app.

## Notes
- The apps load the **bundled** app (offline-capable, fast). To push a web update
  to installed apps you must submit a new store build (or add an OTA service later).
- Email-confirmation / password-reset deep links currently open in the browser; if
  you enable Supabase email confirmation for the app, configure a deep link
  (`uk.kulmi.app://`) so the link returns into the app.
