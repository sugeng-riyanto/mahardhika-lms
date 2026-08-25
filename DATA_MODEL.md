# AKADEMI Digital Campus — Data Model Blueprint

## Identity and authorization

`users`, `profiles`, `organisations`, `roles`, `permissions`, `role_assignments`, `scopes`, `parent_child_links`, `third_party_grants`, `consent_records`.

Role assignments include user, role, scope type/id, validity period, status, approver, and reason. Parent links require verification state and validity. Use UUID primary keys and database constraints.

## Learning

`programmes`, `courses`, `course_offerings`, `cohorts`, `enrolments`, `lessons`, `content_items`, `activity_definitions`, `activity_versions`, `activity_reviews`, `activity_assignments`, `essay_questions`, `rubrics`, `rubric_criteria`, `attempts`, `responses`, `grades`, `grade_events`, `completion_records`, `competencies`, `certificates`.

An attempt references an immutable `activity_version_id`. Grade events append history; the current grade is derived or updated transactionally without destroying provenance.

## Annotation canvas

`canvas_documents`, `canvas_pages`, `canvas_layers`, `canvas_objects`, `canvas_operation_batches`, `canvas_snapshots`, `canvas_comments`, `canvas_versions`, `canvas_exports`, `rubric_assessments`, `rubric_scores`.

The authoritative submission is structured, versioned JSON. Question, student work, teacher feedback, and rubric/score are separate immutable or permission-controlled layers. PNG/PDF exports are derived artifacts. Every submitted version is checksummed and linked to its attempt.

## Media and content governance

`assets`, `asset_variants`, `licences`, `attributions`, `content_tags`, `content_lineage`, `accessibility_reviews`, `safeguarding_reviews`.

Store object keys rather than public URLs. Metadata includes owner, MIME, size, checksum, scan state, retention class, and deletion state.

## Operations

`audit_events`, `outbox_events`, `infrastructure_provider_accounts`, `webhook_receipts`, `notifications`, `privacy_requests`, `security_incidents`, `safeguarding_reports`, `retention_jobs`.

## Finance and sponsorship

`invoices`, `invoice_items`, `payments`, `payment_events`, `sponsorship_programmes`, `fund_allocations`, `aggregate_reports`.

Separate finance from academic and safeguarding schemas/permissions. Sponsor reports are generated from disclosure-controlled aggregate views, never raw learner tables.

During the 60-day release, implement sponsorship programmes and approved aggregate views. Finance/payment tables remain backlog designs and are not exposed through production APIs.

Month 3 implements invoices, payment intents/events, refunds where supported, reconciliation batches, notification templates/deliveries, canvas operations/snapshots/exports, essay rubrics, and replay metadata. Store provider references and minimum necessary payload hashes rather than unnecessary raw personal data.

## Database rules

- Foreign keys, unique constraints, checks, indexes, UTC timestamps, created/updated actor, and soft-delete only where justified.
- RLS on exposed tables; restricted data in non-exposed schemas.
- No sensitive free text in audit or analytics.
- Retention class and legal/security hold override deletion scheduling.
- Seed only roles, permissions, activity types, and synthetic development data.
