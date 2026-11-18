import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function random(seed: number) {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

async function main() {
  const rand = random(20261118)
  const passwordHash = await bcrypt.hash(process.env.HR_PASSWORD || 'Admin@123', 12)
  const legacyUser = await prisma.user.findUnique({ where: { email: 'hr@acme.local' } })
  const companyUser = await prisma.user.findUnique({ where: { email: 'hr@company.local' } })
  if (legacyUser && !companyUser) {
    await prisma.user.update({ where: { id: legacyUser.id }, data: { email: 'hr@company.local', passwordHash } })
  }
  await prisma.user.upsert({ where: { email: 'hr@company.local' }, update: { passwordHash }, create: { email: 'hr@company.local', passwordHash, role: 'HR_MANAGER' } })

  const legacyEmployees = await prisma.employee.findMany({ where: { employeeId: { startsWith: 'ACME-' } } })
  for (let batchStart = 0; batchStart < legacyEmployees.length; batchStart += 500) {
    const batch = legacyEmployees.slice(batchStart, batchStart + 500)
    await prisma.$transaction(batch.map(employee => prisma.employee.update({
      where: { id: employee.id },
      data: {
        employeeId: employee.employeeId.replace(/^ACME-/, 'COMPANY-'),
        email: employee.email.replace(/@acme\.example$/i, '@company.example')
      }
    })))
  }

  const countryData = [
    ['US','United States','USD'], ['GB','United Kingdom','GBP'], ['DE','Germany','EUR'],
    ['IN','India','INR'], ['CA','Canada','CAD'], ['AU','Australia','AUD'], ['SG','Singapore','SGD']
  ] as const
  const countries = [] as { id:string; code:string; name:string }[]
  for (const [code,name] of countryData) {
    countries.push(await prisma.country.upsert({ where: { code }, update: { name }, create: { code, name } }))
  }

  const departmentNames = ['Engineering','Finance','Human Resources','Sales','Marketing','Operations','Legal','Customer Support','Product','Information Technology']
  const departments = [] as { id:string; name:string }[]
  for (const name of departmentNames) departments.push(await prisma.department.upsert({ where: { name }, update: {}, create: { name } }))

  const firstNames = ['Aarav','Olivia','Liam','Emma','Noah','Sophia','Ethan','Ava','Arjun','Mia','Lucas','Isabella','James','Amelia','Leo','Charlotte','Daniel','Harper','Henry','Evelyn']
  const lastNames = ['Shah','Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Wilson','Anderson','Taylor','Thomas','Moore','Martin','Jackson','Lee','Harris','Clark','Lewis']
  const designationByDepartment = ['Engineer','Analyst','Specialist','Manager','Director','Coordinator','Consultant','Architect','Lead','Associate']

  for (let batchStart = 0; batchStart < 10000; batchStart += 500) {
    const rows = []
    for (let i = batchStart; i < Math.min(batchStart + 500, 10000); i++) {
      const ci = i % countryData.length
      const di = i % departmentNames.length
      const firstName = firstNames[Math.floor(rand() * firstNames.length)]
      const lastName = lastNames[Math.floor(rand() * lastNames.length)]
      const active = rand() > 0.08
      const designation = `${designationByDepartment[Math.floor(rand() * designationByDepartment.length)]} ${departmentNames[di]}`
      const joiningYear = 2016 + Math.floor(rand() * 10)
      const joiningMonth = 1 + Math.floor(rand() * 12)
      rows.push({
        employeeId: `COMPANY-${String(i + 1).padStart(5,'0')}`,
        firstName, lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i + 1}@company.example`,
        departmentId: departments[di].id,
        designation,
        countryId: countries[ci].id,
        currency: countryData[ci][2],
        joiningDate: new Date(joiningYear, joiningMonth - 1, 1),
        employmentStatus: active ? 'ACTIVE' : 'INACTIVE'
      })
    }
    await prisma.$transaction(rows.map(row => prisma.employee.upsert({ where: { employeeId: row.employeeId }, update: {}, create: row })))
  }

  const employees = await prisma.employee.findMany({ include: { country: true } })
  for (let i = 0; i < employees.length; i++) {
    const employee = employees[i]
    const existing = await prisma.salaryRecord.count({ where: { employeeId: employee.id } })
    if (existing > 0) continue
    const departmentIndex = departmentNames.findIndex((_, index) => departments[index].id === employee.departmentId)
    const roleFactor = 1 + (i % 10) * 0.12
    const departmentFactor = 1 + Math.max(0, departmentIndex - 3) * 0.025
    const baseByCountry: Record<string,number> = { USD: 90000, GBP: 76000, EUR: 82000, INR: 1800000, CAD: 95000, AUD: 105000, SGD: 90000 }
    const base = Math.round((baseByCountry[employee.currency] || 90000) * roleFactor * departmentFactor * (0.82 + rand() * 0.36))
    const currencySalary = Number(base).toFixed(2)
    const current = await prisma.salaryRecord.create({ data: {
      employeeId: employee.id, baseSalary: currencySalary,
      bonus: (base * 0.08).toFixed(2), allowances: (base * 0.04).toFixed(2), deductions: (base * 0.02).toFixed(2),
      currency: employee.currency, effectiveFrom: employee.joiningDate
    } })

    if (i % 3 === 0) {
      const priorBase = Number((base * 0.88).toFixed(2))
      const prior = await prisma.salaryRecord.create({ data: {
        employeeId: employee.id, baseSalary: priorBase.toFixed(2), bonus: (priorBase * 0.06).toFixed(2),
        allowances: (priorBase * 0.03).toFixed(2), deductions: (priorBase * 0.02).toFixed(2),
        currency: employee.currency, effectiveFrom: new Date(employee.joiningDate.getFullYear() + 1, 0, 1), effectiveTo: employee.joiningDate
      } })
      await prisma.salaryRevision.create({ data: {
        salaryRecordId: prior.id, employeeId: employee.id, changedByUserId: (await prisma.user.findUnique({ where: { email: 'hr@company.local' } }))!.id,
        previousBaseSalary: null, previousBonus: null, previousAllowances: null, previousDeductions: null,
        newBaseSalary: priorBase.toFixed(2), newBonus: (priorBase * 0.06).toFixed(2), newAllowances: (priorBase * 0.03).toFixed(2), newDeductions: (priorBase * 0.02).toFixed(2), effectiveFrom: prior.effectiveFrom
      } })
      await prisma.salaryRecord.update({ where: { id: current.id }, data: { effectiveFrom: new Date(employee.joiningDate.getFullYear() + 2, 0, 1) } })
    }
  }

  console.log('Seed complete: 10,000 employees, countries, departments, salaries, and revisions')
}

main().finally(() => prisma.$disconnect())
