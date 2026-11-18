# Company Employee Salary Management System

A full-stack HR application for managing 10,000 employees, compensation records, salary revisions, dashboard analytics, reports, and audit trails.

## Stack
- React 19, Vite, TypeScript, React Router, TanStack Query, Recharts
- Express 5, TypeScript, Zod, JWT, bcrypt
- Prisma 6, SQLite for local development (the schema can be pointed at PostgreSQL)
- Vitest and Supertest/Testing Library

## Run locally
```bash
npm install
cd server
npx prisma migrate dev --name init
npm run db:seed
cd ..

npm run dev
```

Open http://localhost:5173.

## Demo login
- Email: `hr@company.local`
- Password: `Admin@123`

The demo password is synthetic and for local development only.

## Validation
```bash
npm test
npm run build
```

## API
The backend is available at http://localhost:4000 with `/api/health` and protected `/api/*` endpoints. See [API documentation](docs/api-documentation.md).

## Database
- Initial migration: `server/prisma/migrations/20261118164610_init`
- Repeatable seed: `npm run db:seed --workspace=server`
- The seed is deterministic and creates 10,000 employees plus countries, departments, current salaries, and representative histories.

## Production
Set `JWT_SECRET`, `CORS_ORIGIN`, `PORT`, and a production database URL. Replace SQLite with PostgreSQL in `schema.prisma`, run `npx prisma migrate deploy`, build both workspaces, and configure the frontend API URL. No public deployment is claimed by this repository.
