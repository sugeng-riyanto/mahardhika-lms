# AKADEMI Digital Campus — Math–Physics Annotation Canvas

## Purpose

Provide a native React/TypeScript workspace where teachers create mathematics/physics essay questions, students write or draw solutions, and teachers annotate/grade without changing the student's original submission.

This is an AKADEMI feature. It is not Canvas LMS integration and does not use Coursera, Edpuzzle, H5P, Moodle, LTI, or external learning credentials.

## Layer model

```text
Layer 1 — Question
  teacher-owned; immutable after publication

Layer 2 — Student work
  editable by the assigned student before submission;
  immutable after submission

Layer 3 — Teacher annotation
  editable by assigned instructor/marker;
  hidden until feedback release

Layer 4 — Rubric and score
  server-authoritative; separately versioned and audited
```

Never flatten these layers into the authoritative record. Store structured JSON and create PNG/PDF only as derived snapshots/exports.

## Canvas tools

### Core tools

- Select, move, resize, group, duplicate, and delete within authorised layer.
- Pen, pencil, highlighter, eraser, text, line, arrow, rectangle, ellipse, polygon, and connector.
- Undo/redo, zoom, pan, fit page, page thumbnails, colour, opacity, stroke width, and object ordering.
- Stylus pressure where supported, mouse/touch input, palm-rejection hints, and configurable gesture behaviour.
- Safe image insertion and rendered PDF page backgrounds.
- Autosave status, offline/connection indicator, recovery, and manual checkpoint.

### Mathematics tools

- LaTeX/equation input and rendered equation objects.
- Fractions, powers, roots, matrices, vectors, calculus symbols, and aligned working.
- Coordinate grids, labelled axes, scales, points, lines, curves, regions, and function plots.
- Ruler, protractor, compass-style circle construction, geometric shapes, and measurement labels.
- Table, working-step number, and final-answer box.

### Physics tools

- Vector arrows and components.
- Free-body diagrams with labelled forces.
- Circuit symbols/connectors and current/voltage labels.
- Ray, lens/mirror, normal, angle, wave, phase, and oscillation diagrams.
- Motion/force/energy/electric-field graph templates.
- Data tables with units and uncertainty.
- Gradient triangle, tangent, best-fit line, intercept, error bar, and significant-figure/unit annotations.

## Document contract

```json
{
  "schema_version": 1,
  "document_id": "uuid",
  "attempt_id": "uuid",
  "page_size": {"width": 1240, "height": 1754},
  "pages": [],
  "layers": [
    {"type": "question", "objects": []},
    {"type": "student", "objects": []},
    {"type": "teacher", "objects": []}
  ],
  "document_version": 1,
  "submitted_version": null
}
```

Schemas must reject unknown executable content, unsafe URLs, prototype-pollution keys, invalid coordinates, excessive object counts, oversized payloads, and layer mutations outside role permission.

## Autosave and concurrency

- Send validated operation batches, not the full document for every stroke.
- Include document version, operation ID, actor, layer, client timestamp, and idempotency key.
- Server validates authorization and applies operations transactionally.
- Detect stale versions and return a resolvable conflict; never silently overwrite newer work.
- Keep local recovery journal for unsent approved student-draft operations.
- Display saved, saving, offline, conflict, and recovery states clearly.
- Compact operation history into snapshots without deleting required audit/version evidence.

## Submission and grading

1. Student submits with an idempotency key.
2. Server validates enrolment, deadline, attempt state, document version, and required content.
3. Server locks/checksums the student layer and records submission time.
4. Teacher receives read-only question/student layers and an editable annotation layer.
5. Rubric and score are stored separately through server-authoritative endpoints.
6. Feedback release publishes the permitted annotation/rubric snapshot to Student and linked Parent.
7. Resubmission creates a new attempt/version and preserves the previous submission.

## Replay and comparison

- Replay uses minimised authorised operation history and excludes secrets/hidden layers.
- Version comparison identifies added, changed, moved, and removed objects by stable object ID.
- Teacher may compare attempts; Student may compare own attempts after policy permits; Parent sees only released versions.
- Sponsorship, Treasurer, and unrelated Third Party never receive individual canvas/replay data.

## Accessibility

- Keyboard-operable toolbar and logical focus order.
- Accessible names, shortcuts help, focus indication, and announcements for save/submit/conflict states.
- Text/LaTeX alternative for drawings where possible.
- Teacher-provided textual description for essential diagrams.
- Transcript/table alternative for graph/diagram questions when required.
- Do not make colour, handwriting, or pointer precision the only way to answer.

## Security and privacy

- Enforce layer permissions in Django and Supabase RLS/storage.
- Sanitize text/LaTeX and render safely; never execute embedded HTML/JavaScript.
- Validate image/PDF signatures, MIME, size, pages, metadata, malware status, and object paths.
- Use private storage and short-lived signed URLs.
- Prevent IDOR, cross-attempt access, export leakage, answer-key exposure, object amplification, replay abuse, and denial-of-service payloads.
- Audit submit, unlock/exception, annotation, rubric, override, feedback release, export, deletion/restriction, and privileged reads.

## Acceptance tests

- Stylus/mouse/touch and keyboard paths.
- Refresh, offline, reconnect, duplicate operation, stale version, crash recovery, conflict, and large-document behaviour.
- Submit lock, late submit, resubmission, teacher annotation isolation, release/unrelease, regrade, and export.
- Cross-user, cross-child, cross-course, cross-layer, signed-URL, replay, and snapshot/export leakage.
- LaTeX, graph, vector, circuit, ray, wave, table, uncertainty, gradient, and best-fit tools.
- Exact restoration from authoritative JSON and consistent authorised PDF/PNG render.
