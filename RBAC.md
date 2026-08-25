# AKADEMI Digital Campus — RBAC Matrix

Legend: `G` global/governance, `C` assigned course, `L` linked child, `O` own, `A` approved aggregate, `X` contracted/time-bound, `—` denied.

| Capability | Owner | Admin | Treasurer | Instructor | Student | Parent | Sponsorship | Third party |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Configure system/integrations | Approve | G | — | — | — | — | — | X support only |
| Manage users/role assignments | Oversight | G except ownership | — | — | — | — | — | — |
| Manage programmes/courses | Oversight | G | — | C content | — | — | — | — |
| Create/edit activity draft | — | G/C support | — | C | — | — | — | X contracted content only |
| Review/publish activity | Oversight | G/C | — | C if separation permits | — | — | — | — |
| Attempt activity | — | Test account | — | Preview | O assigned | — | — | — |
| View individual responses | Break-glass only | Audited support | — | C | O | L released summary | — | X pseudonymous diagnostics |
| Create essay/canvas question | — | G/C support | — | C | — | — | — | — |
| Edit student canvas layer | — | — | — | — | O before submit | — | — | — |
| Annotate/mark submitted canvas | — | Emergency support only | — | C assigned | — | — | — | — |
| View released canvas feedback | Governance aggregate only | Audited support | — | C | O | L released | — | — |
| Export individual canvas/PDF | Exceptional approval | Audited support | — | C | O | L released | — | — |
| Grade/regrade | — | Emergency support | — | C | — | — | — | — |
| View/export academic report | Governance aggregate | Restricted/audited | — | C | O | L released | A only | X approved only |
| Manage invoices/payments | Governance summary | Operational support | G | — | Own invoice | L invoice | Fund summary | X payment processor |
| View safeguarding records | Escalated oversight | Assigned safeguarding admin | — | Assigned case minimum | Own reporting channel | Linked-child process only | — | X statutory/contractual only |
| Download source/content package | Approve policy | G/C | — | C if licence allows | — | — | — | X deliverable only |
| Archive/delete content | Approve policy | G/C under retention | — | Request/archive within C | — | — | — | — |

For the 60-day release, finance/payment processing remains disabled. Treasurer receives licence/budget summary placeholders without academic access; Third Party has no active production login unless an explicit, expiring technical-support scope is approved.

In Month 3, Treasurer receives invoice/payment/reconciliation permissions within finance scope. Third Party may operate only approved payment/messaging infrastructure through an expiring service grant. Neither role gains academic responses, canvas work, raw analytics, counselling, health, or safeguarding access.

## Authorization formula

```text
allow = active_account
    AND permission
    AND valid_role_assignment
    AND valid_scope
    AND current_relationship
    AND approved_purpose
    AND consent_or_other_lawful_basis_when_required
    AND resource_state_allows_action
    AND no_security_or_safeguarding_hold
```

Evaluate before fetching data. Apply equivalent RLS as defence in depth. Browser checks never grant authority.

## Required denial tests

- User/course/activity/attempt/grade identifier substitution.
- Cross-child, cross-course, cross-programme, and cross-sponsor access.
- Expired/revoked roles, parent links, consent, and third-party grants.
- Draft/archived/deleted resource access.
- Indirect leakage through search, autocomplete, notifications, exports, analytics, logs, storage paths, and error messages.
