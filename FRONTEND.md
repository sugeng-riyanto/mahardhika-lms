# AKADEMI Digital Campus — React Frontend Specification

## Stack

React + TypeScript strict mode + Tailwind CSS + Vite. Do not add Vue, HTMX, Alpine.js, Django Templates as the primary UI, or untyped JavaScript.

## Application shell

- Responsive navigation, breadcrumbs, authorised search, notifications, language switch, profile/session/MFA status, help, and accessibility preferences.
- Route/menu visibility follows server-authorised role/scope; hidden UI never replaces backend authorization.
- Every page provides loading, empty, error, forbidden, conflict, offline, retry, and success states.

## Primary screens

- Authentication: login, recovery, invitation, MFA, session management, logout.
- Owner: governance aggregates, audit/risk summaries, programmes, approvals.
- Admin: users, roles/scopes, parent links, courses, enrolments, review, configuration, audit.
- Treasurer: invoices, payments, reconciliation, finance exports; no academic/canvas data.
- Instructor: courses, authoring, essay/canvas builder, submissions, attendance, gradebook, feedback, analytics.
- Student: courses, learning path, activities, essay/canvas workspace, assignments, progress, grades, certificates.
- Parent: linked-child released progress, attendance, work, feedback, certificates, and permitted invoices.
- Sponsorship: threshold-protected aggregates without learner drill-down.
- Third Party: explicit infrastructure-support scope only; otherwise denied.

## Key learning screens

- Course overview, modules/lessons, progress, prerequisites, native activities, interactive video, assignments, essays, attendance, gradebook, certificates.
- Authoring Studio with trusted activity palette, content tree, canvas/essay builder, properties, preview, review/publish, versions, accessibility, and attribution.
- Grading workspace with question/student/teacher layers, pages, tools, rubric, anchored comments, remaining marks, moderation, comparison, replay, release preview, and export.

## Design system

- Navy primary, cyan/teal learning, violet authoring, orange actions, green success, red danger, neutral surfaces.
- Use icons/text with semantic colour; never colour alone.
- Consistent typography, spacing, focus rings, controls, tables, forms, dialogs, toasts, and status badges.
- WCAG 2.2 AA baseline and Indonesian/English strings without clipping.

## Responsive behaviour

- Desktop: full navigation and side-by-side authoring/grading panels.
- Tablet: collapsible panels and stylus/touch-first canvas controls.
- Mobile: stacked learning journeys and full-screen student canvas; complex teacher authoring may recommend a larger screen.

## State and API

- Typed generated API client and one approved server-state library.
- Autosave canvas/essay operation batches with visible save/conflict state.
- Never broadly cache restricted responses or canvas layers in the PWA.

## Frontend tests

- Role/scope navigation and forbidden states.
- Keyboard/focus/screen-reader landmarks and accessible errors.
- Responsive layouts and bilingual strings.
- Stylus/mouse/touch, autosave/recovery/conflict, submit lock, layer isolation, and feedback release.
- No secrets, answer keys, hidden rubrics/model answers, or other learner data in source maps, payloads, logs, or cache.
