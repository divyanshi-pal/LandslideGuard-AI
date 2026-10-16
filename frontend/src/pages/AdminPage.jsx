import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api/client'
import History from '../components/History'
import {
  BellIcon,
  CameraIcon,
  CheckCircleIcon,
  CheckIcon,
  ClipboardIcon,
  HistoryIcon,
  LogoMark,
  LogoutIcon,
  RefreshIcon,
  SearchIcon,
  ShieldIcon,
  SlidersIcon,
  TrashIcon,
  VideoIcon,
  XCircleIcon,
} from '../components/Icons'
import { ReachActions, ReportFacts, ReportMedia, reportTitle } from '../components/ReportView'
import {
  Card,
  CardHeader,
  DemoTag,
  Drawer,
  EmptyState,
  ErrorBox,
  Field,
  KindBadge,
  Loading,
  Notice,
  RiskBadge,
  Skeleton,
  Spinner,
  StatusBadge,
  Tag,
} from '../components/ui'
import { useAuth } from '../lib/auth'
import { INDIA_STATES } from '../lib/india'
import { matchesQuery } from '../lib/incidentSearch'
import {
  LEVELS,
  LOCATION_SOURCE_LABELS,
  REPORT_CATEGORIES,
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  SEVERITY_LABELS,
  alertKind,
  formatDateTime,
  sourceLabel,
  timeAgo,
} from '../lib/risk'
import { useAsync } from '../lib/useAsync'

// ---------------------------------------------------------------- login
function LoginForm() {
  const { login } = useAuth()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(username, password)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md py-6 sm:py-12">
      <Card className="p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <LogoMark className="h-11 w-11" />
          <div>
            <h1 className="text-xl font-bold text-ink">Administrator sign in</h1>
            <p className="text-sm text-ink-muted">Review reports, issue alerts, run assessments.</p>
          </div>
        </div>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Username" htmlFor="u">
            <input id="u" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </Field>
          <Field label="Password" htmlFor="p">
            <input id="p" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          <ErrorBox error={error} title="Sign in failed" />
          <button className="btn-primary w-full py-3" disabled={busy}>
            {busy ? <Spinner /> : <ShieldIcon className="h-4 w-4" />} {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-center text-xs text-ink-muted">
            Credentials come from <code>ADMIN_USERNAME</code> / <code>ADMIN_PASSWORD</code> in <code>backend\.env</code>.
          </p>
        </form>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- review drawer
const ACTIONS = [
  { status: 'verified', label: 'Verify & publish', icon: CheckCircleIcon, cls: 'btn-primary', done: 'Report verified and published.' },
  { status: 'resolved', label: 'Mark resolved', icon: CheckIcon, cls: 'btn-secondary', done: 'Report marked as resolved.' },
  { status: 'rejected', label: 'Reject', icon: XCircleIcon, cls: 'btn-danger', done: 'Report rejected - it will not be published.' },
  { status: 'pending', label: 'Back to unverified', icon: HistoryIcon, cls: 'btn-ghost', done: 'Report moved back to unverified.' },
]

function LocationEditor({ report, onSave, busy }) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState({ state: report.state ?? '', district: report.district ?? '', address: report.address ?? '' })
  useEffect(() => setValues({ state: report.state ?? '', district: report.district ?? '', address: report.address ?? '' }), [report])
  if (!open) return <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(true)}>Correct location details</button>
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }))
  return (
    <div className="space-y-3 rounded-2xl border border-line p-4">
      <p className="text-sm font-semibold text-ink">Correct location details</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="State / UT" htmlFor="fix-state">
          <select id="fix-state" className="input" value={values.state} onChange={set('state')}>
            <option value="">State not given</option>
            {INDIA_STATES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="District" htmlFor="fix-district"><input id="fix-district" className="input" value={values.district} onChange={set('district')} /></Field>
      </div>
      <Field label="Address" htmlFor="fix-address"><input id="fix-address" className="input" value={values.address} onChange={set('address')} /></Field>
      <p className="text-xs text-ink-muted">Coordinates cannot be edited; they stay exactly as reported.</p>
      <div className="flex gap-2">
        <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={() => onSave(values).then((ok) => ok && setOpen(false))}>Save</button>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}

function ReviewDrawer({ id, onClose, onChanged, onAuthError }) {
  const detail = useAsync((o) => api.admin.reportDetail(id, o), [id])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState('')
  const [notes, setNotes] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const r = detail.data?.report

  useEffect(() => { setNotes(r?.admin_notes ?? '') }, [r?.admin_notes, r?.id])
  useEffect(() => { if (detail.error?.status === 401) onAuthError() }, [detail.error, onAuthError])

  async function act(fn, doneMessage) {
    setBusy(true)
    setError(null)
    setMessage('')
    try {
      await fn()
      setMessage(doneMessage)
      detail.reload()
      onChanged()
      return true
    } catch (err) {
      if (err.status === 401) onAuthError()
      else setError(err)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (await act(() => api.admin.deleteReport(id), 'Report deleted.')) onClose()
  }

  const title = r ? (
    <div>
      <p className="eyebrow">Report #{r.id}</p>
      <p className="mt-0.5 text-lg font-semibold text-ink">{reportTitle(r)}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <StatusBadge status={r.status} />
        <Tag>{SEVERITY_LABELS[r.observed_severity]}</Tag>
        {r.is_demo ? <DemoTag /> : null}
        {r.possible_duplicate_of ? <Tag tone="amber">Possible duplicate of #{r.possible_duplicate_of}</Tag> : null}
      </div>
    </div>
  ) : `Report #${id}`

  const footer = r ? (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {ACTIONS.filter((a) => a.status !== r.status).map((a) => (
          <button key={a.status} type="button" className={`${a.cls} btn-sm`} disabled={busy}
            onClick={() => act(() => api.admin.updateReport(id, { status: a.status }), a.done)}>
            <a.icon className="h-4 w-4" /> {a.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={`/reports/${r.id}`} className="btn-ghost btn-sm">Open full page</Link>
        {confirmDelete ? (
          <span className="flex items-center gap-2 text-xs text-red-800">
            Delete permanently, with photo and video?
            <button type="button" className="btn-danger btn-sm" onClick={remove} disabled={busy}>Yes, delete</button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </span>
        ) : (
          <button type="button" className="btn-ghost btn-sm text-red-700" onClick={() => setConfirmDelete(true)}><TrashIcon className="h-4 w-4" /> Delete</button>
        )}
      </div>
    </div>
  ) : null

  return (
    <Drawer open onClose={onClose} title={title} footer={footer} width="sm:max-w-2xl">
      <div className="space-y-5 px-5 py-5">
        <p className="sr-only" role="status" aria-live="polite">{message}</p>
        {message ? <Notice tone="success">{message}</Notice> : null}
        <ErrorBox error={error} />
        <ErrorBox error={detail.error?.status === 401 ? null : detail.error} onRetry={detail.reload} />
        {!r && detail.loading ? <div className="space-y-3"><Skeleton className="h-40 w-full" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /></div> : null}
        {r ? (
          <>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{r.description}</p>
            <ReportMedia report={r} admin />
            <div className="rounded-2xl border border-line px-4"><ReportFacts report={r} admin /></div>
            {r.location_source !== 'gps' ? (
              <p className="text-xs text-ink-muted">
                The location was {r.location_source === 'map' ? 'picked on a map' : r.location_source === 'manual' ? 'typed in' : 'not GPS-recorded'} - confirm with the reporter if possible.
              </p>
            ) : null}
            <ReachActions report={r} admin />
            <LocationEditor report={r} busy={busy} onSave={(values) => act(() => api.admin.updateReport(id, values), 'Location details saved.')} />
            <div>
              <label htmlFor="notes" className="label">Internal notes <span className="font-normal text-ink-muted">(never public)</span></label>
              <textarea id="notes" rows={3} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Called the reporter; field team confirmed cracks." />
              <button type="button" className="btn-secondary btn-sm mt-2" disabled={busy || notes === (r.admin_notes ?? '')}
                onClick={() => act(() => api.admin.updateReport(id, { admin_notes: notes }), 'Note saved.')}>
                Save note
              </button>
            </div>
            <div>
              <p className="mb-3 flex items-center gap-2 font-semibold text-ink"><HistoryIcon className="h-4 w-4" /> Verification history</p>
              <History history={detail.data.history} status={r.status} showActors />
            </div>
          </>
        ) : null}
      </div>
    </Drawer>
  )
}

// ---------------------------------------------------------------- reports
const STATUS_FILTERS = [{ key: '', label: 'All' }, ...REPORT_STATUSES.map((s) => ({ key: s, label: { pending: 'Unverified', verified: 'Verified', resolved: 'Resolved', rejected: 'Rejected' }[s] }))]

function ReportsTab({ onAuthError }) {
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status')
  const status = statusParam === 'all' ? '' : statusParam ?? 'pending' // default: reports awaiting review
  const openId = Number(params.get('report')) || null
  const [query, setQuery] = useState('')
  const [state, setState] = useState('')
  const [category, setCategory] = useState('')
  const reports = useAsync((o) => api.admin.reports({ limit: 2000 }, o))

  useEffect(() => { if (reports.error?.status === 401) onAuthError() }, [reports.error, onAuthError])

  const all = reports.data ?? []
  const counts = useMemo(() => all.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] ?? 0) + 1 }), {}), [all])
  const rows = all.filter((r) =>
    (!status || r.status === status) &&
    (!state || (state === 'unspecified' ? !r.state : r.state === state)) &&
    (!category || r.category === category) &&
    matchesQuery(r, query),
  )

  const updateParams = (changes) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k))
    setParams(next, { replace: true })
  }
  const closeDrawer = useCallback(() => updateParams({ report: null }), [params]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">Citizen reports</h2>
          <p className="text-sm text-ink-muted">Review each report before it becomes public. A photo alone never verifies a report.</p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={reports.reload} disabled={reports.loading}>
          <RefreshIcon className={`h-4 w-4 ${reports.loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter by status">
        {STATUS_FILTERS.map((s) => {
          const n = s.key ? counts[s.key] ?? 0 : all.length
          const active = status === s.key
          return (
            <button key={s.key || 'all'} type="button" aria-pressed={active} onClick={() => updateParams({ status: s.key || 'all' })}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${active ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink-2 hover:border-brand-300'}`}>
              {s.label}
              <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-white/20' : 'bg-plane text-ink-muted'}`}>{n}</span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative" role="search">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input type="search" className="input pl-9" placeholder="Search #ID, place, landmark or text" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search reports" />
        </div>
        <select className="input sm:w-48" value={state} onChange={(e) => setState(e.target.value)} aria-label="Filter by state">
          <option value="">All states</option>
          <option value="unspecified">State not given</option>
          {INDIA_STATES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="input sm:w-56" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by incident type">
          <option value="">All incident types</option>
          {Object.entries(REPORT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <ErrorBox error={reports.error?.status === 401 ? null : reports.error} onRetry={reports.reload} />

      <Card className={`overflow-hidden ${reports.loading && reports.data ? 'opacity-60' : ''}`}>
        {reports.loading && !reports.data ? <div className="space-y-2 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : null}
        {reports.data && rows.length === 0 ? (
          <EmptyState icon={<SlidersIcon className="h-6 w-6" />} title="No reports match">
            {status === 'pending' && !query && !state && !category ? 'Nothing is waiting for review.' : 'Try another status, search or filter.'}
          </EmptyState>
        ) : null}
        {rows.length ? (
          <>
            {/* table on medium screens and up */}
            <div className="hidden overflow-x-auto md:block">
              <table className="table-basic">
                <thead>
                  <tr><th>Report</th><th>Location</th><th>Status</th><th>Severity</th><th>Received</th><th><span className="sr-only">Media</span></th><th><span className="sr-only">Action</span></th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={`cursor-pointer hover:bg-plane ${openId === r.id ? 'bg-brand-50' : ''}`} onClick={() => updateParams({ report: String(r.id) })}>
                      <td className="max-w-xs">
                        <span className="font-semibold text-ink">#{r.id} · {REPORT_CATEGORIES[r.category] ?? r.category}</span>
                        {r.is_demo ? <span className="ml-1.5"><DemoTag /></span> : null}
                        <span className="mt-0.5 block truncate text-xs text-ink-muted">{r.description}</span>
                      </td>
                      <td>
                        <span className="block text-ink-2">{[r.district, r.state].filter(Boolean).join(', ') || 'Not given'}</span>
                        <span className="text-xs text-ink-muted">{LOCATION_SOURCE_LABELS[r.location_source]}{r.location_accuracy_m ? ` ±${Math.round(r.location_accuracy_m)} m` : ''}</span>
                      </td>
                      <td><StatusBadge status={r.status} short /></td>
                      <td className="text-ink-2">{SEVERITY_LABELS[r.observed_severity]}</td>
                      <td className="whitespace-nowrap text-ink-muted">{timeAgo(r.created_at)}</td>
                      <td className="text-ink-muted">
                        <span className="flex gap-1">
                          {r.photo_url ? <CameraIcon className="h-4 w-4" title="Has photo" /> : null}
                          {r.video_url ? <VideoIcon className="h-4 w-4" title="Has video" /> : null}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); updateParams({ report: String(r.id) }) }}>
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* card list on small screens */}
            <ul className="divide-y divide-line md:hidden">
              {rows.map((r) => (
                <li key={r.id}>
                  <button type="button" className="w-full px-4 py-3 text-left hover:bg-plane" onClick={() => updateParams({ report: String(r.id) })}>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-ink">#{r.id} · {REPORT_CATEGORIES[r.category] ?? r.category}</span>
                      <StatusBadge status={r.status} short />
                      {r.is_demo ? <DemoTag /> : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {[r.district, r.state].filter(Boolean).join(', ') || 'State not given'} · {SEVERITY_LABELS[r.observed_severity]} · {timeAgo(r.created_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Card>
      <p className="text-xs text-ink-muted">Showing {rows.length} of {all.length} reports.</p>

      {openId ? <ReviewDrawer id={openId} onClose={closeDrawer} onChanged={reports.reload} onAuthError={onAuthError} /> : null}
    </div>
  )
}

// ---------------------------------------------------------------- alerts
const EMPTY_ALERT = { title: '', message: '', level: 'High', location_id: '', state: '', official_source: '', official_reference: '' }

function AlertsTab({ onAuthError }) {
  const alerts = useAsync((o) => api.alerts('all', o))
  const locations = useAsync((o) => api.locations(undefined, o))
  const [form, setForm] = useState(EMPTY_ALERT)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function run(fn, done) {
    setBusy(true)
    setError(null)
    setMessage('')
    try {
      await fn()
      alerts.reload()
      setMessage(done)
      return true
    } catch (err) {
      if (err.status === 401) onAuthError()
      else setError(err)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function create(e) {
    e.preventDefault()
    const body = {
      title: form.title,
      message: form.message,
      level: form.level,
      location_id: form.location_id ? Number(form.location_id) : null,
      state: form.state || null,
      official_source: form.official_source.trim() || null,
      official_reference: form.official_reference.trim() || null,
    }
    if (await run(() => api.admin.createAlert(body), 'Alert published.')) setForm(EMPTY_ALERT)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-ink">Alerts</h2>
        <p className="text-sm text-ink-muted">Automatic model-estimate alerts, your advisories, and official warnings you relay with their source.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader icon={<BellIcon className="h-4 w-4" />} title="Issue an alert" subtitle="Published immediately on the public Alerts page." />
          <form onSubmit={create} className="space-y-4 p-5">
            <Field label="Title" htmlFor="at" required><input id="at" className="input" value={form.title} onChange={set('title')} minLength={3} maxLength={200} required /></Field>
            <Field label="Message" htmlFor="am" required><textarea id="am" rows={4} className="input" value={form.message} onChange={set('message')} minLength={3} maxLength={2000} required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Level" htmlFor="al">
                <select id="al" className="input" value={form.level} onChange={set('level')}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
              </Field>
              <Field label="State" htmlFor="as">
                <select id="as" className="input" value={form.state} onChange={set('state')} disabled={!!form.location_id}>
                  <option value="">{form.location_id ? 'From location' : 'Any / none'}</option>
                  {INDIA_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Monitored location (optional)" htmlFor="aloc">
              <select id="aloc" className="input" value={form.location_id} onChange={set('location_id')}>
                <option value="">No specific location</option>
                {(locations.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.name} ({l.state})</option>)}
              </select>
            </Field>
            <div className="rounded-2xl bg-plane p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><KindBadge kind="official" /> Relaying an official warning?</p>
              <div className="space-y-3">
                <Field label="Issuing body" htmlFor="aos" hint="Only if you reproduce a warning from IMD, NDMA, an SDMA or a DDMA. Leave empty for your own advisory.">
                  <input id="aos" className="input" value={form.official_source} onChange={set('official_source')} maxLength={200} placeholder="e.g. DDMA Chamoli" />
                </Field>
                <Field label="Link to the official warning" htmlFor="aor">
                  <input id="aor" type="url" className="input" value={form.official_reference} onChange={set('official_reference')} maxLength={500} placeholder="https://…" />
                </Field>
              </div>
            </div>
            <ErrorBox error={error} />
            {message ? <p className="text-sm font-medium text-brand-700" role="status">{message}</p> : null}
            <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : <BellIcon className="h-4 w-4" />} Publish alert</button>
          </form>
        </Card>
        <div className="space-y-3 lg:col-span-3">
          <ErrorBox error={alerts.error} onRetry={alerts.reload} />
          {alerts.loading && !alerts.data ? <Loading /> : null}
          {alerts.data && alerts.data.length === 0 ? <Card><EmptyState icon={<BellIcon className="h-6 w-6" />} title="No alerts yet" /></Card> : null}
          {(alerts.data ?? []).map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge level={a.level} />
                <Tag tone={a.status === 'active' ? 'amber' : 'green'}>{a.status === 'active' ? 'Active' : 'Resolved'}</Tag>
                <Tag tone={alertKind(a).tone}>{alertKind(a).label}</Tag>
                {a.is_demo ? <DemoTag /> : null}
                <span className="text-xs text-ink-muted">{formatDateTime(a.created_at)}</span>
                <button type="button" className="btn-secondary btn-sm ml-auto" disabled={busy}
                  onClick={() => run(() => api.admin.updateAlert(a.id, { status: a.status === 'active' ? 'resolved' : 'active' }), a.status === 'active' ? 'Alert resolved.' : 'Alert reactivated.')}>
                  {a.status === 'active' ? 'Resolve' : 'Reactivate'}
                </button>
              </div>
              <p className="mt-2 text-sm font-medium text-ink">{a.title}</p>
              {a.source === 'system' ? <p className="mt-1 text-xs text-ink-muted">System alerts are re-evaluated on every assessment refresh and resolve automatically when the level drops.</p> : null}
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- system
function SystemTab({ onAuthError }) {
  const meta = useAsync((o) => api.meta(o))
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    setBusy(true)
    setError(null)
    try {
      setResult(await api.admin.refresh())
    } catch (err) {
      if (err.status === 401) onAuthError()
      else setError(err)
    } finally {
      setBusy(false)
    }
  }

  const m = meta.data
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-ink">System</h2>
        <p className="text-sm text-ink-muted">Risk assessments for the 46 monitored towns, and the ML model status.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<RefreshIcon className="h-4 w-4" />} title="Re-run risk assessment" subtitle="Fetches rainfall for all locations, recomputes risk and updates automatic alerts." />
          <div className="space-y-4 p-5">
            {m ? (
              <p className="text-sm text-ink-2">
                Weather provider: <strong className="text-ink">{m.weather_provider}</strong>{' '}
                {m.weather_provider === 'demo' ? <DemoTag>Simulated</DemoTag> : null}
              </p>
            ) : null}
            <button type="button" className="btn-primary" onClick={refresh} disabled={busy}>
              {busy ? <Spinner /> : <RefreshIcon className="h-4 w-4" />} {busy ? 'Assessing all locations…' : 'Refresh assessments now'}
            </button>
            <ErrorBox error={error} />
            {result ? (
              <Notice tone={result.warnings.length ? 'warn' : 'success'} title={`Assessed ${result.assessed} locations`}>
                Data source: {sourceLabel(result.data_source)}. Alerts created {result.alerts_created}, updated {result.alerts_updated}, resolved {result.alerts_resolved}.
                {result.warnings.map((w) => <span key={w} className="mt-1 block">{w}</span>)}
              </Notice>
            ) : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="ML model" subtitle="Experimental - never used to trigger alerts" />
          <div className="space-y-3 p-5 text-sm text-ink-2">
            {m ? (
              m.model.available ? (
                <>
                  <p>Model: <strong className="text-ink">{m.model.model_name}</strong>, trained {formatDateTime(m.model.trained_at)}.</p>
                  {m.model.is_synthetic ? <Notice tone="warn">Trained on synthetic data. Its probabilities are illustrative only.</Notice> : null}
                </>
              ) : <Notice>{m.model.message}</Notice>
            ) : <Loading />}
            <p>
              Retrain with <code className="rounded bg-plane px-1">python -m ml.train</code> (or <code className="rounded bg-plane px-1">--data your.csv</code>) in the backend folder.
              The API reloads the model automatically. Full model card on the <Link to="/methodology" className="font-medium text-brand-700 underline">Methodology</Link> page.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page
const TABS = [
  { key: 'reports', label: 'Citizen reports', icon: ClipboardIcon },
  { key: 'alerts', label: 'Alerts', icon: BellIcon },
  { key: 'system', label: 'System', icon: RefreshIcon },
]

export default function AdminPage() {
  const { user, checking, logout } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'reports'
  const pending = useAsync((o) => (user ? api.dashboard(o) : Promise.resolve(null)), [user])
  const pendingCount = pending.data?.reports?.pending

  if (checking) return <Loading label="Checking session…" />
  if (!user) return <LoginForm />

  const selectTab = (key) => setParams(key === 'reports' ? {} : { tab: key })

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card className="p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 font-semibold text-white" aria-hidden="true">{user.slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{user}</p>
              <p className="text-xs text-brand-700">Administrator</p>
            </div>
          </div>
          <nav className="mt-2 flex gap-1 overflow-x-auto lg:flex-col" aria-label="Admin sections">
            {TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => selectTab(t.key)} aria-current={tab === t.key ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${tab === t.key ? 'bg-brand-50 text-brand-800' : 'text-ink-2 hover:bg-plane'}`}>
                <t.icon className="h-4 w-4" />
                {t.label}
                {t.key === 'reports' && pendingCount ? <span className="ml-auto rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-900" title={`${pendingCount} awaiting review`}>{pendingCount}</span> : null}
              </button>
            ))}
          </nav>
          <div className="mt-2 hidden border-t border-line pt-2 lg:block">
            <button type="button" onClick={logout} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-2 hover:bg-plane">
              <LogoutIcon className="h-4 w-4" /> Sign out
            </button>
          </div>
        </Card>
      </aside>
      <div className="min-w-0">
        {tab === 'reports' ? <ReportsTab onAuthError={logout} /> : null}
        {tab === 'alerts' ? <AlertsTab onAuthError={logout} /> : null}
        {tab === 'system' ? <SystemTab onAuthError={logout} /> : null}
        <p className="mt-8 text-xs text-ink-muted">Every status change, location correction and note is recorded in the report's history with your username.</p>
      </div>
    </div>
  )
}
