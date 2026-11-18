import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import bcrypt from 'bcryptjs'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { z } from 'zod'
import { PrismaClient, Prisma } from '@prisma/client'

export const prisma = new PrismaClient()
export const app = express()
app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173', 'http://127.0.0.1:5173'] }))
app.use(express.json({ limit: '1mb' }))
app.use(morgan(process.env.NODE_ENV === 'test' ? 'dev' : 'combined'))

const JWT_SECRET = process.env.JWT_SECRET || 'local-development-only-secret'

type AuthRequest = express.Request & { user?: { id: string; role: string } }

function auth(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
    if (payload.role !== 'HR_MANAGER') throw new Error('role')
    req.user = { id: payload.sub as string, role: payload.role }
    next()
  } catch {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } })
  }
}

const ok = (res: express.Response, data: unknown, meta?: unknown) => res.json(meta ? { data, meta } : { data })
const decimal = (value: unknown) => new Prisma.Decimal(String(value))
const queryString = (req: express.Request, key: string) => {
  const value = req.query[key]
  return typeof value === 'string' ? value : ''
}
const paramString = (req: express.Request): string => typeof req.params.id === 'string' ? req.params.id : ''
const employeeSearchWhere = (search: string): Prisma.EmployeeWhereInput => {
  const terms = search.split(/\s+/).filter(Boolean)
  return {
    OR: [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { email: { contains: search } },
      { employeeId: { contains: search } },
      ...(terms.length > 1
        ? [{ AND: terms.map(term => ({ OR: [{ firstName: { contains: term } }, { lastName: { contains: term } }] })) }]
        : [])
    ]
  }
}

app.get('/api/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`
  res.json({ data: { status: 'ok' } })
})

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const input = z.object({ email: z.string().email(), password: z.string().min(6) }).parse(req.body)
    const user = await prisma.user.findUnique({ where: { email: input.email } })
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } })
    }
    const token = jwt.sign({ role: user.role }, JWT_SECRET, { subject: user.id, expiresIn: '8h' })
    ok(res, { token, user: { id: user.id, email: user.email, role: user.role } })
  } catch (error) { next(error) }
})

app.get('/api/auth/me', auth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, email: true, role: true } })
  ok(res, user)
})

const employeeCreate = z.object({
  employeeId: z.string().min(3), firstName: z.string().min(1), lastName: z.string().min(1),
  email: z.string().email(), departmentId: z.string().min(1), designation: z.string().min(1),
  countryId: z.string().min(1), currency: z.string().length(3), joiningDate: z.string().datetime(),
  employmentStatus: z.enum(['ACTIVE', 'INACTIVE'])
})

app.get('/api/lookups/countries', auth, async (_req, res, next) => {
  try { ok(res, await prisma.country.findMany({ orderBy: { name: 'asc' } })) }
  catch (error) { next(error) }
})

app.get('/api/lookups/departments', auth, async (_req, res, next) => {
  try { ok(res, await prisma.department.findMany({ orderBy: { name: 'asc' } })) }
  catch (error) { next(error) }
})

app.get('/api/employees', auth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const sizeAllowed = [10,15,20,25,50]
    const pageSize = sizeAllowed.includes(Number(req.query.pageSize)) ? Number(req.query.pageSize) : 10
    const search = queryString(req, 'search').trim()
    const status = queryString(req, 'status')
    const countryId = queryString(req, 'countryId')
    const departmentId = queryString(req, 'departmentId')
    const where: Prisma.EmployeeWhereInput = {
      ...(search ? employeeSearchWhere(search) : {}),
      ...(status ? { employmentStatus: status } : {}),
      ...(countryId ? { countryId } : {}),
      ...(departmentId ? { departmentId } : {})
    }
    const [items, total] = await prisma.$transaction([
      prisma.employee.findMany({ where, include: { country: true, department: true }, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }),
      prisma.employee.count({ where })
    ])
    ok(res, items, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) })
  } catch (error) { next(error) }
})

app.get('/api/employees/:id', auth, async (req, res, next) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: paramString(req) }, include: { country: true, department: true, salaries: { orderBy: { effectiveFrom: 'desc' } } } })
    if (!employee) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } })
    ok(res, employee)
  } catch (error) { next(error) }
})

app.post('/api/employees', auth, async (req: AuthRequest, res, next) => {
  try {
    const input = employeeCreate.parse(req.body)
    const employee = await prisma.employee.create({ data: { ...input, joiningDate: new Date(input.joiningDate) } })
    await prisma.auditLog.create({ data: { actorId: req.user!.id, entityType: 'EMPLOYEE', entityId: employee.id, action: 'EMPLOYEE_CREATED', metadata: JSON.stringify({ employeeId: employee.employeeId }) } })
    ok(res, employee)
  } catch (error) { next(error) }
})

app.put('/api/employees/:id', auth, async (req: AuthRequest, res, next) => {
  try {
    const input = employeeCreate.partial().parse(req.body)
    const employee = await prisma.employee.update({ where: { id: paramString(req) }, data: { ...input, joiningDate: input.joiningDate ? new Date(input.joiningDate) : undefined } })
    await prisma.auditLog.create({ data: { actorId: req.user!.id, entityType: 'EMPLOYEE', entityId: employee.id, action: 'EMPLOYEE_UPDATED' } })
    ok(res, employee)
  } catch (error) { next(error) }
})

app.patch('/api/employees/:id/status', auth, async (req: AuthRequest, res, next) => {
  try {
    const { employmentStatus } = z.object({ employmentStatus: z.enum(['ACTIVE', 'INACTIVE']) }).parse(req.body)
    const employee = await prisma.employee.update({ where: { id: paramString(req) }, data: { employmentStatus } })
    await prisma.auditLog.create({ data: { actorId: req.user!.id, entityType: 'EMPLOYEE', entityId: employee.id, action: 'EMPLOYEE_STATUS_CHANGED', metadata: JSON.stringify({ employmentStatus }) } })
    ok(res, employee)
  } catch (error) { next(error) }
})

const salarySchema = z.object({
  baseSalary: z.union([z.string(), z.number()]).transform(v => decimal(v)),
  bonus: z.union([z.string(), z.number()]).default(0).transform(v => decimal(v)),
  allowances: z.union([z.string(), z.number()]).default(0).transform(v => decimal(v)),
  deductions: z.union([z.string(), z.number()]).default(0).transform(v => decimal(v)),
  currency: z.string().length(3).toUpperCase(), effectiveFrom: z.string().datetime(), effectiveTo: z.string().datetime().nullable().optional()
}).superRefine((v, ctx) => {
  for (const name of ['baseSalary','bonus','allowances','deductions'] as const) {
    if (v[name].lessThan(0)) ctx.addIssue({ code: 'custom', path: [name], message: 'Must not be negative' })
  }
})

app.get('/api/employees/:id/salaries', auth, async (req, res, next) => {
  try {
    const salaries = await prisma.salaryRecord.findMany({ where: { employeeId: paramString(req) }, orderBy: { effectiveFrom: 'desc' } })
    ok(res, salaries)
  } catch (error) { next(error) }
})

app.post('/api/employees/:id/salaries', auth, async (req: AuthRequest, res, next) => {
  try {
    const input = salarySchema.parse(req.body)
    const effectiveFrom = new Date(input.effectiveFrom)
    const employee = await prisma.employee.findUnique({ where: { id: paramString(req) } })
    if (!employee) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } })

    const record = await prisma.$transaction(async tx => {
      const current = await tx.salaryRecord.findFirst({ where: { employeeId: employee.id, effectiveTo: null }, orderBy: { effectiveFrom: 'desc' } })
      if (current && effectiveFrom <= current.effectiveFrom) throw Object.assign(new Error('Effective date must be after the current salary'), { status: 422 })
      if (current) await tx.salaryRecord.update({ where: { id: current.id }, data: { effectiveTo: effectiveFrom } })
      const next = await tx.salaryRecord.create({ data: {
        employeeId: employee.id, baseSalary: input.baseSalary, bonus: input.bonus, allowances: input.allowances,
        deductions: input.deductions, currency: input.currency, effectiveFrom, effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null
      } })
      await tx.salaryRevision.create({ data: {
        salaryRecordId: next.id, employeeId: employee.id, changedByUserId: req.user!.id,
        previousBaseSalary: current?.baseSalary, previousBonus: current?.bonus, previousAllowances: current?.allowances, previousDeductions: current?.deductions,
        newBaseSalary: input.baseSalary, newBonus: input.bonus, newAllowances: input.allowances, newDeductions: input.deductions, effectiveFrom
      } })
      await tx.auditLog.create({ data: { actorId: req.user!.id, entityType: 'SALARY', entityId: next.id, action: 'SALARY_REVISED' } })
      return next
    })
    ok(res, record)
  } catch (error) { next(error) }
})

app.get('/api/salaries', auth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = [10,15,20,25,50].includes(Number(req.query.pageSize)) ? Number(req.query.pageSize) : 10
    const search = queryString(req, 'search').trim()
    const where: Prisma.SalaryRecordWhereInput = {
      effectiveTo: null,
      ...(queryString(req, 'currency') ? { currency: queryString(req, 'currency').toUpperCase() } : {}),
      ...(queryString(req, 'minSalary') ? { baseSalary: { gte: decimal(queryString(req, 'minSalary')) } } : {}),
      ...(queryString(req, 'maxSalary') ? { baseSalary: { lte: decimal(queryString(req, 'maxSalary')) } } : {}),
      employee: {
        ...(queryString(req, 'countryId') ? { countryId: queryString(req, 'countryId') } : {}),
        ...(queryString(req, 'departmentId') ? { departmentId: queryString(req, 'departmentId') } : {}),
        ...(search ? employeeSearchWhere(search) : {})
      }
    }
    const [items, total] = await prisma.$transaction([
      prisma.salaryRecord.findMany({ where, include: { employee: { include: { country: true, department: true } } }, skip: (page-1)*pageSize, take: pageSize, orderBy: { effectiveFrom: 'desc' } }),
      prisma.salaryRecord.count({ where })
    ])
    ok(res, items, { page, pageSize, total, totalPages: Math.ceil(total/pageSize) })
  } catch (error) { next(error) }
})

app.get('/api/dashboard/summary', auth, async (_req, res, next) => {
  try {
    const [employees, countries, departments, salaryStats] = await Promise.all([
      prisma.employee.count(), prisma.employee.groupBy({ by: ['countryId'], _count: { _all: true } }),
      prisma.employee.groupBy({ by: ['departmentId'], _count: { _all: true } }),
      prisma.salaryRecord.findMany({ where: { effectiveTo: null }, select: { baseSalary: true, bonus: true, allowances: true, deductions: true, currency: true } })
    ])
    const totals = salaryStats.reduce<Record<string, { total: number; count: number; salarySum: number; highest: number; lowest: number }>>((acc, s) => {
      const base = Number(s.baseSalary), bonus = Number(s.bonus), allowance = Number(s.allowances), deduction = Number(s.deductions)
      const compensation = base + bonus + allowance - deduction
      const c = acc[s.currency] ?? { total: 0, count: 0, salarySum: 0, highest: compensation, lowest: compensation }
      c.total += compensation; c.count++; c.salarySum += base; c.highest = Math.max(c.highest, compensation); c.lowest = Math.min(c.lowest, compensation)
      acc[s.currency] = c
      return acc
    }, {})
    ok(res, { totalEmployees: employees, currencies: totals, countryGroups: countries.length, departmentGroups: departments.length })
  } catch (error) { next(error) }
})

app.get('/api/dashboard/country-distribution', auth, async (_req, res, next) => {
  try {
    const rows = await prisma.employee.groupBy({ by: ['countryId'], _count: { _all: true } })
    const countries = await prisma.country.findMany()
    ok(res, rows.map(r => ({ country: countries.find(c => c.id === r.countryId)?.name || r.countryId, count: r._count._all })))
  } catch (error) { next(error) }
})

app.get('/api/dashboard/department-distribution', auth, async (_req, res, next) => {
  try {
    const rows = await prisma.employee.groupBy({ by: ['departmentId'], _count: { _all: true } })
    const departments = await prisma.department.findMany()
    ok(res, rows.map(r => ({ department: departments.find(d => d.id === r.departmentId)?.name || r.departmentId, count: r._count._all })))
  } catch (error) { next(error) }
})

app.get('/api/reports/top-paid-employees', auth, async (req, res, next) => {
  try {
    const topCurrency = queryString(req, 'currency')
    const rows = await prisma.salaryRecord.findMany({ where: { effectiveTo: null, ...(topCurrency ? { currency: topCurrency.toUpperCase() } : {}) }, include: { employee: true }, take: 100 })
    const top = rows.map(r => ({ employeeId: r.employee.employeeId, name: `${r.employee.firstName} ${r.employee.lastName}`, currency: r.currency, compensation: Number(r.baseSalary) + Number(r.bonus) + Number(r.allowances) - Number(r.deductions) })).sort((a,b) => b.compensation-a.compensation).slice(0,10)
    ok(res, top)
  } catch (error) { next(error) }
})

app.get('/api/reports/salary-summary', auth, async (_req, res, next) => {
  try {
    const rows = await prisma.salaryRecord.findMany({ where: { effectiveTo: null } })
    const byCurrency: Record<string, { total: number; average: number; count: number }> = {}
    for (const r of rows) { const c = byCurrency[r.currency] ?? { total: 0, average: 0, count: 0 }; c.total += Number(r.baseSalary)+Number(r.bonus)+Number(r.allowances)-Number(r.deductions); c.count++; byCurrency[r.currency] = c }
    for (const c of Object.values(byCurrency)) c.average = c.total/c.count
    ok(res, byCurrency)
  } catch (error) { next(error) }
})

app.get('/api/reports/salary-distribution', auth, async (req, res, next) => {
  try {
    const currencyValue = queryString(req, 'currency')
    const currency = currencyValue ? currencyValue.toUpperCase() : undefined
    const rows = await prisma.salaryRecord.findMany({ where: { effectiveTo: null, ...(currency ? { currency } : {}) }, include: { employee: { include: { department: true } } } })
    const result = rows.reduce<Record<string, number>>((acc,r) => { const key=r.employee.department.name; acc[key]=(acc[key]||0)+1; return acc }, {})
    ok(res, Object.entries(result).map(([department, count]) => ({ department, count })))
  } catch (error) { next(error) }
})

app.get('/api/reports/salary-trends', auth, async (_req, res, next) => {
  try {
    const rows = await prisma.salaryRecord.findMany({ include: { employee: true }, orderBy: { effectiveFrom: 'asc' } })
    const result = new Map<string, { sum: number; count: number }>()
    for (const r of rows) {
      const key = r.effectiveFrom.toISOString().slice(0,7)
      const c=result.get(key)||{sum:0,count:0}; c.sum+=Number(r.baseSalary); c.count++; result.set(key,c)
    }
    ok(res, [...result].map(([month,v])=>({month,average:v.sum/v.count})))
  } catch (error) { next(error) }
})

app.get('/api/audit-logs', auth, async (req, res, next) => {
  try {
    const page=Number(req.query.page)||1, pageSize=Number(req.query.pageSize)||25
    const [items,total]=await prisma.$transaction([prisma.auditLog.findMany({skip:(page-1)*pageSize,take:pageSize,orderBy:{createdAt:'desc'}}),prisma.auditLog.count()])
    ok(res,items,{page,pageSize,total,totalPages:Math.ceil(total/pageSize)})
  } catch(error){next(error)}
})

app.use((req,res) => res.status(404).json({error:{code:'NOT_FOUND',message:`Route ${req.method} ${req.path} not found`}}))
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = error.status || (error.code?.startsWith('P200') ? 409 : error instanceof z.ZodError ? 422 : 500)
  const code = error instanceof z.ZodError ? 'VALIDATION_ERROR' : error.code?.startsWith('P200') ? 'CONFLICT' : 'INTERNAL_ERROR'
  res.status(status).json({ error: { code, message: status === 500 ? 'Internal server error' : error.message, details: error instanceof z.ZodError ? error.flatten() : undefined } })
})
