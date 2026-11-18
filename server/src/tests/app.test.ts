import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app, prisma } from '../app.js'

let token = ''

describe('Company API', () => {
  beforeAll(async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'hr@company.local', password: 'Admin@123' })
    token = login.body.data?.token || ''
  })
  afterAll(async () => { await prisma.$disconnect() })

  it('rejects protected routes without authentication', async () => {
    const response = await request(app).get('/api/employees')
    expect(response.status).toBe(401)
  })

  it('authenticates the seeded HR manager', async () => {
    expect(token).not.toBe('')
  })

  it('paginates employees', async () => {
    const response = await request(app).get('/api/employees?page=1&pageSize=10').set('Authorization', `Bearer ${token}`)
    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(10)
    expect(response.body.meta.total).toBeGreaterThanOrEqual(10000)
  })

  it('filters employee search', async () => {
    const response = await request(app).get('/api/employees?search=COMPANY-00001&pageSize=10').set('Authorization', `Bearer ${token}`)
    expect(response.status).toBe(200)
    expect(response.body.data[0].employeeId).toBe('COMPANY-00001')
  })

  it('provides dashboard summary from database records', async () => {
    const response = await request(app).get('/api/dashboard/summary').set('Authorization', `Bearer ${token}`)
    expect(response.status).toBe(200)
    expect(response.body.data.totalEmployees).toBeGreaterThanOrEqual(10000)
  })

  it('filters salary records by employee search', async () => {
    const employee = await prisma.employee.findFirst()
    const response = await request(app).get(`/api/salaries?search=${encodeURIComponent(employee!.employeeId)}&pageSize=10`).set('Authorization', `Bearer ${token}`)
    expect(response.status).toBe(200)
    expect(response.body.data.length).toBeGreaterThan(0)
    expect(response.body.data.every((record: any) => record.employee.employeeId === employee!.employeeId)).toBe(true)
    expect(response.body.data.every((record: any) => record.effectiveTo === null)).toBe(true)
  })

  it('searches salary records by full employee name', async () => {
    const employee = await prisma.employee.findFirst()
    const fullName = `${employee!.firstName} ${employee!.lastName}`
    const response = await request(app).get(`/api/salaries?search=${encodeURIComponent(fullName)}&pageSize=10`).set('Authorization', `Bearer ${token}`)
    expect(response.status).toBe(200)
    expect(response.body.data.some((record: any) => record.employee.id === employee!.id)).toBe(true)
  })

  it('provides country and department lookups', async () => {
    const countries = await request(app).get('/api/lookups/countries').set('Authorization', `Bearer ${token}`)
    const departments = await request(app).get('/api/lookups/departments').set('Authorization', `Bearer ${token}`)
    expect(countries.status).toBe(200)
    expect(departments.status).toBe(200)
    expect(countries.body.data.length).toBeGreaterThan(0)
    expect(departments.body.data.length).toBeGreaterThan(0)
  })

  it('creates, updates, and changes employee status', async () => {
    const country = await prisma.country.findFirst()
    const department = await prisma.department.findFirst()
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const created = await request(app).post('/api/employees').set('Authorization', `Bearer ${token}`).send({
      employeeId: `TEST-${suffix}`, firstName: 'Test', lastName: 'Employee', email: `test-${suffix}@example.com`,
      departmentId: department!.id, designation: 'QA Engineer', countryId: country!.id, currency: 'USD',
      joiningDate: new Date().toISOString(), employmentStatus: 'ACTIVE'
    })
    expect(created.status).toBe(200)
    const id = created.body.data.id
    try {
      const updated = await request(app).put(`/api/employees/${id}`).set('Authorization', `Bearer ${token}`).send({ designation: 'Senior QA Engineer' })
      expect(updated.status).toBe(200)
      expect(updated.body.data.designation).toBe('Senior QA Engineer')

      const status = await request(app).patch(`/api/employees/${id}/status`).set('Authorization', `Bearer ${token}`).send({ employmentStatus: 'INACTIVE' })
      expect(status.status).toBe(200)
      expect(status.body.data.employmentStatus).toBe('INACTIVE')
    } finally {
      await prisma.employee.delete({ where: { id } })
    }
  })

  it('returns salary history for an employee', async () => {
    const employee = await prisma.employee.findFirst()
    const response = await request(app).get(`/api/employees/${employee!.id}/salaries`).set('Authorization', `Bearer ${token}`)
    expect(response.status).toBe(200)
    expect(Array.isArray(response.body.data)).toBe(true)
  })
})
