# Giving Tree account lifecycle and safety rules

## Core separation

The product must not use one ambiguous "delete account" action for every case.
Three different operations are required:

1. **End enrollment** — graduate, withdraw, or transfer a child and stop new
   class/photo assignments.
2. **Suspend app access** — temporarily prevent a staff member or guardian from
   signing in while retaining a recoverable record.
3. **Permanently erase data** — delete or anonymize data only after the
   retention policy and recovery window have been satisfied.

A child is an enrollment profile, not a login account. If a guardian has two
children and one graduates, the guardian account and the other child
relationship must remain active.

## Recommended states

| Record | States |
|---|---|
| Membership | `pending_approval → active ↔ suspended → ended → anonymization_scheduled → anonymized` |
| Enrollment | `pending → active ↔ on_leave → ended → archived` |
| Guardian link | `pending → active → read_only → ended/revoked` |
| Staff/class assignment | `scheduled → active → ended` |
| Post/photo | `draft → published → unpublished → trashed → purged` |
| Risk action | `requested → approved → scheduled → executed`, or `canceled/failed` |

Returning children receive a new enrollment record rather than overwriting
their previous enrollment history.

## Role boundaries

### Director

- approve or reject signup requests
- assign classes, children, guardians, and teachers
- suspend and restore access
- approve graduation or withdrawal
- grant scoped permissions with an expiration date
- cancel deletion schedules
- view append-only audit events

The final remaining director cannot suspend, delete, or demote their own
account until another director has accepted responsibility.

### Teacher

- view assigned classes only
- write assigned-class notes
- classify, review, and publish assigned-class photos
- request enrollment closure

Teachers cannot permanently erase an account or child, grant themselves
permissions, view another class, change director roles, or edit audit events.
Even a teacher delegated enrollment-management permission sends a request that
requires director approval.

## Risk controls

| Risk | Examples | Required control |
|---|---|---|
| Low | discard draft edit | 10-second undo |
| Medium | unpublish post, unlink guardian | impact summary and recoverable trash |
| High | end enrollment, suspend teacher, change permission | reason, effective date, impact summary, re-authentication |
| Critical | permanent erase, transfer director role | type target name, re-authenticate, schedule with recovery delay |

Additional rules:

- destructive buttons live in a separate "Management and archive" area
- labels describe the result, such as "Schedule Harin's enrollment end"
- cancel is the default focus and permanent actions are never one-click
- double submission is blocked and each server request uses an idempotency key
- execution re-checks current permissions and record state
- risky actions never queue for offline execution
- state, permission, and audit writes happen in one server transaction
- bulk graduation may exist; bulk permanent deletion must not
- deleted or suspended users lose access immediately on the server, even if an
  old screen is still open
- audit events never contain passwords, OTP values, or face embeddings

The prototype uses a 30-day recovery window only as a visible example. The
operational retention and deletion periods must be finalized with the privacy
policy before launch.

## Photo-specific rules

- face embeddings stay on the authorized teacher device
- AI suggestions are never published automatically
- a teacher confirms every photo-child relationship before upload
- private storage and row-level access rules restrict guardians to linked
  children
- EXIF and location metadata are removed before upload
- group photos check the consent status of every visible child
- ending enrollment clears the child's local face profile and caches on
  authorized teacher devices
- suspending a staff member clears all kindergarten local data on that device
- exported backups and guardian-saved photos cannot be remotely recalled, so
  the user receives a clear notice before export or sharing

## Free-only phase

The current phase uses React, TypeScript, CSS/SVG assets, and fictional local
data. It makes no paid API calls and contains no production keys.

Potential costs that require a separate decision later include SMS OTP, photo
storage/egress beyond free tiers, bulk messaging, Apple and Google developer
registration, a custom domain, legal/privacy review, and paid monitoring.
