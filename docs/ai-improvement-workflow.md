# AI Improvement Workflow

SafetyDocs360 allows AI and Codex to propose, code, test, and link pull requests for platform improvements. Production-impacting changes must still be reviewed and approved by a Super Admin before they move toward merge or deployment.

## Workflow

1. AI detects or receives an improvement idea.
2. AI or a trusted internal user creates an AI Improvement Request.
3. Codex creates a feature branch outside the production branch.
4. Codex makes code changes on that branch.
5. Codex opens or links a pull request.
6. Automated checks run through the existing CI workflow.
7. The Super Admin reviews the request summary, code diff, test results, risk level, affected area, and rollback plan.
8. The Super Admin approves or rejects the request in Super Admin > AI Improvements.
9. Only approved changes may move toward merge or deployment.
10. Production deployment remains controlled by the existing CI/CD process.

## Safety Rules

- AI cannot approve itself.
- AI cannot reject, merge, deploy, or roll back its own changes.
- Super Admin approval is mandatory for production-impacting AI-generated changes.
- High-risk and critical requests need extra review before approval.
- Auth, roles, billing, database migrations, secrets, environment variables, and deployment settings are restricted areas.
- If checks have not passed, approval requires an explicit Super Admin override reason.
- Every create, update, approval request, approval, rejection, PR link, test completion, deployment trigger, rollback trigger, and unauthorized approval attempt must be audit logged.

## GitHub And Branch Protection

This app stores `branch_name`, `pull_request_url`, and `latest_commit_sha` on the AI Improvement Request. It does not merge pull requests from the app.

Configure GitHub branch protection for `main`, `master`, and any production branch to require:

- Pull request review before merge.
- Passing status checks before merge.
- No direct pushes to protected branches.
- Super Admin approval evidence before production merge.

GitHub required status checks should include the project CI checks that matter for the change, such as lint, unit tests, typecheck, build, and relevant Playwright checks.

## Deployment Boundary

The AI Improvement Request workflow is an approval and audit layer. It does not replace Supabase migration review, Vercel deployment review, GitHub branch protection, or human release management.

Do not deploy directly from an AI Improvement Request unless a future implementation adds a separately approved gated deployment workflow.

## Rollback Expectations

Every request should include a rollback plan before approval. A good rollback plan states how to revert code, whether database migrations are reversible, whether feature flags are involved, and what manual validation is needed after rollback.
