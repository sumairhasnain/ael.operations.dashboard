# AEL Operations: iOS and Android app

A Capacitor app that wraps the existing portal (`../site`). Same Supabase logins, same roles, same tabs: the database
rules decide what each person sees, so nothing about access changes. The app only adds a device sign-in layer.

## What the app adds

| Feature | How it works |
|---|---|
| **Remember my password** | Email and password are stored in the iOS Keychain / Android Keystore (not in web storage) and pre-filled at sign-in. |
| **Face ID / fingerprint / face unlock** | The password is stored with hardware biometric protection (`BIOMETRY_CURRENT_SET`). It cannot be read without a live biometric check. A "Sign in with Face ID" button prompts automatically at launch. |
| Stale saved password | If the admin resets the password or the user changes it elsewhere, the saved login is cleared and the user signs in normally once. |
| Password change | Changing the password (including the forced first-time change) updates the saved copy. |
| Forget this device | Link on the sign-in page and on Change password. |
| 60-minute idle sign-out | Unchanged. After it, biometric sign-in brings the user straight back. |

If the user enrols a new fingerprint/face, the biometric entry is invalidated by the OS and they sign in once with the password to set it up again.

### Passkeys: not included yet
Supabase Auth has no passkey sign-in, so true passkeys need a WebAuthn endpoint on our side
(a new Edge Function plus a credentials table, and Associated Domains / Digital Asset Links on the portal domain).
Until then, iCloud Keychain and Google Password Manager can still autofill the saved password on the sign-in form,
and Face ID / fingerprint covers the "no typing" case. This is a separate piece of work.

## Build

Needs Node 20+. Android: Android Studio. iOS: a Mac with Xcode 16+ and an Apple Developer account.

```bash
python3 tools/build.py          # repo root: refresh site/app.html from src/dashboard.html
cd mobile
npm install
npm run android                 # builds www/, syncs, opens Android Studio -> Run / Build > Generate Signed Bundle
npm run ios                     # same for Xcode -> Product > Archive
```

Re-run `npm run sync` whenever `site/` changes: the app bundles the portal pages. Dashboard *data* is always live from Supabase.

## Before store release

1. Set the bundle / application id in `capacitor.config.json` and Xcode / `android/app/build.gradle` (currently `com.ael.operations`).
2. Add the app icon and splash (`npx @capacitor/assets generate` with `assets/icon.png`, 1024x1024).
3. In Supabase: the app talks to the same project as the website; no new URL configuration is needed for sign-in.
4. Staff-only distribution: TestFlight / Apple Business Manager (custom app) on iOS, and Google Play internal testing or a private managed app on Android.
5. Test on a real device: simulators/emulators can fake Face ID, but confirm the prompt text and the
   enrolled-biometrics-changed path on hardware.

## Android release (Google Play)

1. **Create the upload key once** (keep the file and passwords safe; losing them means a support request to Google):
   ```bash
   keytool -genkeypair -v -keystore ~/ael-upload.jks -alias ael -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Create `mobile/android/keystore.properties` (git-ignored):
   ```
   storeFile=/full/path/to/ael-upload.jks
   storePassword=...
   keyAlias=ael
   keyPassword=...
   ```
3. `npm install && npm run android`, then in Android Studio: **Build > Generate App Bundles or APKs > Generate Bundles**, choose *release*.
   The file is `android/app/release/app-release.aab`. Upload it in Play Console. (Terminal alternative: `cd android && ./gradlew bundleRelease`.)
4. Bump `versionCode` (and `versionName`) in `android/app/build.gradle` for every new upload.
5. Test on a phone first: **Run** with a USB-connected device, or `./gradlew assembleRelease` for an installable `.apk`.

Icon: put a 1024x1024 `assets/icon.png` in place and run `python3 scripts/make-icons.py`.
