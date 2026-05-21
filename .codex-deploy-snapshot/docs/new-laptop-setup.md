# New laptop setup

Use this when moving the repo to a fresh machine.

## What to copy

- Copy the repository with the `.git` folder if you want full history.
- Copy `.env.local` securely if you already have working local keys.
- Do not bother copying generated folders like `node_modules`, `.next`, `.npm-cache`, `playwright-report`, or `test-results`.

## Install first

- Git
- Node.js 20 or newer
- npm
- Optional: Supabase CLI if you apply database migrations locally

## Fastest path on Windows

From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-new-laptop.ps1
```

That script:

- checks for Git, Node, and npm
- warns if `.env.local` is missing
- runs `npm install`
- reminds you about `supabase link` and `npm run db:push`

## After setup

Run:

```powershell
npm run dev
```

If the app depends on new schema changes, run:

```powershell
supabase link --project-ref <your-project-ref>
npm run db:push
```
