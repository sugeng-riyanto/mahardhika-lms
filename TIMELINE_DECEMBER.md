# AKADEMI Digital Campus — Timeline to December 2026

## Calendar

| Milestone | Latest target | Outcome |
| --- | --- | --- |
| Project start and scope freeze | 24–28 Aug 2026 | Architecture, owners, environments, risks, and scope approved |
| Staging online | 30 Aug 2026 | React/Django/Supabase CI deployment operational |
| Core pilot | 22 Sep 2026 | RBAC, course, basic activities, gradebook, parent/sponsor-safe views |
| Production v1 | 23 Oct 2026 | Assignment, attendance, six activities, basic essay/canvas, video, progress, certificate |
| Production v2 feature complete | 22 Nov 2026 | Advanced Math–Physics canvas, rubric/annotation/replay/export, finance, messaging, analytics, PWA |
| Release candidate/UAT | 30 Nov–7 Dec 2026 | Whole-school role-based acceptance and training |
| Migration/operational acceptance | 8–14 Dec 2026 | Reconciliation, restore/rollback, monitoring and incident drills |
| Final handover | 20 Dec 2026 | Signed production release and ownership transfer |
| Contingency buffer | 21–31 Dec 2026 | Critical fixes/support only |

## Acceleration rule

Every target is a **latest acceptable date**. An agent may close a milestone early and begin the next one immediately if:

- All required code and migrations are reviewed.
- CI, unit, integration, contract, RLS/storage, and critical E2E tests pass.
- Security, accessibility, privacy/safeguarding, backup/restore, and rollback evidence required by that gate exists.
- Documentation and runbooks are current.
- Required human owner approval has been recorded.
- The prior deployable checkpoint remains recoverable.

No minimum waiting period exists.

## Acceleration priorities

If ahead of schedule, use capacity in this order:

1. Resolve security/privacy/accessibility defects.
2. Expand negative RBAC/RLS and recovery tests.
3. Rehearse migration, reconciliation, backup, and rollback.
4. Improve performance, observability, and operational documentation.
5. Conduct earlier UAT and training.
6. Pull forward approved next-phase features.

Do not spend early capacity on out-of-scope frameworks, native apps, public marketplace, arbitrary plugins, or unapproved AI features.

## Delay response

If a gate slips, protect RBAC, privacy, safeguarding, student-work integrity, backup, and rollback. Disable or defer affected optional payment/messaging infrastructure through feature flags. Never weaken native canvas/assessment evidence to claim completion.
