# API Design

## Authentication
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Authenticate HR Manager |
| GET | `/api/auth/me` | Return current user profile |

Login request: `{ "email": "hr@company.local", "password": "..." }`.
Login response: `{ "data": { "token": "<jwt>", "user": { "id": "...", "email": "...", "role": "HR_MANAGER" } } }`.

## Employees
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/employees` | Search/filter/sort/paginate employees |
| GET | `/api/employees/:id` | Employee detail |
| POST | `/api/employees` | Create employee |
| PUT | `/api/employees/:id` | Update employee |
| PATCH | `/api/employees/:id/status` | Activate/deactivate employee |

Employee list query: `search`, `countryId`, `departmentId`, `status`, `sortBy`, `sortOrder`, `page`, `pageSize`.
Allowed page sizes: `10,15,20,25,50`.

## Salaries
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/employees/:id/salaries` | Employee salary history |
| GET | `/api/salaries` | Salary records with filters |
| POST | `/api/employees/:id/salaries` | Create/revise an employee salary |
| PUT | `/api/salaries/:id` | Controlled update, not historical overwrite |

Salary query: `countryId`, `departmentId`, `currency`, `minSalary`, `maxSalary`, `effectiveFrom`, `effectiveTo`, `page`, `pageSize`.
Create/revise request: `{ "baseSalary": "72000.00", "bonus": "5000.00", "allowances": "1200.00", "deductions": "800.00", "currency": "USD", "effectiveFrom": "2026-01-01", "effectiveTo": null }`.

Salary update semantics: a new revision closes the current record and creates a new record in one transaction. A completed historical record is never mutated. The API rejects overlapping periods, invalid effective dates, negative values, unsupported currencies, and unauthorized actors.

## Dashboard and reports
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/dashboard/summary` | Organization totals |
| GET | `/api/dashboard/country-distribution` | Headcount and currency-aware totals by country |
| GET | `/api/dashboard/department-distribution` | Headcount and salary by department |
| GET | `/api/reports/salary-summary` | Average/expenditure summary |
| GET | `/api/reports/top-paid-employees` | Top 10, with currency labels |
| GET | `/api/reports/salary-distribution` | Department/range distributions |
| GET | `/api/reports/salary-trends` | Average salary over time |

Reports accept optional `countryId`, `departmentId`, `from`, and `to` parameters. Cross-currency results are grouped by currency and do not add unlike currencies.

## Audit and health
- `GET /api/audit-logs` for paginated audit entries.
- `GET /api/health` for liveness and database readiness.

## Standard errors
- `400` invalid JSON or query/request shape.
- `401` missing or invalid/expired JWT.
- `403` authenticated user lacks HR Manager permission.
- `404` resource not found.
- `409` duplicate employee/email or overlapping salary period.
- `422` Zod/business-rule validation failure.
- `500` unhandled server failure; omit internals from the response.
