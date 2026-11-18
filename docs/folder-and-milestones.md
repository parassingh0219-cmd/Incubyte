# Recommended Folder Structure and Milestones

## Repository layout
```text
.
├── client/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── employees/
│   │   │   ├── salaries/
│   │   │   ├── dashboard/
│   │   │   └── reports/
│   │   └── lib/
│   └── package.json
├── server/
│   ├── prisma/
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── modules/
│   │   ├── prisma/
│   │   └── utils/
│   └── package.json
├── docs/
├── .env.example
└── README.md
```

## Development milestones
1. Documentation and implementation plan approval.
2. Initialize monorepo scripts, frontend, backend, lint, and test tooling.
3. Add Prisma schema, migrations, indexes, and deterministic 10,000-employee seed.
4. Implement auth, employee APIs, and authorization tests.
5. Implement salary transactions, revisions, audit trail, and salary tests.
6. Implement dashboard/report APIs and aggregation tests.
7. Build app shell/login and employee management UI.
8. Build salary UI, reports UI, and audit UI.
9. Add frontend tests and end-to-end workflow tests.
10. Run complete validation, produce README/deployment instructions, and prepare production builds.

No deployment should be claimed unless URL access, migrations, seed behavior, and health checks are verified.
