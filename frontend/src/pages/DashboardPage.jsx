import { Link } from 'react-router'
import { api } from '../api/client'
import { IncidentTypesChart, LevelDistributionChart, RainRiskScatter, ReportsTrendChart, StateRiskChart } from '../components/Charts'
import DataSourceNotice from '../components/DataSourceNotice'
import {
  ArrowRightIcon,
  BellIcon,
  CheckCircleIcon,
  ClipboardIcon,
  LayersIcon,
  MountainIcon,
  RefreshIcon,
} from '../components/Icons'
import {
  Card,
  CardHeader,
  DemoTag,
  EmptyState,
  ErrorBox,
  KindBadge,
  Notice,
  PageHeader,
  RiskBadge,
  SectionTitle,
  SkeletonCard,
  StatCard,
  StatusBadge,
  Tag,
} from '../components/ui'
import { useAuth } from '../lib/auth'
import {
  LEVEL_COLORS,
  REPORT_CATEGORIES,
  SEVERITY_LABELS,
  formatDateTime,
  formatNumber,
  formatPercent,
  sourceLabel,
  timeAgo,
} from '../lib/risk'
import { useAsync } from '../lib/useAsync'

function RecentReports({ recent, isAdmin }) {
  const rows = recent.data ?? []
  return (
    <Card>
      <CardHeader
        icon={<ClipboardIcon className="h-4 w-4" />}
        title="Recent reports"
        subtitle={isAdmin ? 'Latest reports of every status (admin view)' : 'Latest verified and resolved incidents'}
        action={<Link to={isAdmin ? '/admin?tab=reports' : '/incidents'} className="btn-ghost btn-sm">{isAdmin ? 'Review reports' : 'Open incident map'} <ArrowRightIcon className="h-4 w-4" /></Link>}
      />
      <ErrorBox error={recent.error} onRetry={recent.reload} />
      {recent.loading && !recent.data ? <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-9 w-full" />)}</div> : null}
      {recent.data && rows.length === 0 ? (
        <EmptyState icon={<ClipboardIcon className="h-6 w-6" />} title="No reports to show yet" action={<Link to="/report" className="btn-primary btn-sm">Report an incident</Link>}>
          {isAdmin ? 'New citizen reports will appear here.' : 'Reports appear here once an administrator has verified them.'}
        </EmptyState>
      ) : null}
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="table-basic">
            <thead>
              <tr><th>ID</th><th>Incident</th><th>Location</th><th>Status</th><th>Severity</th><th>When</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-plane">
                  <td className="tabular">
                    <Link to={`/reports/${r.id}`} className="font-semibold text-brand-700 hover:underline">#{r.id}</Link>
                  </td>
                  <td>
                    <Link to={`/reports/${r.id}`} className="font-medium text-ink hover:text-brand-700">{REPORT_CATEGORIES[r.category] ?? r.category}</Link>
                    {r.is_demo ? <span className="ml-1.5"><DemoTag /></span> : null}
                  </td>
                  <td className="text-ink-2">{[r.district, r.state].filter(Boolean).join(', ') || <span className="text-ink-muted">Not given</span>}</td>
                  <td><StatusBadge status={r.status} short /></td>
                  <td className="text-ink-2">{SEVERITY_LABELS[r.observed_severity] ?? r.observed_severity}</td>
                  <td className="whitespace-nowrap text-ink-muted">{timeAgo(r.observed_at ?? r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  )
}

export default function DashboardPage() {
  const { isAdmin } = useAuth()
  const summary = useAsync((o) => api.dashboard(o))
  const alerts = useAsync((o) => api.alerts('active', o))
  const recent = useAsync((o) => (isAdmin ? api.admin.reports({ limit: 8 }, o) : api.reports({ limit: 8 }, o)), [isAdmin])
  const s = summary.data
  const reloadAll = () => { summary.reload(); alerts.reload(); recent.reload() }

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        subtitle="Citizen incident reports from all of India, and landslide risk monitoring for Northeast India."
      >
        <button type="button" className="btn-secondary" onClick={reloadAll} disabled={summary.loading}>
          <RefreshIcon className={`h-4 w-4 ${summary.loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
        <Link to="/report" className="btn-primary"><ClipboardIcon className="h-4 w-4" /> Report an Incident</Link>
      </PageHeader>

      <ErrorBox error={summary.error} onRetry={summary.reload} title="Could not load the dashboard" />

      {!s && summary.loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <SkeletonCard key={i} lines={1} />)}</div>
          <div className="grid gap-6 lg:grid-cols-2"><SkeletonCard lines={6} /><SkeletonCard lines={6} /></div>
        </div>
      ) : null}

      {s ? (
        <div className={`space-y-12 transition-opacity ${summary.loading ? 'opacity-60' : ''}`}>
          {/* ---------------------------------------------------------- citizen reports */}
          <section aria-labelledby="reports-heading" className="space-y-6">
            <SectionTitle
              eyebrow="Citizen reports · All India"
              title={<span id="reports-heading">Incident reporting</span>}
              subtitle={`Updated ${timeAgo(s.generated_at)}. Counts come directly from the reports database.`}
              action={<span className="flex flex-wrap gap-1.5"><KindBadge kind="citizen" withHelp /><KindBadge kind="verified" withHelp /></span>}
            />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label="Total reports" value={formatNumber(s.reports.total)} icon={<ClipboardIcon className="h-5 w-5" />}
                hint={`${s.reports.pending} awaiting review · ${s.reports.states_reported} states/UTs`}
                help="Every report received, of any status - including unverified ones."
              />
              <StatCard
                label="Verified incidents" value={formatNumber(s.reports.verified)} icon={<CheckCircleIcon className="h-5 w-5" />}
                hint={`${s.reports.resolved} resolved`} to="/incidents"
                help="Reports confirmed by an administrator. A photo alone never verifies a report."
              />
              <StatCard
                label="Active alerts" value={formatNumber(s.totals.active_alerts)} icon={<BellIcon className="h-5 w-5" />}
                hint="View alerts" to="/alerts" accent={s.totals.active_alerts ? LEVEL_COLORS.High : undefined}
                help="Automatic model-estimate alerts, admin advisories and relayed official warnings that are active now."
              />
              <StatCard
                label="Critical locations" value={formatNumber(s.totals.high_or_above)} icon={<MountainIcon className="h-5 w-5" />}
                hint="High or Very High · model estimate" to="/map" accent={s.totals.high_or_above ? LEVEL_COLORS['Very High'] : undefined}
                help="Monitored towns in Northeast India whose latest model estimate is High or Very High. Not an official warning."
              />
            </div>
            {s.reports.demo ? (
              <p className="flex flex-wrap items-center gap-2 text-sm text-ink-2"><DemoTag /> Figures include {s.reports.demo} sample reports created for demonstration.</p>
            ) : null}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <IncidentTypesChart byType={s.reports.public_by_type} />
              <ReportsTrendChart trend={s.reports.trend} days={s.reports.trend_days} />
            </div>
            <RecentReports recent={recent} isAdmin={isAdmin} />
          </section>

          {/* ---------------------------------------------------------- risk monitoring */}
          <section aria-labelledby="risk-heading" className="space-y-6">
            <SectionTitle
              eyebrow="Model estimates · Northeast India"
              title={<span id="risk-heading">Landslide risk monitoring</span>}
              subtitle={`${s.totals.locations} monitored towns in ${s.by_state.length} states. The risk index combines estimated terrain with live rainfall - it is not an official warning.`}
              action={<Link to="/map" className="btn-secondary btn-sm"><LayersIcon className="h-4 w-4" /> Open risk monitor</Link>}
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-2">
              <KindBadge kind="model" withHelp />
              <span>Last assessment: <strong className="text-ink">{formatDateTime(s.last_assessed_at)}</strong> ({timeAgo(s.last_assessed_at)})</span>
              <span className="flex items-center gap-1.5">
                Weather:{' '}
                {Object.keys(s.data_sources).map((k) => (k === 'demo' ? <DemoTag key={k}>Simulated</DemoTag> : <Tag key={k} tone="blue">{sourceLabel(k)}</Tag>))}
              </span>
              <span className="flex items-center gap-1.5">
                ML model:{' '}
                {s.model.available ? <Tag tone="amber">{s.model.model_name}{s.model.is_synthetic ? ' · synthetic training data' : ''}</Tag> : <Tag>not trained</Tag>}
              </span>
            </div>
            <DataSourceNotice isDemo={s.is_demo} sources={s.data_sources} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <LevelDistributionChart counts={s.level_counts} />
              <StateRiskChart states={s.by_state} />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <RainRiskScatter points={s.points} sourceNote={s.is_demo ? 'simulated demo values' : 'Open-Meteo model data'} />
              </div>
              <Card className="lg:col-span-2">
                <CardHeader
                  icon={<BellIcon className="h-4 w-4" />} title="Active alerts" subtitle="Most recent first"
                  action={<Link to="/alerts" className="btn-ghost btn-sm">All alerts <ArrowRightIcon className="h-4 w-4" /></Link>}
                />
                <ErrorBox error={alerts.error} onRetry={alerts.reload} />
                {alerts.data && alerts.data.length === 0 ? (
                  <EmptyState icon={<CheckCircleIcon className="h-6 w-6" />} title="No active alerts">No monitored town is currently at High or Very High risk.</EmptyState>
                ) : null}
                <ul className="divide-y divide-line">
                  {(alerts.data ?? []).slice(0, 6).map((a) => (
                    <li key={a.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <RiskBadge level={a.level} />
                        {a.official_source ? <KindBadge kind="official" /> : a.source === 'system' ? <KindBadge kind="model" /> : <Tag tone="blue">Admin advisory</Tag>}
                        {a.is_demo ? <DemoTag /> : null}
                        <span className="text-xs text-ink-muted">{timeAgo(a.created_at)}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-ink">{a.title.replace(/^\[DEMO\]\s*/, '')}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <Card>
              <CardHeader
                icon={<MountainIcon className="h-4 w-4" />}
                title="Highest-risk monitored towns"
                subtitle="Ranked by the transparent risk index (model estimate). ML probability is experimental."
                action={<Link to="/map" className="btn-ghost btn-sm">Open map <ArrowRightIcon className="h-4 w-4" /></Link>}
              />
              <div className="overflow-x-auto">
                <table className="table-basic">
                  <thead>
                    <tr>
                      <th>Location</th><th>State</th><th>Level</th><th className="text-right">Index</th>
                      <th className="text-right">Rain 24 h</th><th className="text-right">Rain 72 h</th><th className="text-right">ML prob.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.top_locations.map((p) => (
                      <tr key={p.location_id} className="hover:bg-plane">
                        <td>
                          <Link to={`/locations/${p.location_id}`} className="font-medium text-brand-700 hover:underline">{p.name}</Link>
                          {p.district !== p.name ? <div className="text-xs text-ink-muted">{p.district}</div> : null}
                        </td>
                        <td>{p.state}</td>
                        <td><RiskBadge level={p.level} /></td>
                        <td className="tabular text-right font-medium">{formatNumber(p.score, 1)}</td>
                        <td className="tabular text-right">{formatNumber(p.rainfall_24h_mm, 0)} mm</td>
                        <td className="tabular text-right">{formatNumber(p.rainfall_72h_mm, 0)} mm</td>
                        <td className="tabular text-right">{formatPercent(p.ml_probability)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          <Notice tone="info">
            Model estimates and alerts are produced by an uncalibrated prototype. They are not official warnings - follow
            IMD, NDMA, SDMA and DDMA advisories. <Link to="/methodology" className="font-medium underline">How the risk index works</Link>.
          </Notice>
        </div>
      ) : null}
    </>
  )
}
