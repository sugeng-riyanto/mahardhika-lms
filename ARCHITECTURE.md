# AKADEMI Digital Campus — Technical Architecture

## System topology

```text
Browser/PWA
  → React + TypeScript + Tailwind + Vite
  → Django REST API
      → Supabase PostgreSQL
      → Supabase Auth
      → Supabase private Storage
      → Celery/Redis workers
      → Payment/email/WhatsApp adapters
```

React never connects with privileged database credentials. Direct Supabase browser access is limited to explicitly designed, RLS-protected use cases; sensitive operations always pass through Django.

## Repository

```text
frontend/       React application, activity plugins, tests
backend/        Django project/apps, services, policies, tests
supabase/       SQL migrations, RLS, storage policies, seeds
workers/        Celery media, canvas export, notification and finance jobs
docs/           architecture, decisions, API and runbooks
infrastructure/ deployment and observability configuration
```

## Backend domains

`identity`, `organisations`, `programmes`, `courses`, `content`, `activities`, `essays`, `canvas`, `attempts`, `gradebook`, `consent`, `safeguarding`, `finance`, `sponsorship`, `notifications`, `audit`.

Cross-domain changes use explicit services and transactional boundaries. Background work uses an outbox/event pattern where consistency matters.

## Frontend structure

```text
src/app/          bootstrap, routing, providers
src/features/     domain features
src/components/   shared accessible UI
src/activity/     trusted plugin registry, editors, renderers
src/canvas/       annotation engine, tools, layers, replay, exports
src/essay/        authoring, rubric and grading workspace
src/api/          generated/typed API client
src/auth/         session and route guards
src/styles/       Tailwind tokens
src/test/         fixtures and utilities
```

## Environments and delivery

Separate local, test, staging, and production. CI runs formatting, lint, strict type checks, tests, migrations, security scans, build, and preview. Production uses reviewed migrations, feature flags, backups, health checks, metrics/tracing, and tested rollback.

For the 60-day release, use managed services and one deployable Django API plus one React application. Avoid microservices, Kubernetes, custom identity infrastructure, and premature event-bus complexity. Celery/Redis handles video processing, notifications, report generation, and other retryable jobs.

Month 3 retains the same modular-monolith architecture. Add annotation-canvas modules, PDF/image export workers, payment/notification adapters, reconciliation workers, PWA cache rules, and analytics views without splitting into microservices. Every cached route must be classified; restricted learner or canvas data is never broadly cached for offline use.
