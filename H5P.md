# AKADEMI Native Interactive Engine — Inspiration Specification

## Decision

AKADEMI builds its own focused interactive engine using React + TypeScript and Django. H5P is one design inspiration only—not a runtime, editor, account, library manager, package format, importer, exporter, or database dependency.

## Scope boundary

Build by Day 60: multiple choice, multiple select, true/false, image hotspot, drag-and-drop, and interactive video. In Month 3 add branching scenario and interactive presentation/book composition using existing trusted primitives. External package compatibility, marketplace, and arbitrary plugins remain excluded.

## Architecture

```text
React Authoring Studio
→ versioned activity-definition JSON
→ Django schema validation and publication workflow
→ React renderer selected from trusted registry
→ attempt-state API
→ Django scoring strategy
→ gradebook/completion
→ minimised analytics and audit
```

## Activity contract

```json
{
  "schema_version": 1,
  "type": "multiple_choice",
  "title": "Example",
  "learning_objectives": [],
  "language": "en",
  "settings": {},
  "content": {},
  "grading": {},
  "accessibility": {},
  "licence": {},
  "assets": []
}
```

Validate independently in TypeScript and Python using shared fixtures. Published versions are immutable and referenced by every attempt.

## Plugin registry

Each built-in plugin supplies definition types/schema, authoring form, preview, renderer, Python validator/scorer, attempt state machine, event allowlist, accessibility statement/fallback, schema migration, and tests. Plugins are bundled and reviewed at build time; never load remote or uploaded JavaScript.

## Lifecycle and grading

Use `draft → in_review → changes_requested → approved → published → archived`. Publication requires valid schema, trusted plugin, learning objective, licence, age suitability, accessibility review, grading rule, and preview tests. Material edits create a new version.

Attempt states are `not_started`, `in_progress`, `submitted`, `graded`, and `voided`. The server owns timing, limits, scoring, completion, overrides, and final status. Use idempotency keys. Never determine mastery from clicks or time alone.

## Media, security, and child protection

- Private storage, MIME/signature validation, image/video quotas, scan status, metadata removal where required, asynchronous video processing, captions/transcripts, thumbnails, and short-lived URLs.
- Sanitize rich text and allowlist URLs, origins, HTML features, and embeds.
- Prevent XSS, IDOR, CSRF, SSRF, malicious SVG, oversized uploads, answer-key leakage, and cross-course access.
- No advertising, trackers, public comments, direct sponsor contact, or unnecessary voice/image/free-text collection.
- Parent sees released linked-child summaries; sponsor sees disclosure-controlled aggregates.

## External-format rule

Do not import or execute H5P packages/libraries. Content exchange uses AKADEMI's documented JSON schema and safe media files only.

## Definition of done

Authoring, preview, publication, versioning, resume, retry, scoring, regrade, accessibility, mobile, localization, malicious input, scope isolation, analytics minimisation, archive, restore, and migration tests pass.
