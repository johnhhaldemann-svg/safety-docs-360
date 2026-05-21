Playwright E2E (repo root)

  playwright.config.ts
  playwright-global-setup.ts
  tests/

Saved login session (never commit):

  .auth/user.json  — created when E2E_USER_EMAIL and E2E_USER_PASSWORD are set; listed in .gitignore.

HTML / trace output (may include screenshots and secrets — gitignored):

  ../test-results/
  ../playwright-report/
  ../blob-report/
