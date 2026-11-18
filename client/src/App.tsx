import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { LayoutDashboard, Users, WalletCards, ChartNoAxesCombined, ScrollText, LogOut, Menu } from 'lucide-react'

const API = 'http://localhost:4000/api'
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })

async function api(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('company_token')
  const headers = new Headers({ 'Content-Type': 'application/json', ...options.headers })
  if (token) headers.set('Authorization', 'Bearer ' + token)
  const response = await fetch(`${API}${path}`, { ...options, headers })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error?.message || 'Request failed')
  return body
}

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('hr@company.local')
  const [password, setPassword] = useState('Admin@123')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    try { const body = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); localStorage.setItem('company_token', body.data.token); navigate('/') }
    catch (err) { setError((err as Error).message) }
    finally { setLoading(false) }
  }
  return <main className="login"><form onSubmit={submit} className="login-card"><div className="brand-mark">C</div><h1>Company HR</h1><p>Employee Salary Management</p><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>{error && <div className="error">{error}</div>}<button disabled={loading}>{loading?'Signing in…':'Sign in'}</button><small>Demo: hr@company.local / Admin@123</small></form></main>
}

function Shell() {
  const navigate = useNavigate(); const [open,setOpen]=useState(false)
  const logout=()=>{localStorage.removeItem('company_token');navigate('/login')}
  const nav=[['/','Dashboard',LayoutDashboard],['/employees','Employees',Users],['/salaries','Salary Management',WalletCards],['/reports','Reports & Analytics',ChartNoAxesCombined],['/audit','Audit Logs',ScrollText]] as const
  return <div className="shell"><aside className={open?'aside open':'aside'}><div className="logo"><span>C</span><strong>Company HR</strong></div><nav>{nav.map(([path,label,Icon])=><NavLink key={path} to={path} end={path==='/'}><Icon size={18}/>{label}</NavLink>)}</nav><button className="logout" onClick={logout}><LogOut size={18}/>Logout</button></aside><section className="main"><header><button className="menu" onClick={()=>setOpen(!open)}><Menu/></button><div><span>Human Resources</span><strong>Payroll overview</strong></div><div className="avatar">HR</div></header><div className="content"><Routes><Route path="/" element={<Dashboard/>}/><Route path="/employees" element={<Employees/>}/><Route path="/salaries" element={<Salaries/>}/><Route path="/reports" element={<Reports/>}/><Route path="/audit" element={<Audit/>}/><Route path="*" element={<Navigate to="/"/>}/></Routes></div></section></div>
}

function Dashboard(){
 const summary=useQuery({queryKey:['summary'],queryFn:()=>api('/dashboard/summary')})
 const countries=useQuery({queryKey:['countries'],queryFn:()=>api('/dashboard/country-distribution')})
 const departments=useQuery({queryKey:['departments'],queryFn:()=>api('/dashboard/department-distribution')})
 const currencyRows=summary.data?.data.currencies ? Object.entries(summary.data.data.currencies).map(([currency,v]:any)=>({currency,total:v.total,average:v.count?v.total/v.count:0})) : []
 if(summary.isLoading) return <Loading label="Loading dashboard"/>
 if(summary.isError) return <ErrorState message={(summary.error as Error).message}/>
 const totalEmployees=summary.data.data.totalEmployees
 return <><PageTitle title="Dashboard" subtitle="Organization compensation overview"/><div className="stats"><Stat label="Total employees" value={totalEmployees.toLocaleString()} /><Stat label="Currency groups" value={currencyRows.length.toString()} /><Stat label="Countries" value={summary.data.data.countryGroups.toString()} /><Stat label="Departments" value={summary.data.data.departmentGroups.toString()} /></div><div className="grid2"><Panel title="Employees by country"><div className="chart"><ResponsiveContainer><BarChart data={countries.data?.data||[]}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="country" interval={0} angle={-30} textAnchor="end" height={70}/><YAxis/><Tooltip/><Bar dataKey="count" fill="#5267df" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></Panel><Panel title="Employees by department"><div className="chart"><ResponsiveContainer><PieChart><Pie data={departments.data?.data||[]} dataKey="count" nameKey="department" cx="50%" cy="50%" outerRadius={95} fill="#5267df" label/><Tooltip/></PieChart></ResponsiveContainer></div></Panel></div><Panel title="Compensation totals by currency"><div className="currency-grid">{currencyRows.map((r:any)=><div key={r.currency}><strong>{r.currency}</strong><span>Total {r.total.toLocaleString(undefined,{maximumFractionDigits:2})}</span><span>Average {r.average.toLocaleString(undefined,{maximumFractionDigits:2})}</span></div>)}</div></Panel></>
}

function Employees(){
 const queryClient=useQueryClient()
 const [search,setSearch]=useState(''); const [page,setPage]=useState(1); const [pageSize,setPageSize]=useState(10)
 const [statusFilter,setStatusFilter]=useState(''); const [countryFilter,setCountryFilter]=useState(''); const [departmentFilter,setDepartmentFilter]=useState('')
 const [modal,setModal]=useState<'create'|'edit'|'view'|null>(null); const [selected,setSelected]=useState<any>(null); const [toast,setToast]=useState('')
 const countries=useQuery({queryKey:['countries-list'],queryFn:()=>api('/lookups/countries')})
 const departments=useQuery({queryKey:['departments-list'],queryFn:()=>api('/lookups/departments')})
 const {data,isLoading,error}=useQuery({queryKey:['employees',search,page,pageSize,statusFilter,countryFilter,departmentFilter],queryFn:()=>api(`/employees?search=${encodeURIComponent(search)}&page=${page}&pageSize=${pageSize}&status=${statusFilter}&countryId=${countryFilter}&departmentId=${departmentFilter}`)})

 const save=useMutation({mutationFn:(payload:any)=>api(selected&&modal==='edit'?`/employees/${selected.id}`:'/employees',{method:selected&&modal==='edit'?'PUT':'POST',body:JSON.stringify(payload)}),onSuccess:()=>{queryClient.invalidateQueries({queryKey:['employees']});setModal(null);setSelected(null);setToast('Employee saved successfully')},onError:(err)=>setToast((err as Error).message)})
 const changeStatus=useMutation({mutationFn:(payload:{id:string;status:string})=>api(`/employees/${payload.id}/status`,{method:'PATCH',body:JSON.stringify({employmentStatus:payload.status})}),onSuccess:()=>{queryClient.invalidateQueries({queryKey:['employees']});setModal(null);setToast('Employment status updated')},onError:(err)=>setToast((err as Error).message)})

 function openCreate(){setSelected(null);setModal('create')}
 async function openView(employee:any){const detail=await api(`/employees/${employee.id}`);setSelected(detail.data);setModal('view')}

 return <>
  <PageTitle title="Employees" subtitle="Manage employee records and status"/>
  {toast&&<div className="toast" role="status"><span>{toast}</span><button aria-label="Dismiss notification" onClick={()=>setToast('')}>×</button></div>}
  <div className="employee-actions"><button className="primary-button" onClick={openCreate}>+ Add employee</button></div>
  <div className="toolbar employee-toolbar">
   <input aria-label="Search employees" placeholder="Search name, email or employee ID" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
   <select aria-label="Filter by status" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1)}}><option value="">All statuses</option><option>ACTIVE</option><option>INACTIVE</option></select>
   <select aria-label="Filter by country" value={countryFilter} onChange={e=>{setCountryFilter(e.target.value);setPage(1)}}><option value="">All countries</option>{countries.data?.data.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
   <select aria-label="Filter by department" value={departmentFilter} onChange={e=>{setDepartmentFilter(e.target.value);setPage(1)}}><option value="">All departments</option>{departments.data?.data.map((d:any)=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
   <select aria-label="Rows per page" value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}>{[10,15,20,25,50].map(n=><option key={n}>{n}</option>)}</select>
  </div>
  {isLoading?<Loading/>:error?<ErrorState message={(error as Error).message}/>:<><Panel title="Employee directory"><div className="table-wrap"><table><thead><tr><th>Employee</th><th>Employee ID</th><th>Department</th><th>Country</th><th>Status</th><th>Actions</th></tr></thead><tbody>{data.data.map((e:any)=><tr key={e.id}><td><strong>{e.firstName} {e.lastName}</strong><small>{e.email}</small></td><td>{e.employeeId}</td><td>{e.department.name}</td><td>{e.country.name}</td><td><span className={e.employmentStatus==='ACTIVE'?'badge active':'badge'}>{e.employmentStatus}</span></td><td><button className="table-button" onClick={()=>openView(e)}>View</button><button className="table-button" onClick={()=>{setSelected(e);setModal('edit')}}>Edit</button></td></tr>)}</tbody></table></div></Panel><Pager page={page} totalPages={data.meta.totalPages} setPage={setPage}/></> }
  {modal&&<EmployeeModal mode={modal} employee={selected} countries={countries.data?.data||[]} departments={departments.data?.data||[]} onClose={()=>{setModal(null);setSelected(null)}} onSave={(payload)=>save.mutate(payload)} onStatus={(status)=>changeStatus.mutate({id:selected.id,status})} saving={save.isPending||changeStatus.isPending}/>} 
 </>
}

function Salaries(){
 const [search,setSearch]=useState('')
 const [debouncedSearch,setDebouncedSearch]=useState('')
 const [page,setPage]=useState(1)
 const [pageSize,setPageSize]=useState(25)
 useEffect(()=>{const timeout=window.setTimeout(()=>setDebouncedSearch(search.trim()),300);return ()=>window.clearTimeout(timeout)},[search])
 const {data,isLoading,error}=useQuery({queryKey:['salary-list',debouncedSearch,page,pageSize],queryFn:()=>api(`/salaries?search=${encodeURIComponent(debouncedSearch)}&page=${page}&pageSize=${pageSize}`)})
 return <>
  <PageTitle title="Salary Management" subtitle="Current compensation records"/>
  <div className="toolbar salary-toolbar">
   <input aria-label="Search salaries" placeholder="Search employee name, email or employee ID" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
   <select aria-label="Salary rows per page" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1)}}>{[10,15,20,25,50].map(n=><option key={n} value={n}>{n} per page</option>)}</select>
  </div>
  <Panel title="Salary records">{isLoading?<Loading/>:error?<ErrorState message={(error as Error).message}/>:<><div className="table-wrap"><table><thead><tr><th>Employee</th><th>Base salary</th><th>Bonus</th><th>Allowances</th><th>Deductions</th><th>Currency</th></tr></thead><tbody>{data.data.length?data.data.map((r:any)=><tr key={r.id}><td><strong>{r.employee.firstName} {r.employee.lastName}</strong><small>{r.employee.employeeId}</small></td><td>{r.baseSalary}</td><td>{r.bonus}</td><td>{r.allowances}</td><td>{r.deductions}</td><td>{r.currency}</td></tr>):<tr><td colSpan={6}><div className="empty-state">No salary records match your search</div></td></tr>}</tbody></table></div><Pager page={page} totalPages={data.meta.totalPages} setPage={setPage}/></>}</Panel>
 </>
}

function Reports(){
 const summary=useQuery({queryKey:['report-summary'],queryFn:()=>api('/reports/salary-summary')})
 const top=useQuery({queryKey:['top-paid'],queryFn:()=>api('/reports/top-paid-employees')})
 if(summary.isLoading||top.isLoading)return <Loading label="Building reports"/>
 if(summary.isError||top.isError)return <ErrorState message="Unable to load reports"/>
 const rows=Object.entries(summary.data.data).map(([currency,v]:any)=>({currency,total:v.total,average:v.average,count:v.count}))
 return <><PageTitle title="Reports & Analytics" subtitle="Currency-aware compensation insights"/><div className="grid2"><Panel title="Salary summary"><div className="chart"><ResponsiveContainer><BarChart data={rows}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="currency"/><YAxis/><Tooltip/><Bar dataKey="total" fill="#5267df"/></BarChart></ResponsiveContainer></div></Panel><Panel title="Top 10 paid employees"><ol className="ranked">{top.data.data.map((r:any,i:number)=><li key={r.employeeId}><span>{i+1}</span><div><strong>{r.name}</strong><small>{r.employeeId}</small></div><b>{r.compensation.toLocaleString()} {r.currency}</b></li>)}</ol></Panel></div></>
}

function Audit(){
 const {data,isLoading,error}=useQuery({queryKey:['audit'],queryFn:()=>api('/audit-logs?pageSize=25')})
 return <><PageTitle title="Audit Logs" subtitle="Salary and employee change history"/><Panel title="Recent activity">{isLoading?<Loading/>:error?<ErrorState message={(error as Error).message}/>:<div className="table-wrap"><table><thead><tr><th>Action</th><th>Entity</th><th>Date</th></tr></thead><tbody>{data.data.map((a:any)=><tr key={a.id}><td>{a.action}</td><td>{a.entityType} · {a.entityId}</td><td>{new Date(a.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>}</Panel></>
}

function EmployeeModal({mode,employee,countries,departments,onClose,onSave,onStatus,saving}:{mode:'create'|'edit'|'view';employee:any;countries:any[];departments:any[];onClose:()=>void;onSave:(payload:any)=>void;onStatus:(status:string)=>void;saving:boolean}){
 const [form,setForm]=useState(()=>({
  employeeId:employee?.employeeId||'',firstName:employee?.firstName||'',lastName:employee?.lastName||'',email:employee?.email||'',
  departmentId:employee?.departmentId||'',designation:employee?.designation||'',countryId:employee?.countryId||'',currency:employee?.currency||'USD',
  joiningDate:employee?.joiningDate?String(employee.joiningDate).slice(0,10):new Date().toISOString().slice(0,10),employmentStatus:employee?.employmentStatus||'ACTIVE'
 }))
 function submit(e:React.FormEvent){e.preventDefault();onSave({...form,currency:form.currency.toUpperCase(),joiningDate:new Date(form.joiningDate+'T00:00:00.000Z').toISOString()})}
 if(mode==='view')return <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="employee-dialog-title"><div className="modal-header"><div><h2 id="employee-dialog-title">{employee.firstName} {employee.lastName}</h2><p>{employee.employeeId}</p></div><button aria-label="Close" onClick={onClose}>×</button></div><div className="detail-grid"><div><span>Email</span><strong>{employee.email}</strong></div><div><span>Designation</span><strong>{employee.designation}</strong></div><div><span>Department</span><strong>{employee.department?.name}</strong></div><div><span>Country</span><strong>{employee.country?.name}</strong></div><div><span>Currency</span><strong>{employee.currency}</strong></div><div><span>Status</span><strong>{employee.employmentStatus}</strong></div></div><div className="modal-actions"><button onClick={()=>onStatus(employee.employmentStatus==='ACTIVE'?'INACTIVE':'ACTIVE')} disabled={saving}>{employee.employmentStatus==='ACTIVE'?'Mark inactive':'Mark active'}</button><button className="primary-button" onClick={onClose}>Close</button></div></section></div>
 return <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="employee-dialog-title"><div className="modal-header"><div><h2 id="employee-dialog-title">{mode==='create'?'Add employee':'Edit employee'}</h2><p>{mode==='create'?'Create a new employee record':'Update employee information'}</p></div><button aria-label="Close" onClick={onClose}>×</button></div><form onSubmit={submit} className="employee-form"><label>Employee ID<input value={form.employeeId} onChange={e=>setForm({...form,employeeId:e.target.value})} required disabled={mode==='edit'}/></label><label>First name<input value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})} required/></label><label>Last name<input value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})} required/></label><label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label><label>Designation<input value={form.designation} onChange={e=>setForm({...form,designation:e.target.value})} required/></label><label>Department<select value={form.departmentId} onChange={e=>setForm({...form,departmentId:e.target.value})} required><option value="">Select department</option>{departments.map((d:any)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Country<select value={form.countryId} onChange={e=>setForm({...form,countryId:e.target.value})} required><option value="">Select country</option>{countries.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Currency<input maxLength={3} value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})} required/></label><label>Joining date<input type="date" value={form.joiningDate} onChange={e=>setForm({...form,joiningDate:e.target.value})} required/></label><label>Status<select value={form.employmentStatus} onChange={e=>setForm({...form,employmentStatus:e.target.value})}><option>ACTIVE</option><option>INACTIVE</option></select></label><div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving?'Saving…':'Save employee'}</button></div></form></section></div>
}

function PageTitle({title,subtitle}:{title:string;subtitle:string}){return <div className="page-title"><div><h1>{title}</h1><p>{subtitle}</p></div></div>}
function Stat({label,value}:{label:string;value:string}){return <div className="stat"><span>{label}</span><strong>{value}</strong></div>}
function Panel({title,children}:{title:string;children:React.ReactNode}){return <section className="panel"><h2>{title}</h2>{children}</section>}
function Loading({label='Loading'}:{label?:string}){return <div className="loading"><span/> {label}…</div>}
function ErrorState({message}:{message:string}){return <div className="error-state"><strong>Something went wrong</strong><span>{message}</span></div>}
function Pager({page,totalPages,setPage}:{page:number;totalPages:number;setPage:(n:number)=>void}){return <div className="pager"><button disabled={page<=1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page} of {totalPages}</span><button disabled={page>=totalPages} onClick={()=>setPage(page+1)}>Next</button></div>}

function Protected(){const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);if(!ready)return null;return localStorage.getItem('company_token')?<Shell/>:<Navigate to="/login"/>}

export default function App(){return <QueryClientProvider client={queryClient}><BrowserRouter><Routes><Route path="/login" element={<Login/>}/><Route path="/*" element={<Protected/>}/></Routes></BrowserRouter></QueryClientProvider>}
