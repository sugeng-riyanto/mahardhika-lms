# AKADEMI Digital Campus — Deployment and Handover Checklist

## Before staging

- [ ] Environment variables and secret ownership documented.
- [ ] No service-role secret in frontend/build artifacts.
- [ ] Migrations, RLS, grants, storage policies, and synthetic seeds reviewed.
- [ ] CI formatting, lint, strict types, unit/integration tests, and build pass.
- [ ] Error handling, health checks, audit, and basic monitoring enabled.

## Before production release

- [ ] Release scope and feature flags approved.
- [ ] Database backup and restore test pass.
- [ ] Migration dry-run, reconciliation, rollback, and capacity baseline pass.
- [ ] Eight-role E2E and negative authorization tests pass.
- [ ] Upload, storage, annotation canvas, PDF export, payment, webhook, worker, notification, and provider-outage tests pass where applicable.
- [ ] Privacy, safeguarding, accessibility, and security review findings are closed or formally release-blocking.
- [ ] Incident contacts, support hours, escalation, and rollback authority confirmed.
- [ ] Privacy notice, consent text, acceptable-use policy, and retention rules published.

## Deployment

- [ ] Announce maintenance/change window.
- [ ] Confirm backup timestamp and rollback release.
- [ ] Apply reviewed migrations once.
- [ ] Deploy Django API/workers, then React build.
- [ ] Verify health, authentication, MFA, role resolution, RLS/storage, queues, and critical journeys.
- [ ] Enable features progressively and monitor errors/denials/latency.
- [ ] Reconcile users, enrolments, grades, payments, certificates, and integration events.

## Handover

- [ ] Source repository and branch protections transferred.
- [ ] Supabase, hosting, domain/DNS, email/WhatsApp/payment, monitoring, and backup ownership verified.
- [ ] No personal agent/developer credential remains required.
- [ ] Admin, teacher, finance, privacy/safeguarding, and support training completed.
- [ ] Architecture, API, database, RBAC, runbooks, release notes, known limitations, and support backlog delivered.
- [ ] Acceptance and rollback decision signed.

## Faster release

This checklist may be completed before the scheduled date. Early deployment is permitted only when every applicable checkbox has evidence and required human approval. Empty calendar time is never a release requirement; empty evidence is always a release blocker.
