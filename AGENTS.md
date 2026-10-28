# Architecture rules

- Keep target-project migration setup separate from the managed Cloud integration; external setup must never implicitly apply to the source backend.
- Record school-head agreement acceptance in an admin-only partnership table, separate from account roles and invitation access, because onboarding status must not grant privileges.
- Use authenticated, RLS-scoped server functions for the partnership tracker; hiding controls is not an authorization boundary.
- Private environment values belong in secure deployment settings; tracked examples contain empty values only.