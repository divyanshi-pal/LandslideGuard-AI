import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { api } from '../api/client'
import { ArrowRightIcon, ClipboardIcon, CloseIcon, LayersIcon, MapPinIcon, SearchIcon, SlidersIcon } from '../components/Icons'
import { ReachActions, ReportFacts, ReportMedia, reportTitle } from '../components/ReportView'
import { TILE_ATTRIBUTION, TILE_URL, incidentIcon } from '../components/RiskMap'
import { DemoTag, EmptyState, ErrorBox, Skeleton, Spinner, StatusBadge } from '../components/ui'
import { useAuth } from '../lib/auth'
import { matchesQuery } from '../lib/incidentSearch'
import { INDIA_BOUNDS, INDIA_STATES } from '../lib/india'
import { REPORT_CATEGORIES, REPORT_STATUS_LABELS, SEVERITY_LABELS, formatDateTime } from '../lib/risk'
import { useAsync } from '../lib/useAsync'

const EMPTY = { state: '', district: '', category: '', severity: '', status: '', date_from: '', date_to: '' }
const STATUS_ORDER = ['pending', 'verified', 'resolved', 'rejected']

function FitToResults({ points, disabled }) {
  const map = useMap()
  const key = points.map((p) => p.join(',')).join(';')
  useEffect(() => {
    if (disabled) return
    if (points.length === 1) map.setView(points[0], 9)
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 9 })
    else map.fitBounds(INDIA_BOUNDS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map, disabled])
  return null
}

function Legend({ statuses }) {
  return (
    <div className="pointer-events-auto rounded-xl border border-line bg-white/95 p-3 text-xs shadow-(--shadow-card)">
      <div className="mb-1.5 font-semibold text-ink">Citizen reports</div>
      <ul className="space-y-1">
        {statuses.map((s) => (
          <li key={s} className="flex items-center gap-2 text-ink-2">
            <span className="inline-block h-3.5 w-3.5"><span className={`incident-marker status-${s}`} /></span>
            {REPORT_STATUS_LABELS[s]}
          </li>
        ))}
      </ul>
      <div className="mt-2 text-ink-muted">Larger marker = more severe</div>
    </div>
  )
}

function PlaceSearch({ map }) {
  const [q, setQ] = useState('')
  const [state, setState] = useState({ status: 'idle', results: [] })

  async function search(e) {
    e.preventDefault()
    if (q.trim().length < 2) return
    setState({ status: 'loading', results: [] })
    try {
      const res = await api.placeSearch(q.trim())
      setState({ status: res.status, results: res.results ?? [], message: res.message, attribution: res.attribution })
    } catch (err) {
      setState({ status: 'error', results: [], message: err.message })
    }
  }

  function go(place) {
    map?.flyTo([place.latitude, place.longitude], 12)
    setState({ status: 'idle', results: [] })
  }

  return (
    <div>
      <form onSubmit={search} className="flex gap-2" role="search" aria-label="Find a place in India">
        <div className="relative flex-1">
          <MapPinIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a place, e.g. Joshimath" aria-label="Place name" />
        </div>
        <button type="submit" className="btn-secondary px-3" disabled={state.status === 'loading'}>
          {state.status === 'loading' ? <Spinner /> : 'Go'}
        </button>
      </form>
      {state.status === 'ok' ? (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line">
          {state.results.map((p) => (
            <li key={`${p.latitude},${p.longitude}`}>
              <button type="button" onClick={() => go(p)} className="w-full px-3 py-2 text-left text-sm hover:bg-brand-50">
                <span className="block truncate font-medium text-ink">{p.name.split(',')[0]}</span>
                <span className="block truncate text-xs text-ink-muted">{p.name}</span>
              </button>
            </li>
          ))}
          <li className="px-3 py-1.5 text-[11px] text-ink-muted">{state.attribution}</li>
        </ul>
      ) : null}
      {state.status === 'not_found' ? <p className="mt-1.5 text-xs text-ink-muted">No place found in India with that name.</p> : null}
      {state.status === 'error' ? <p className="mt-1.5 text-xs text-red-700">{state.message ?? 'Place search failed.'}</p> : null}
    </div>
  )
}

function DetailsPanel({ report, admin, onClose }) {
  return (
    <aside
      aria-label={`Incident ${report.id} details`}
      className="fixed inset-x-0 bottom-0 z-[900] flex max-h-[75vh] flex-col rounded-t-3xl border border-line bg-white shadow-(--shadow-pop) lg:absolute lg:inset-y-3 lg:left-auto lg:right-3 lg:max-h-none lg:w-[400px] lg:rounded-2xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="eyebrow">Incident #{report.id}</p>
          <h2 className="mt-0.5 text-lg font-semibold text-ink">{reportTitle(report)}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <StatusBadge status={report.status} />
            {report.is_demo ? <DemoTag /> : null}
          </div>
        </div>
        <button type="button" onClick={onClose} className="btn-ghost -mr-2 p-2" aria-label="Close details" autoFocus>
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <p className="text-sm leading-relaxed text-ink">{report.description}</p>
        <ReportMedia report={report} admin={admin} />
        <ReportFacts report={report} admin={admin} />
        <p className="text-xs text-ink-muted">Citizen report - not an official warning and not a risk assessment.</p>
      </div>
      <div className="space-y-2 border-t border-line bg-plane/60 px-5 py-3">
        <Link to={`/reports/${report.id}`} className="btn-primary w-full">
          View full report & history <ArrowRightIcon className="h-4 w-4" />
        </Link>
        {admin ? <ReachActions report={report} admin /> : null}
      </div>
    </aside>
  )
}

export default function IncidentsPage() {
  const [params, setParams] = useSearchParams()
  const focusId = Number(params.get('report')) || null
  const { isAdmin } = useAuth()
  const meta = useAsync((o) => api.meta(o))
  const [adminView, setAdminView] = useState(false)
  const [filters, setFilters] = useState(EMPTY)
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedId, setSelectedId] = useState(focusId)
  const [map, setMap] = useState(null)

  // Arriving from the admin console: the report may still be unverified, so use the admin view.
  useEffect(() => { if (isAdmin && focusId) setAdminView(true) }, [isAdmin, focusId])

  const publicStatuses = meta.data?.reporting?.public_shows_unverified ? ['pending', 'verified', 'resolved'] : ['verified', 'resolved']
  const statusOptions = adminView ? STATUS_ORDER : publicStatuses
  const serverFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  const reports = useAsync(
    (o) => (adminView ? api.admin.reports(serverFilters, o) : api.reports(serverFilters, o)),
    [JSON.stringify(serverFilters), adminView],
  )

  const loaded = reports.data ?? []
  const items = useMemo(() => loaded.filter((r) => matchesQuery(r, query)), [loaded, query])
  const points = useMemo(() => items.map((r) => [r.latitude, r.longitude]), [items])
  const districts = useMemo(() => [...new Set(loaded.filter((r) => r.district).map((r) => r.district))].sort(), [loaded])
  const selected = items.find((r) => r.id === selectedId) ?? loaded.find((r) => r.id === selectedId) ?? null
  const activeCount = Object.values(filters).filter(Boolean).length
  const geocoding = Boolean(meta.data?.reporting?.geocoding?.enabled)

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value, ...(key === 'state' ? { district: '' } : {}) }))

  function select(r, fly = true) {
    setSelectedId(r.id)
    if (fly && map) map.flyTo([r.latitude, r.longitude], Math.max(map.getZoom(), 12), { duration: 0.6 })
  }

  function closeDetails() {
    setSelectedId(null)
    if (params.get('report')) setParams({}, { replace: true })
  }

  // Zoom to a report requested in the URL once it has loaded.
  useEffect(() => {
    if (!map || !focusId) return
    const r = loaded.find((x) => x.id === focusId)
    if (r) map.setView([r.latitude, r.longitude], 14)
  }, [map, focusId, loaded])

  return (
    <div className="flex flex-col lg:h-[calc(100vh-4rem)] lg:flex-row">
      <aside className="flex flex-col border-b border-line bg-white lg:w-[380px] lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="space-y-3 border-b border-line p-4">
          <div>
            <p className="eyebrow">All of India</p>
            <h1 className="mt-0.5 text-xl font-bold text-ink">Incident map</h1>
            <p className="mt-1 text-sm text-ink-2">
              {adminView ? 'Admin view: every status, including unverified and rejected reports.' : 'Citizen reports verified or resolved by an administrator.'}
            </p>
          </div>
          {isAdmin ? (
            <label className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm font-medium text-brand-900">
              <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={adminView}
                onChange={(e) => { setAdminView(e.target.checked); setFilters((f) => ({ ...f, status: '' })) }} />
              Admin view (all statuses)
            </label>
          ) : null}
          <div className="relative" role="search">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              className="input pl-9" value={query} onChange={(e) => setQuery(e.target.value)} type="search"
              placeholder="Search state, district, landmark or #ID" aria-label="Search loaded incidents"
            />
          </div>
          {geocoding ? <PlaceSearch map={map} /> : null}
          <button type="button" className="btn-secondary btn-sm w-full lg:hidden" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="incident-filters">
            <SlidersIcon className="h-4 w-4" /> {showFilters ? 'Hide filters' : `Filters${activeCount ? ` (${activeCount})` : ''}`}
          </button>
          <form id="incident-filters" className={`grid grid-cols-2 gap-2 ${showFilters ? '' : 'hidden'} lg:grid`} onSubmit={(e) => e.preventDefault()} aria-label="Filter incidents">
            <label className="col-span-2 text-xs font-medium text-ink-2">
              State / UT
              <select className="input mt-1" value={filters.state} onChange={set('state')}>
                <option value="">All of India</option>
                <option value="unspecified">Not specified</option>
                {INDIA_STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="col-span-2 text-xs font-medium text-ink-2">
              District
              <select className="input mt-1" value={filters.district} onChange={set('district')} disabled={!filters.state || filters.state === 'unspecified'}>
                <option value="">{filters.state ? 'All districts' : 'Choose a state first'}</option>
                {districts.map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-ink-2">
              Incident type
              <select className="input mt-1" value={filters.category} onChange={set('category')}>
                <option value="">All types</option>
                {Object.entries(REPORT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-ink-2">
              Severity
              <select className="input mt-1" value={filters.severity} onChange={set('severity')}>
                <option value="">Any</option>
                {Object.entries(SEVERITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-ink-2">
              From
              <input type="date" className="input mt-1" value={filters.date_from} onChange={set('date_from')} max={filters.date_to || undefined} />
            </label>
            <label className="text-xs font-medium text-ink-2">
              To
              <input type="date" className="input mt-1" value={filters.date_to} onChange={set('date_to')} min={filters.date_from || undefined} />
            </label>
            <label className="col-span-2 text-xs font-medium text-ink-2">
              Verification status
              <select className="input mt-1" value={filters.status} onChange={set('status')}>
                <option value="">{adminView ? 'All statuses' : 'All public'}</option>
                {statusOptions.map((s) => <option key={s} value={s}>{REPORT_STATUS_LABELS[s]}</option>)}
              </select>
            </label>
            {activeCount ? (
              <button type="button" className="btn-ghost btn-sm col-span-2" onClick={() => setFilters(EMPTY)}>
                Clear {activeCount} filter{activeCount > 1 ? 's' : ''}
              </button>
            ) : null}
          </form>
        </div>

        <div className="px-4 pt-3">
          <ErrorBox error={reports.error} onRetry={reports.reload} title="Could not load incidents" />
        </div>
        <p className="px-4 py-2 text-xs font-semibold text-ink-muted" aria-live="polite">
          {reports.data ? `${items.length} incident${items.length === 1 ? '' : 's'}${query ? ` matching "${query}"` : ''}` : ''}
        </p>
        <ul className={`max-h-80 overflow-y-auto px-2 pb-2 lg:max-h-none lg:flex-1 ${reports.loading ? 'opacity-60' : ''}`}>
          {reports.loading && !reports.data ? [0, 1, 2, 3].map((i) => <li key={i} className="p-2"><Skeleton className="h-12 w-full" /></li>) : null}
          {items.map((r) => (
            <li key={r.id}>
              <button
                type="button" onClick={() => select(r)} aria-pressed={selectedId === r.id}
                className={`w-full rounded-xl px-3 py-2.5 text-left transition ${selectedId === r.id ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-plane'}`}
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold text-ink">{REPORT_CATEGORIES[r.category] ?? r.category}</span>
                  <StatusBadge status={r.status} short />
                  {r.is_demo ? <DemoTag /> : null}
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  #{r.id} · {[r.district, r.state].filter(Boolean).join(', ') || 'State not given'} · {SEVERITY_LABELS[r.observed_severity]} · {formatDateTime(r.observed_at ?? r.created_at)}
                </span>
              </button>
            </li>
          ))}
          {reports.data && items.length === 0 ? (
            <li>
              <EmptyState icon={<LayersIcon className="h-6 w-6" />} title="No incidents found">
                {query || activeCount ? 'Try a different search or clear the filters.' : 'Verified incidents will appear here.'}
              </EmptyState>
            </li>
          ) : null}
        </ul>
        <div className="border-t border-line p-4">
          <Link to="/report" className="btn-primary w-full"><ClipboardIcon className="h-4 w-4" /> Report an Incident</Link>
        </div>
      </aside>

      <div className="relative min-h-[460px] flex-1">
        <MapContainer bounds={INDIA_BOUNDS} minZoom={3} className="h-[65vh] w-full lg:h-full" scrollWheelZoom ref={setMap}>
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <FitToResults points={points} disabled={Boolean(focusId)} />
          {items.map((r) => (
            <Marker
              key={r.id} position={[r.latitude, r.longitude]}
              icon={incidentIcon(r.status, r.observed_severity, r.id === selectedId)}
              title={`${REPORT_CATEGORIES[r.category] ?? r.category} - ${REPORT_STATUS_LABELS[r.status]}`}
              eventHandlers={{ click: () => select(r, false) }}
              keyboard
            />
          ))}
        </MapContainer>
        <div className="pointer-events-none absolute bottom-6 left-3 z-[800]"><Legend statuses={statusOptions} /></div>
        {selected ? <DetailsPanel report={selected} admin={adminView} onClose={closeDetails} /> : null}
      </div>
    </div>
  )
}
