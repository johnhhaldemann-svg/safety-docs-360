# Safety360 Field Mobile

Expo/React Native app for field workflows only:

- Login
- Dashboard
- JSA
- Field Issues
- Field Audits
- Photos
- Signatures
- Profile

Version 1 is online-only. Offline drafts are intentionally deferred to version 2.

## Setup

```powershell
npm install
copy .env.example .env
npm run start
```

Set `EXPO_PUBLIC_API_BASE_URL` to the platform mobile API base URL, for example:

```text
https://safety360docs.com/api/mobile
```

## Device Preview

Run:

```powershell
npx expo start
```

Then scan the QR code with Expo Go on iPhone or Android.

## iOS Development Build

An iOS development build requires:

- An active Apple Developer Program membership.
- An Expo account.
- The target iPhone registered through EAS.

PowerShell may block the global `eas` PowerShell shim on Windows. If that happens, either run the npm scripts below or call `%APPDATA%\npm\eas.cmd` directly.

```powershell
npm run eas:login
npm run eas:configure
npm run eas:device
npm run build:ios:dev
```

After the EAS build finishes, open the build link or scan the QR code on the iPhone. On the device, enable Developer Mode in `Settings > Privacy & Security > Developer Mode`, then restart and confirm.

## Production Builds

```powershell
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile production
eas build --platform ios --profile production
```

## Store Submit

```powershell
eas submit --platform android
eas submit --platform ios
```

For the first submission, use the Apple App Store Connect and Google Play Console dashboards manually if you want to inspect each privacy, data safety, screenshot, and metadata step.

## Release Readiness Checklist

Before a production store build, confirm:

- `EXPO_PUBLIC_API_BASE_URL` points to `https://safety360docs.com/api/mobile`.
- Login succeeds with a real company user.
- Dashboard loads assigned jobsites, module access, counts, and recent activity.
- JSA can submit with jobsite, trade, hazards, PPE, photo, and printed-name signoff.
- Field Issue can submit with category, severity, observation type, SIF fields, due date, and photo.
- Field Audit can submit with audited company, jobsite, trades, failed-item corrective action, photo, hours billed, and final signature.
- Submitted audit appears in the platform Field Audits queue with AI/admin review status.
- Company admin can approve the audit and send the customer report if a customer email is saved.
- Wrong password, expired session, and slow connection show friendly messages.
- iPhone and Android phone layouts fit without clipped text.

Store materials to prepare:

- App icon and splash assets.
- App screenshots for iPhone and Android.
- Support email.
- Privacy policy URL.
- App Store privacy answers.
- Google Play Data Safety answers.
- Demo login for app review if Apple/Google needs one.
