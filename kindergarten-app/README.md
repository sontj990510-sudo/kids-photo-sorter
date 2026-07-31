# Giving Tree Kindergarten UI Prototype

This folder contains the free, front-end-only prototype for the future Giving
Tree kindergarten app.

The existing production photo sorter remains in `../app` and is intentionally
not imported, changed, or deployed by this prototype.

## Included in this phase

- animated Giving Tree forest intro
- login and four-step signup request flow
- approval-pending screen
- director, teacher, and parent home screens
- notice, class note, meal, album, photo workflow, notification, permission,
  and audit-log mock screens
- graduation/withdrawal request and recoverable archive flow
- shared high-risk action confirmation dialog
- keyboard focus, reduced-motion support, mobile safe areas, and 320px layouts

All data is fictional and stays in memory. Only the selected demo role is kept
in `sessionStorage` until the tab is closed. Do not enter real child, parent,
teacher, phone, or photo data.

## Explicitly not connected

- SMS or phone OTP
- Supabase Auth, Database, or Storage
- cloud photo upload
- real push delivery
- paid face-recognition services
- Apple App Store or Google Play publishing
- paid domains, fonts, illustrations, or monitoring

These services will be reviewed with expected costs before they are connected.

## Run locally

```bash
npm install
npm run dev
```

Validate before committing:

```bash
npm run lint
npm run build
```

The CI workflow checks this folder but never deploys it to the production
Giving Tree URL.
