# SafetyDocs360 Project Guidance

## Product mission
SafetyDocs360 helps companies prevent incidents, predict safety risk, manage compliance documentation, and improve safety performance.

## Safety AI Engine principles
- Human life and serious injury prevention come before productivity, cost, or schedule.
- Compliance is the floor, not the ceiling.
- The engine must be transparent and explainable.
- When data is missing, be conservative and show the missing information.
- High and critical risks must be escalated.
- Critical risks should recommend immediate review and possible stop-work evaluation.
- The AI should assist safety professionals, not replace them.
- Do not invent regulatory citations or claim guaranteed compliance.
- Use practical safety controls and prioritize the hierarchy of controls.

## Engineering expectations
- Reuse existing components and styling.
- Keep TypeScript types strict.
- Keep business logic separate from UI components.
- Prefer deterministic, testable rules before adding LLM calls.
- Add or update tests for risk scoring and safety recommendations.
- Run lint, typecheck, tests, and build when relevant.
- Summarize changed files and commands run after each task.

## UI expectations
- Safety risk should be easy to understand quickly.
- Use clear risk badges: low, moderate, high, critical.
- Show top drivers and next actions.
- Do not bury urgent safety issues.
- Role-based dashboards should show the right action for the right user.

## Owner Proof Report requirements
- Never mark a task complete with only "done" or "fixed."
- Always explain what changed in plain English.
- Always list every file changed.
- Always explain what could break because of the change.
- Always run relevant tests, lint checks, type checks, or build commands when possible.
- If tests cannot be run, explain why in plain English.
- Always recommend what the owner should manually click and visually review.
- Never modify real customer data during testing.
- Use sandbox/test data for validation.
- For role or permission changes, verify every role.
- For document changes, verify PDF and Word export if those features exist.
- For AI/Gus changes, verify that responses do not invent safety requirements and use source rules when available.
- For database changes, explain whether migrations are required.
- For frontend changes, check desktop and mobile layouts when possible.
- End every task with this format:

OWNER PROOF REPORT

- What changed:
- Files changed:
- Why this change was needed:
- What could break:
- Tests/checks run:
- What passed:
- What failed:
- What I could not verify:
- What the owner should manually click:
- Safe to show a customer? Yes / No / Needs Review

## AI coding and deployment safety rules
- Never deploy directly to production.
- Never push directly to `main`, `master`, or production branches.
- All AI-generated changes must go through a pull request.
- All production-impacting changes require Super Admin approval before merge or deployment.
- Never change authentication, roles, billing, database migrations, API keys, environment variables, or deployment settings without explicit approval.
- Never expose secrets, tokens, private keys, user data, or credentials.
- Always run the project's tests, linting, type checks, and build checks before submitting work when possible.
- Every PR must include a summary of changes, risk level, files changed, tests run, and rollback instructions.
- Add audit logging for any AI proposal, approval, rejection, or deployment-related event.
- If a change cannot be verified, mark it as unverified and do not present it as complete.

## Repo commands
- Install: `npm ci`
- Dev server: `npm run dev`
- Test: `npm run test`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
