# Backend migration roadmap

- [x] Preserve database baseline and prepare fresh-target candidate with static security checks
- [ ] Build and run data/Auth transfer tooling — blocked: source export access and target credentials required
- [x] Replace Lovable OAuth/runtime dependencies
- [x] Add empty external environment template and deployment/cron instructions
- [ ] Rehearse migration and run database security checks — blocked: no Docker or target credentials
- [ ] Import into user-owned Supabase project — blocked: target credentials were not saved
- [ ] Reconcile production data and verify major workflows — blocked: target not provisioned or imported
- [ ] Remove remaining runtime Lovable dependencies — blocked: target cutover not verified
- [x] Add persisted admin-only school partnership acceptance and onboarding checklist
- [ ] Verify school acceptance UI persistence — blocked: requesting user has no mintable admin session
- [x] Run five partnership rule tests and report external setup blockers
