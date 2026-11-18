# Database Design

## Core schema

```mermaid
erDiagram
  USERS ||--o{ AUDIT_LOGS : creates
  COUNTRIES ||--o{ EMPLOYEES : hosts
  DEPARTMENTS ||--o{ EMPLOYEES : assigns
  EMPLOYEES ||--o{ SALARY_RECORDS : has
  EMPLOYEES ||--o{ SALARY_REVISION_HISTORY : has
  USERS ||--o{ SALARY_REVISION_HISTORY : approves

  USERS {
    uuid id PK
    string email UK
    string passwordHash
    string role
    datetime createdAt
    datetime updatedAt
  }
  COUNTRIES {
    uuid id PK
    string code UK
    string name
  }
  DEPARTMENTS {
    uuid id PK
    string name UK
    datetime createdAt
    datetime updatedAt
  }
  EMPLOYEES {
    uuid id PK
    string employeeId UK
    string firstName
    string lastName
    string email UK
    uuid departmentId FK
    string designation
    uuid countryId FK
    string currency
    date joiningDate
    string employmentStatus
    datetime createdAt
    datetime updatedAt
  }
  SALARY_RECORDS {
    uuid id PK
    uuid employeeId FK
    decimal baseSalary
    decimal bonus
    decimal allowances
    decimal deductions
    string currency
    date effectiveFrom
    date effectiveTo
    datetime createdAt
    datetime updatedAt
  }
  SALARY_REVISION_HISTORY {
    uuid id PK
    uuid salaryRecordId FK
    uuid employeeId FK
    uuid changedByUserId FK
    decimal previousBaseSalary
    decimal previousBonus
    decimal previousAllowances
    decimal previousDeductions
    decimal newBaseSalary
    decimal newBonus
    decimal newAllowances
    decimal newDeductions
    date effectiveFrom
    datetime changedAt
  }
  AUDIT_LOGS {
    uuid id PK
    uuid actorUserId FK
    string entityType
    string entityId
    string action
    json metadata
    datetime createdAt
  }
```

## Relationships and constraints
- Employee belongs to one Department and Country.
- Employee has one or more SalaryRecords, but at most one active record at a given effective date.
- Revision history is append-only and links employee, salary record, and HR actor.
- User role uses an enum-like string; authorization middleware validates a role allowlist.
- All foreign keys use restrict deletion for employee/business records; soft deactivate is preferred.
- Currency is stored on each salary record for historical correctness.

## Indexes
- `employees(employeeId)` unique, `employees(email)` unique.
- `employees(lastName, firstName)`, `employees(countryId)`, `employees(departmentId)`, `employees(employmentStatus)`.
- Composite indexes for employee list filtering and search (country/status/department plus createdAt).
- `salary_records(employeeId, effectiveFrom)`, `salary_records(effectiveFrom/effectiveTo)`, `salary_records(currency)`, and department/country joins via employee indexes.
- `salary_revision_history(employeeId, changedAt)` and `audit_logs(entityType, entityId, createdAt)`.

## Currency rule
No cross-currency exchange-rate table is assumed. Aggregates expose totals grouped by ISO currency. For an explicit organization-wide total without rates, the API should require all active salaries to be represented in a base currency or provide a clear split. The MVP avoids misleading sums and documents the limitation.

## Date and decimal rules
- Dates: `DateTime` or `Date` in UTC/ISO form; effective periods use date-only fields.
- Monetary fields: `Decimal(18,2)` in PostgreSQL.
- Compensation total: base + bonus + allowances - deductions; never derive this in JavaScript with binary floating point.
