# Company Employee Salary Management System — Requirements

## Problem and objective
The company currently manages compensation through spreadsheets. The system will centralize employee, salary, reporting, and audit information for an HR Manager, support 10,000+ records, and provide reliable server-side search, filters, pagination, and analytics.

## Primary user journey
1. HR Manager logs in.
2. Dashboard shows organization-wide compensation and workforce figures.
3. HR searches or filters employees and opens an employee record.
4. HR adds or updates an employee and maintains status.
5. HR creates or revises salary; the system closes the prior period and records immutable history/audit data.
6. HR uses reports to compare workforce and compensation patterns while respecting currencies.

## User persona
**HR Manager:** needs accurate, auditable employee and compensation data, fast record lookup, controlled salary changes, and executive-style summaries without spreadsheet maintenance.

## Functional requirements
- Secure login, JWT sessions, and HR-only protected routes, with role checks designed for future roles.
- Dashboard totals and distributions sourced from PostgreSQL.
- Employee CRUD, status changes, server-side search/filter/sort/pagination, and detail views.
- Salary CRUD, effective-date histories, revisions, prior/current salary, compensation totals, and audit logs.
- Country, department, employment-status, and salary-range filtering.
- Reports for expenditure, averages, highest country/department, top-paid employees, headcount, distributions, and trends.
- Centralized employee/salary search.
- Repeatable deterministic seed data for 10,000 employees and representative histories.
- Loading, empty, error, confirmation, toast, and accessible-control states.

## Non-functional requirements
- **Performance:** server-side pagination; keyset or offset pagination with indexed filters; pages should support 10,000+ records.
- **Security:** bcrypt/Argon2 hashing, Zod validation, parameterized Prisma queries, protected APIs, CORS allowlist, safe errors, and no salary or password leakage.
- **Integrity:** decimal monetary types, transaction-based salary revisions, foreign keys, unique IDs/emails, and append-only revision/audit records.
- **Maintainability:** TypeScript, layered backend, reusable frontend components, environment configuration, linting, formatting, and migrations.
- **Reliability:** centralized errors, health check, migrations, deterministic seed, and independent tests.
- **Responsiveness/accessibility:** usable desktop/tablet/mobile layout and keyboard-accessible controls.

## MVP scope
In: authentication; dashboard; employee management; salary revisions; reports; audit log UI/API; seed data; tests; documentation; production build scripts.

## Deliberately excluded
- Payroll disbursement and tax calculations: domain rules vary and would create unsafe financial scope beyond management reporting.
- Benefits, leave, timesheets, and attendance: unrelated to the MVP compensation system.
- Multi-currency exchange-rate service and conversions: no authoritative rates are provided. Reports will use currency-aware native totals or separate currency groups; an approved rate provider can be added later.
- Advanced workflow approvals, SSO, SCIM, and multiple HR roles: no requirements or identity provider exist in MVP.
- Email notifications and real-time updates: not required for core HR workflows.
- Native mobile applications: a responsive web app meets the stated requirement.

## Assumptions
- One authenticated HR Manager role is sufficient for MVP.
- Salary compensation means base salary plus bonus plus allowances minus deductions, as exposed in the API/UI.
- Salary values are stored at 2 decimal places using `Decimal(18,2)` or database-equivalent decimal precision.
- Effective salary periods are non-overlapping and may be future-dated.
- Offset pagination is acceptable for the MVP with documented constraints; 10,000 records can be served efficiently with indexes.
- Seed and local data are synthetic and must not contain real employee or credential data.
