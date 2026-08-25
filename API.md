# AKADEMI Digital Campus — API Contract Rules

## Standards

- Base path `/api/v1`; JSON; UUID resources; UTC ISO-8601 timestamps.
- OpenAPI is generated and validated in CI; React uses a typed generated client.
- Consistent pagination, filtering allowlists, sorting, validation errors, correlation IDs, and rate-limit headers.
- Mutations support idempotency where retry can duplicate effects.

## Core resource groups

```text
/auth/session
/users /role-assignments /parent-child-links /consents
/programmes /courses /cohorts /enrolments
/content /activities /activity-versions /reviews
/assignments /essay-questions /rubrics /attempts /submissions /grades /completion
/canvas-documents /canvas-versions /canvas-comments /canvas-exports
/assets
/invoices /payment-intents /payments /reconciliation
/sponsorship-programmes /aggregate-reports
/notifications /notification-preferences
/infrastructure-providers /webhooks /reconciliation-jobs
/audit-events /privacy-requests /safeguarding-reports
```

The 60-day release exposes only endpoints required by `SCOPE_60_DAYS.md`. Finance, generic webhooks, advanced canvas tools, and advanced analytics remain unavailable.

Month 3 may expose finance, notification, annotation-canvas, essay/rubric, export, and aggregate-analytics endpoints listed in `SCOPE_90_DAYS.md`. Do not create a generic unauthenticated webhook or external learning-provider endpoint.

## Annotation canvas endpoints

- Create a question canvas from blank pages, safe images, or rendered PDF backgrounds.
- Start/resume a student attempt and retrieve only authorised layers.
- Autosave operation batches with document version and optimistic concurrency.
- Lock and submit idempotently; resubmission creates a linked new version.
- Open teacher grading workspace with immutable student work and separate feedback.
- Save anchored comments, rubric decisions, partial marks, and release state.
- Render authorised PNG/PDF snapshots asynchronously using signed access.
- Compare versions and retrieve an audited replay event range.

## Interactive activity endpoints

- Create/update draft activity definition.
- Validate and preview a draft.
- Submit, review, request changes, approve, publish, archive.
- Start/resume an authorised attempt.
- Save allowed progress with optimistic concurrency.
- Submit once with an idempotency key.
- Retrieve own/authorised released feedback and grade.
- Regrade/override only with permission and reason.

The server selects the trusted scoring strategy from `activity_type`; it never accepts a score calculated by the browser as authoritative.

## Security

- Verify Supabase JWT issuer, audience, signature, expiry, revocation/session state, and MFA requirement.
- Resolve current role assignments from authoritative data; JWT claims may accelerate but never permanently override revocation.
- Apply object policy before retrieval and response-field filtering after it.
- Webhooks require signature, timestamp window, replay protection, idempotency, schema validation, and audit.
- Never return secrets, answer keys before release, internal storage paths, other learners' metadata, or verbose production errors.
