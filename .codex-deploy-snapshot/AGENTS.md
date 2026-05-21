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
