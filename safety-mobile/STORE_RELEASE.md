# Safety360 Field Store Release Packet

## Build Target

- Production API: `EXPO_PUBLIC_API_BASE_URL=https://safety360docs.com/api/mobile`
- iOS bundle id: `com.safety360docs.field`
- Android package: `com.safety360docs.field`
- Release path: EAS production builds for both iOS and Android.

## Store Review Notes

- The app is an online field companion for Safety360 Docs company users.
- Field users can create JSAs, field issues, audits, permit requests, incident reports, toolbox sessions, and evidence photos.
- Permit requests and incident reports require manager or safety admin review in the web platform.
- Documents and reports are view/download only on mobile through short-lived signed links.
- Offline drafts are not included in v1.

## Privacy / Data Safety Draft

- Account data: email, role, company, assigned jobsites.
- User-generated content: form entries, incident/near-miss details, audit findings, signatures, and notes.
- Photos: optional evidence uploads from camera or photo library.
- Location: permission is reserved for jobsite context; do not mark precise background tracking.
- Data is linked to the user/company account and used for safety operations, compliance records, and customer reporting.

## Submission Checklist

- Production Vercel deployment is live and points to the intended Supabase project.
- Supabase migrations are applied, including expanded mobile feature entitlements.
- Demo reviewer account exists with company workspace, assigned jobsite, and all mobile features enabled.
- App icon, splash, screenshots, support email, privacy policy URL, and terms URL are ready.
- Run `npm run typecheck` from `safety-mobile`.
- Run root platform checks: `npm run lint`, `npm run test`, and `npx tsc --noEmit`.
