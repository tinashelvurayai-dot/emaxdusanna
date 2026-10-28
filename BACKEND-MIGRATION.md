# Independent Supabase migration status

## What is prepared
- Supabase CLI available through `bunx --bun supabase`.
- Original public schema preserved in `supabase/bootstrap/000_current_public_schema.sql`.
- Fresh-target candidate generator removes Cloud-only grants, broad inherited privileges, direct Auth references outside profiles/roles, and email-based admin auto-promotion.
- Candidate retains table structures, indexes, application functions and ownership/admin/school RLS policies. Target grants restrict anonymous access and protect profile security timestamps from browser edits.
- Admin-only school partnership checklist covers outreach, interest, credential handover, the two-representative/10-minute meeting and demonstrations, agreement signing, certificate and manual handover.
- `.env.external.example` contains empty deployment fields, never private keys.

## Not completed
No new hosted project has been created or connected. No production data/Auth export or import, password-hash transfer, storage transfer, local database rehearsal, or production workflow/security validation has occurred. The candidate must not be called a verified production migration.

This project's existing Cloud association cannot be disconnected within Lovable. Production on Vercel can use a separately owned Supabase project. The preview still uses the existing backend until an explicit, verified cutover; the partnership tracker schema was applied there to preserve a working preview, not to establish the requested target.

## Required handoff
Create the destination project in your own Supabase account and provide its URL, publishable key, server-only service-role key and database connection URI through the secure form/settings. The secure form in this turn did not save values. Never paste credentials in chat or commit private environment files. The managed `.env` is not a secret-copy document.

## Prepare and inspect the candidate
```sh
python3 scripts/supabase/build-target-schema.py
node scripts/supabase/check-target.mjs
```
`supabase/target/000_fresh_schema.sql` is for a **fresh empty project only**. Do not apply it to the existing source and do not blindly replay the historical incremental migrations afterwards. Some historical patches delete duplicate enrollments or assume missing invitation tables; they are not a safe fresh-project installation chain.

## Cutover procedure (blocked until credentials and exports exist)
1. Capture a final live schema and inventory; compare against the stored baseline before target creation. Freeze writes only for the final transfer, not during preparation.
2. Rehearse the target schema against a disposable Supabase instance. Run SQL policy tests as anonymous, learner, school admin and platform admin; static checks are not sufficient.
3. Export Auth users through a supported source mechanism; preserve UUIDs and supported bcrypt hashes. Import through the destination Auth admin API. Reject duplicate identities. Sessions, MFA and OAuth grants are not transferable; Google users must sign in again. If password-hash import is unsupported, obtain agreement to a password-reset fallback.
4. Export/import every public table using explicit columns, omitting generated columns. Import schools and Auth users before profiles/roles/linked rows. Preserve certificate/payment IDs. Disable only application transfer-side triggers in a controlled rehearsal so imports do not allocate new IDs or create duplicates. Reconcile counts, references and role ownership before enabling signup triggers.
5. Attach an app-owned `auth.users` signup trigger to the reviewed `public.handle_new_user()` on the target after transfer. Preserve admin membership from transferred `user_roles`; never auto-promote by email. Confirm email signup, Google credentials/callback URLs, recovery URLs and 3600-second JWT expiry in the target's auth settings. These hosted settings are not verified.
6. Inventory storage buckets/files from the live source and recreate only discovered buckets with equivalent public/private and MIME/size rules; none are used in the inspected app code. Validate object counts if any exist.
7. Set matching `VITE_SUPABASE_*` and server `SUPABASE_*` values in Vercel. Add PayPal (`PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, optional `PAYPAL_API_BASE`, `APP_ORIGIN`), CAPTCHA (`VITE_TURNSTILE_SITE_KEY`), Sentry (`VITE_SENTRY_DSN`), Telegram and retention settings as applicable.
8. Schedule an external authenticated POST to `/api/public/cron/purge-retention`, with `x-cron-secret` matching `RETENTION_CRON_SECRET`. Do not add unauthenticated Vercel GET cron calls to a POST-only endpoint.
9. Verify signup, login/Google/logout/recovery, admin and school dashboards, enrollment/progress/quizzes, payments/receipts, credentials, privacy/deletion and retention end-to-end on the target. Switch only after read-back verification, keeping source backups for rollback.

## School onboarding operation
Admin first emails targeted schools; inbound interest also arrives through the Partnership page. After favorable feedback create the school, then use **Create a school admin account** and securely hand those credentials to the School Head. Do not email plaintext passwords or store them in the checklist.

Two representatives visit with the agreement, discuss it for ten minutes, demonstrate the school's dashboard and Academia signup, and obtain the Principal/School Head's signature. Hand over the partnership certificate and school-admin manual. Tick each completed step; the acceptance checkbox records the admin's confirmation of the School Head's signed agreement, not a digital signature. Unticked means acceptance is not recorded, not necessarily an explicit refusal. The acceptance filter separates accepted from not-accepted schools.

Outbound school email delivery and generated agreement/certificate/manual documents are **not implemented**; the checklist records the real-world handover. Existing Partnership requests remain available under Operations. Private self-service invitations are not the primary workflow.

## Verification report
- Partnership requirement tests: five passing tests.
- Target security checks: static validation only; database and hosted auth tests pending.
- Target project provisioning/import/cutover: blocked by missing destination credentials and source transfer access.
- Admin UI persistence: requires a signed-in admin verification session; automatic session minting did not find the requesting user's account.