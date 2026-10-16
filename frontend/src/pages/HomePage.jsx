import { Link } from 'react-router'
import { api, assetUrl } from '../api/client'
import HeroArt from '../components/HeroArt'
import {
  ArrowRightIcon,
  BellIcon,
  CheckCircleIcon,
  ClipboardIcon,
  ImageIcon,
  LayersIcon,
  MountainIcon,
  PhoneIcon,
  ShieldIcon,
  SparkIcon,
} from '../components/Icons'
import { DemoTag, EmptyState, KINDS, KindBadge, Skeleton, StatusBadge, Tag } from '../components/ui'
import { REPORT_CATEGORIES, formatDateTime, formatNumber } from '../lib/risk'
import { useAsync } from '../lib/useAsync'

const FEATURES = [
  {
    icon: ClipboardIcon,
    title: 'Citizen reporting',
    text: 'Anyone in India can report landslides, floods, blocked roads, ground cracks or soil movement - with GPS location, photos and video. Every report is reviewed before it is published.',
    to: '/report',
    cta: 'Report an incident',
  },
  {
    icon: SparkIcon,
    title: 'AI risk assessment',
    text: 'A transparent risk index plus an experimental machine-learning model for 46 monitored towns in Northeast India, using live rainfall data. Every factor is shown - nothing hidden.',
    to: '/map',
    cta: 'Open the risk monitor',
    tag: 'Model estimates · Northeast India',
  },
  {
    icon: BellIcon,
    title: 'Early warnings',
    text: 'Automatic alerts when a monitored town reaches High or Very High risk, and official warnings relayed with the name of the issuing authority.',
    to: '/alerts',
    cta: 'View alerts',
  },
]

const STEPS = [
  { icon: ClipboardIcon, title: 'Report', text: 'A resident reports what they see, with location and photos. It starts as an unverified citizen report.' },
  { icon: ShieldIcon, title: 'Verify', text: 'An administrator reviews the report and verifies, resolves or rejects it. Every change is recorded.' },
  { icon: LayersIcon, title: 'Respond', text: 'Verified incidents appear on the India-wide map, and responders can navigate straight to the spot.' },
]

function HeroStat({ label, value, loading }) {
  return (
    <div className="min-w-0">
      {loading ? <Skeleton className="h-8 w-16 bg-white/20" /> : <div className="text-2xl font-bold text-white sm:text-3xl">{value}</div>}
      <div className="mt-0.5 text-xs font-medium text-white/75 sm:text-sm">{label}</div>
    </div>
  )
}

function IncidentCard({ r }) {
  const place = [r.district, r.state].filter(Boolean).join(', ') || 'Location given by coordinates'
  return (
    <Link to={`/reports/${r.id}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-(--shadow-pop) focus-visible:outline-2 focus-visible:outline-brand-500">
      <div className="relative h-40 bg-plane">
        {r.photo_url ? (
          <img src={assetUrl(r.photo_url)} alt={`Photo of the reported ${REPORT_CATEGORIES[r.category] ?? 'incident'}`} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center text-ink-muted"><ImageIcon className="h-10 w-10" /></div>
        )}
        <div className="absolute left-3 top-3 flex gap-1.5"><StatusBadge status={r.status} short />{r.is_demo ? <DemoTag /> : null}</div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="font-semibold text-ink group-hover:text-brand-700">{REPORT_CATEGORIES[r.category] ?? r.category}</p>
        <p className="mt-0.5 text-sm text-ink-2">{place}</p>
        <p className="mt-auto pt-3 text-xs text-ink-muted">{formatDateTime(r.observed_at ?? r.created_at)}</p>
      </div>
    </Link>
  )
}

export default function HomePage() {
  const summary = useAsync((o) => api.dashboard(o))
  const latest = useAsync((o) => api.reports({ limit: 3 }, o))
  const s = summary.data
  const loading = !s && summary.loading

  return (
    <div>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative isolate overflow-hidden bg-navy-900">
        <HeroArt className="absolute inset-0 -z-10 h-full w-full" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-900/90 via-navy-900/60 to-navy-900/0" aria-hidden="true" />
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:pb-28 lg:pt-24">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-white/90 backdrop-blur">
              <MountainIcon className="h-4 w-4" /> Disaster-management platform for India
            </p>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-6xl">LandslideGuard AI</h1>
            <p className="mt-3 text-2xl font-semibold text-brand-200 sm:text-3xl">Report. Monitor. Stay Safer.</p>
            <p className="mt-5 max-w-xl text-base text-white/85 sm:text-lg">
              Citizens report landslides and floods from anywhere in India. Administrators verify them, risk is monitored
              with live rainfall in Northeast India, and responders can reach the spot fast.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/report" className="btn-primary px-6 py-3 text-base">
                <ClipboardIcon className="h-5 w-5" /> Report an Incident
              </Link>
              <Link to="/incidents" className="btn border border-white/30 bg-white/10 px-6 py-3 text-base text-white backdrop-blur hover:bg-white/20">
                <LayersIcon className="h-5 w-5" /> Explore Incident Map
              </Link>
            </div>
          </div>

          <dl className="mt-12 grid max-w-3xl grid-cols-2 gap-6 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur sm:grid-cols-4" aria-label="Live platform figures">
            <HeroStat loading={loading} label="Reports received" value={formatNumber(s?.reports.total)} />
            <HeroStat loading={loading} label="Verified incidents" value={formatNumber(s?.reports.verified)} />
            <HeroStat loading={loading} label="Active alerts" value={formatNumber(s?.totals.active_alerts)} />
            <HeroStat loading={loading} label="Towns monitored" value={formatNumber(s?.totals.locations)} />
          </dl>
          {summary.error ? <p className="mt-3 text-sm text-amber-200">Live figures are unavailable right now ({summary.error.message}).</p> : null}
          {s?.reports.demo ? <p className="mt-3 text-xs text-white/70">Figures include {s.reports.demo} sample reports marked DEMO.</p> : null}
        </div>
      </section>

      {/* ------------------------------------------------------------ emergency strip */}
      <div className="border-b border-red-100 bg-red-50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm text-red-900 sm:px-6">
          <PhoneIcon className="h-4 w-4" />
          <strong>If anyone is in danger, call 112 first.</strong>
          <span>LandslideGuard is a prototype and does not replace IMD, NDMA, SDMA or DDMA advisories.</span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-20 px-4 py-16 sm:px-6">
        {/* ------------------------------------------------------------ features */}
        <section aria-labelledby="features-title">
          <p className="eyebrow">What the platform does</p>
          <h2 id="features-title" className="mt-2 text-3xl font-bold tracking-tight text-ink">One place to report, verify and monitor</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {FEATURES.map((f) => (
              <Link key={f.title} to={f.to} className="card group flex flex-col p-6 transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-(--shadow-pop) focus-visible:outline-2 focus-visible:outline-brand-500">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
                  <f.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-ink">{f.title}</h3>
                {f.tag ? <span className="mt-2"><Tag tone="gray">{f.tag}</Tag></span> : null}
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-2">{f.text}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                  {f.cta} <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------ how it works */}
        <section aria-labelledby="how-title" className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="eyebrow">How it works</p>
            <h2 id="how-title" className="mt-2 text-3xl font-bold tracking-tight text-ink">From a report to a response</h2>
            <p className="mt-4 text-ink-2">
              A photo alone never makes a report "verified". Only an administrator's review does, and every status change
              is kept in the report's history.
            </p>
          </div>
          <ol className="grid gap-4 sm:grid-cols-3 lg:col-span-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="card p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
                  <step.icon className="h-5 w-5 text-brand-700" />
                </div>
                <h3 className="mt-4 font-semibold text-ink">{step.title}</h3>
                <p className="mt-1 text-sm text-ink-2">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ------------------------------------------------------------ labels */}
        <section aria-labelledby="labels-title" className="card p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Know what you are looking at</p>
              <h2 id="labels-title" className="mt-2 text-2xl font-bold tracking-tight text-ink">Four kinds of information, always labelled</h2>
            </div>
            <Link to="/methodology" className="btn-secondary btn-sm">How risk is computed</Link>
          </div>
          <dl className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(KINDS).map(([key, k]) => (
              <div key={key}>
                <dt><KindBadge kind={key} /></dt>
                <dd className="mt-2 text-sm text-ink-2">{k.help}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ------------------------------------------------------------ latest verified */}
        <section aria-labelledby="latest-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Latest verified incidents</p>
              <h2 id="latest-title" className="mt-2 text-3xl font-bold tracking-tight text-ink">Recently confirmed across India</h2>
            </div>
            <Link to="/incidents" className="btn-secondary">
              Explore the map <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latest.loading && !latest.data
              ? [0, 1, 2].map((i) => (
                  <div key={i} className="card overflow-hidden"><Skeleton className="h-40 w-full rounded-none" /><div className="space-y-2 p-4"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-2/3" /></div></div>
                ))
              : (latest.data ?? []).map((r) => <IncidentCard key={r.id} r={r} />)}
          </div>
          {latest.data && latest.data.length === 0 ? (
            <div className="card mt-6">
              <EmptyState icon={<CheckCircleIcon className="h-6 w-6" />} title="No verified incidents yet" action={<Link to="/report" className="btn-primary btn-sm">Report an incident</Link>}>
                Reports appear here once an administrator has verified them.
              </EmptyState>
            </div>
          ) : null}
          {latest.error ? <p className="mt-4 text-sm text-red-700">Could not load recent incidents: {latest.error.message}</p> : null}
        </section>

        {/* ------------------------------------------------------------ CTA */}
        <section className="overflow-hidden rounded-3xl bg-brand-700 px-6 py-10 text-white sm:px-10">
          <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold sm:text-3xl">Seen cracks, tilting trees or sudden muddy water?</h2>
              <p className="mt-2 text-brand-100">These can be early signs of a landslide. Report them - it takes about a minute.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to="/report" className="btn bg-white px-6 py-3 text-brand-800 hover:bg-brand-50"><ClipboardIcon className="h-5 w-5" /> Report an Incident</Link>
              <Link to="/dashboard" className="btn border border-white/40 px-6 py-3 text-white hover:bg-white/10">Open dashboard</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
