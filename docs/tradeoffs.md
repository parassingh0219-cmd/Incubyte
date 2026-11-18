# Tradeoffs and Risk Plan

## Key tradeoffs
- **Prisma vs. raw SQL:** Prisma improves migrations and type safety; raw SQL or CTEs may be introduced for a few expensive reports only if profiling proves necessary.
- **Offset vs. cursor pagination:** offset pagination is simpler and supports direct page navigation. It may degrade at deep pages; the UI size is capped and indexes constrain filters. Cursor pagination can be added later for large live exports.
- **Single HR role vs. RBAC framework:** a role enum and centralized middleware are sufficient today and avoid overengineering. Permission keys can replace role checks later.
- **Grouped currency totals vs. conversion:** without exchange rates, the system displays native-currency totals and labels; it will not imply cross-currency comparability.
- **Normalized salary history vs. JSON snapshots:** separate revisions provide queryability and audit integrity, with a salary record for the effective period.
- **Monolith vs. microservices:** one Express service is operationally simpler and appropriate for an MVP of 10,000 employees.

## Scalability plan
- Composite and foreign-key indexes on common filters and effective-date lookups.
- Server-side count plus page queries rather than frontend loads.
- Dashboard queries aggregate at the database and may use materialized summaries or Redis caching later.
- React Query caches already-fetched pages and invalidates on mutations.
- Seed 10,000 records in batches and upsert deterministic lookup values.

## Risks and mitigations
| Risk | Mitigation |
|---|---|
| Incorrect salary history | Transaction-based period closing; overlap constraints; revision/audit tests |
| Currency comparison error | Never sum unlike currencies; always show currency; document conversion limitation |
| Slow large-list queries | Composite indexes; capped page size; server-side filtering; query profiling |
| Authorization regression | Central auth middleware; role allowlists; integration tests on protected salary routes |
| Secret or sensitive data exposure | Environment variables; password excluded from serializers; no salary values in logs |
| Seed non-repeatability | Fixed PRNG seed, explicit upserts, batch operations |
| Report disagreement | Shared aggregation services and tests for totals, averages, and currency grouping |
| API contract drift | Zod schemas and Vitest/Supertest tests; shared response conventions |

## Future improvements
- Approved exchange-rate provider and historical conversion snapshots.
- Additional roles and granular permissions.
- SSO/SAML/OIDC and MFA.
- Audit export and salary approval workflows.
- Cursor pagination for exports and very deep lists.
- Materialized dashboard tables refreshed after salary changes.
- CSV/Excel exports with authorization and generated-file cleanup.
