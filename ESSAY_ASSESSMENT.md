# AKADEMI Digital Campus — Essay Assessment and Rubric Specification

## Purpose

Support structured mathematics/physics essays and worked solutions where the quality of reasoning, diagrams, method, units, and explanation matters—not only the final answer.

## Question authoring

An essay question may contain:

- Rich text and safely rendered LaTeX.
- Images and rendered PDF pages.
- Data tables, graphs, diagrams, and canvas response regions.
- Marks, learning objectives, curriculum tags, difficulty, expected time, and command word.
- Teacher-only marking guidance, model answer, acceptable alternatives, common errors, and answer-release policy.
- Rubric version and moderation requirements.

Published question versions are immutable. Editing creates a new version without changing existing attempts.

## Student response modes

- Typed rich text with LaTeX.
- Full annotation-canvas response.
- Mixed typed and canvas sections.
- Approved document/image upload where policy permits.
- Accessible alternative response configured by Instructor/Admin.

The system must identify which response is authoritative and preserve all submitted versions.

## Attempt lifecycle

```text
draft
→ published
→ in_progress
→ submitted
→ locked
→ grading
→ moderated (optional)
→ returned
→ resubmitted (optional new version)
→ finalised
```

Only explicit policy actions may reopen/unlock a submission, and each action requires reason, actor, scope, timestamp, and audit.

## Rubric models

Support:

- Analytic rubric with weighted criteria and performance levels.
- Point-based marking with partial credit.
- Holistic rubric where appropriate.
- Criterion-level comments and anchored canvas comments.
- Moderation/second marking and discrepancy resolution.
- Grade override/regrade with mandatory reason and history.

## Recommended Physics rubric template

| Criterion | Example evidence |
| --- | --- |
| Principle/concept | Correct physical law or model identified |
| Equation/method | Appropriate equation or reasoning route |
| Substitution | Correct values, signs, conversions, and symbols |
| Calculation | Correct manipulation and numerical work |
| Units/SF/uncertainty | Unit, significant figures, uncertainty treatment |
| Diagram/graph | Correct labels, scale, direction, best-fit/tangent where needed |
| Explanation/conclusion | Clear reasoning linked to physics evidence |

Teachers configure marks and weights per question; the template does not impose a universal total.

## Recommended Mathematics rubric template

| Criterion | Example evidence |
| --- | --- |
| Interpretation | Correct identification of known/required quantities |
| Method | Valid strategy or theorem |
| Working | Logical, traceable steps |
| Accuracy | Algebra/arithmetic/calculus accuracy |
| Representation | Graph, notation, diagram, domain, labels |
| Conclusion | Valid final statement and required form |

## Marking workspace

- Display question and immutable student answer beside/under the teacher annotation layer.
- Show rubric, allocated/remaining marks, anchored comments, general feedback, internal moderation notes, and release controls.
- Autosave teacher work independently from student work.
- Prevent scores above maximum or inconsistent rubric totals.
- Preview exactly what Student and Parent will see before release.

## Moderation and academic integrity

- Support blind marking identifiers where configured.
- Allow second marker and discrepancy workflow without exposing unrelated learner data.
- Preserve original response and marker histories.
- Similarity or AI-assisted review may only flag for human review; it cannot make high-stakes decisions automatically.
- Do not infer misconduct solely from drawing replay, speed, handwriting, or device behaviour.

## Feedback release

- Teacher chooses immediate, scheduled, after-all-marked, or manual release according to course policy.
- Student sees own released rubric, comments, annotations, score, and permitted model answer.
- Linked Parent sees only the released summary/detail permitted by school policy.
- Sponsorship receives aggregates only; Treasurer and Third Party receive no essay/canvas content.

## Export and retention

- Export an authorised PDF containing question, student response, released annotations, rubric, score, attribution, timestamps, and verification reference.
- Keep structured data authoritative and apply retention/restriction/legal-hold rules by category.
- Watermark or label exports when appropriate; signed links expire.

## Acceptance criteria

- Rubric weights/totals, partial marks, moderation, override, regrade, release, and resubmission are correct.
- Student answer cannot be changed by Teacher/Admin after submission except through an audited exceptional workflow that preserves the original.
- Hidden model answers, internal notes, other markers, and other students never leak.
- Parent, Sponsor, Treasurer, Third Party, and unrelated Instructor restrictions pass through UI, API, RLS, storage, exports, notifications, and logs.
- Accessibility, bilingual labels, backup/restore, version replay, and PDF export pass.
