# Complete backend migration to your own Supabase project

## Goal
Move Edusanna’s database, authentication, privileged operations, scheduled work, and deployment configuration away from Lovable Cloud. Keep the current interface and user workflows, use email/password plus native Google sign-in, preserve user IDs and password hashes where the source export permits it, and prepare an immediate Vercel cutover.

## Important boundary
Installing the Supabase CLI does not create a production project inside your personal Supabase account. I can make the application and migration package ready, rehearse it locally, and remove runtime Lovable dependencies. The final production switch requires a target Supabase project owned by you and its credentials supplied securely. I will not invent credentials, expose secrets, or claim the migration is complete before the target project and major workflows are verified.

## What I will build

### 1. Capture a reproducible backend baseline
- Create a canonical baseline migration for all current public tables, enums, indexes, grants, RLS policies, functions, and triggers; the existing migration folder contains only later patches and cannot initialize a fresh project by itself.
- Preserve the final hardened permissions, including role checks and restricted security-definer functions.
- Add verification SQL for table counts, relationships, policies, grants, functions, and triggers.
- Keep production data untouched while preparing and rehearsing this package.

### 2. Build data and authentication transfer tooling
- Add export/import scripts and an ordered manifest for every application table.
- Preserve existing UUIDs so profiles, enrollments, progress, payments, certificates, roles, schools, and audit records remain connected.
- Add an Auth migration script designed for Supabase-to-Supabase password-hash import where supported, plus a safe forced-password-reset fallback for records the target Auth API rejects.
- Exclude active sessions, refresh tokens, MFA factors, and OAuth grants from transfer; these cannot be safely carried between projects. Users will sign in again after cutover, and Google users will relink through the new project.
- Add reconciliation reports for row counts, orphaned references, duplicate emails, and role ownership.

### 3. Remove runtime Lovable dependencies
- Replace the Lovable Google broker with native `supabase.auth.signInWithOAuth` and a public callback flow.
- Replace preview-specific auth storage with ordinary Supabase session persistence suitable for Vercel.
- Remove the Lovable auth package, Lovable proxy rewrite, and runtime error-reporting dependency; keep Sentry.
- Retain TanStack server functions and Vercel server routes where they are already the correct secure boundary. Supabase Edge Functions will only be introduced where they provide a real deployment benefit; no functionality will be moved merely to rewrite it.

### 4. Make environment and deployment configuration portable
- Document client-safe and server-only variables separately for local development, Vercel Preview, and Vercel Production.
- Require the target URL, publishable key, project reference, service-role key, and database connection string through secure environment settings—not committed files.
- Carry over Telegram, PayPal, CAPTCHA, Sentry, and retention-job settings.
- Add production-safe scheduled retention cleanup for Vercel and remove the Lovable preview proxy.
- Update OAuth callback and allowed-origin documentation for the final Vercel domains.

### 5. Storage and realtime
- Confirm the current app has no active Storage or Realtime calls.
- Provide an idempotent storage setup migration/script only for source buckets discovered during the live export; do not create unnecessary empty buckets.
- Copy any discovered files with metadata and validate object counts and access rules.

### 6. Security and validation
- Recheck every user-facing table for explicit grants and least-privilege RLS.
- Verify students cannot read other learners’ private data and admin access is enforced in the database/server, not only in the interface.
- Scan for exposed secrets, insecure public endpoints, unsafe privileged-client use, and remaining Lovable runtime references.
- Rehearse schema creation and imports against a local Supabase stack before production cutover.

### 7. Immediate production cutover
- Freeze writes briefly, take final schema/data/Auth exports, import in dependency order, reconcile counts, then update Vercel variables to the target project and redeploy.
- Test registration, email login, Google login, logout, reset, dashboards, enrollment, learning progress, payments, certificates, school administration, full admin operations, notifications, downloads, and retention cleanup.
- Keep rollback instructions and the source backend unchanged until the target passes verification.

## Technical deliverables
- Canonical baseline and incremental SQL migrations.
- Auth/data export, import, reconciliation, and rollback scripts.
- Native Supabase browser/server clients and Google OAuth callback.
- Vercel environment template, cron configuration, and cutover runbook.
- Final migration report covering all 16 requested areas, with explicit passed, failed, blocked, and manual-verification items.

## Required production handoff
When the code and local rehearsal are ready, you must create or identify the production Supabase project in your own account and securely provide its URL, publishable key, service-role key, database connection string, and Google OAuth credentials. Those values cannot be generated from this repository or copied from Lovable Cloud, and they will never be committed.
