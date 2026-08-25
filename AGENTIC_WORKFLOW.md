# AKADEMI Digital Campus — Agentic AI Operating Workflow

## Coordination model

Use one lead agent accountable for architecture, integration, final verification, and progress reporting. Parallel agents may work on independent bounded tasks:

- Frontend and accessibility.
- Django API and business policies.
- Supabase migrations, RLS, storage, and security.
- QA, E2E, documentation, migration, and operations.

The lead agent owns shared contracts. Agents must not concurrently edit the same files or schema areas without explicit coordination.

## Work-item format

Every task records:

```text
Objective
In scope / out of scope
Dependencies
Files and domains owned
Data/privacy impact
Acceptance tests
Rollback
Evidence produced
Status and blockers
```

## Execution loop

1. Select the highest-priority unblocked vertical slice for the current gate.
2. Inspect existing code, migrations, tests, and uncommitted changes.
3. Confirm API/schema/policy contracts before parallel work.
4. Implement frontend, API, database/RLS, audit, and tests as one coherent slice.
5. Integrate daily and run the shared test suite.
6. Record evidence and update documentation.
7. Close the gate early when all criteria and approvals pass; otherwise report the exact blocker.

## Status values

`not_started`, `in_progress`, `in_review`, `blocked_internal`, `blocked_external`, `gate_ready`, `accepted`, `rolled_back`.

Payment/email/WhatsApp infrastructure adapters additionally use `sandbox_ready`, `live_blocked_external`, and `live_verified`. Native learning features never use these statuses because they have no external LMS dependency.

## Prohibited agent behaviour

- Do not rewrite architecture or add frameworks without approval.
- Do not bypass tests/approvals to meet dates.
- Do not invent payment/messaging credentials, provider capabilities, legal approval, test results, or completion.
- Do not use production child data in development or demos.
- Do not merge conflicting migrations or broad generated rewrites without review.
- Do not mark percentage complete without linking concrete accepted evidence.
- Do not start out-of-scope features while current-gate critical defects remain.

## Early-finish behaviour

Agents are authorised to move ahead of schedule. They must retain a recoverable checkpoint, update the plan, notify the owner of the early gate closure, and begin the next approved work without waiting for the calendar date.
