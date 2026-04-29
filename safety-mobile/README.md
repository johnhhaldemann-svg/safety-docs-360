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
