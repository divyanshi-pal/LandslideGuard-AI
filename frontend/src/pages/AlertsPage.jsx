import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api/client'
import { BellIcon, MapPinIcon } from '../components/Icons'
import { Card, DemoTag, EmptyState, ErrorBox, Loading, PageHeader, RiskBadge, Tag } from '../components/ui'
import { LEVELS, alertKind, formatDateTime, levelColor, levelRank, timeAgo } from '../lib/risk'
import { useAsync } from '../lib/useAsync'

const TABS = [
  { key: 'active', label: 'Active' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
]

export default function AlertsPage() {
  const [tab, setTab] = useState('active')
  const [minLevel, setMinLevel] = useState('Low')
  const alerts = useAsync((o) => api.alerts(tab, o), [tab])
  const items = (alerts.data ?? []).filter((a) => levelRank(a.level) >= levelRank(minLevel))

  return (
    <>
      <PageHeader
        eyebrow="Early warnings"
        title="Alerts"
        subtitle="Automatic alerts are model estimates for monitored towns in Northeast India. Admin advisories and relayed official warnings are labelled with their source."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-line bg-white p-1 shadow-sm" role="tablist" aria-label="Alert status">
          {TABS.map((t) => (
            <button
              key={t.key} type="button" role="tab" aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${tab === t.key ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-2 hover:bg-plane'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          Minimum level
          <select className="input w-36" value={minLevel} onChange={(e) => setMinLevel(e.target.value)}>
            {LEVELS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
      </div>

      <ErrorBox error={alerts.error} onRetry={alerts.reload} />
      {alerts.loading && !alerts.data ? <Loading /> : null}
      {alerts.data && items.length === 0 ? (
        <Card><EmptyState icon={<BellIcon className="h-6 w-6" />} title={`No ${tab === 'all' ? '' : tab} alerts`}>Nothing matches this filter right now.</EmptyState></Card>
      ) : null}

      <ul className={`space-y-3 ${alerts.loading ? 'opacity-60' : ''}`}>
        {items.map((a) => (
          <li key={a.id}>
            <Card className="border-l-4 p-5" style={{ borderLeftColor: levelColor(a.level) }}>
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge level={a.level} />
                {a.is_demo ? <DemoTag>Demo - not a real warning</DemoTag> : null}
                <Tag tone={alertKind(a).tone}>{alertKind(a).label}</Tag>
                {a.status === 'resolved' ? <Tag tone="green">Resolved {timeAgo(a.resolved_at)}</Tag> : null}
                <span className="text-xs text-ink-muted">{formatDateTime(a.created_at)}</span>
              </div>
              <h2 className="mt-2 font-semibold text-ink">{a.title.replace(/^\[DEMO\]\s*/, '')}</h2>
              <p className="mt-1 text-sm text-ink-2">{a.message}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                {a.state ? <span className="text-ink-muted">{a.state}</span> : null}
                {a.official_reference ? (
                  <a href={a.official_reference} target="_blank" rel="noreferrer noopener" className="font-medium text-brand-700 underline">
                    Read the official warning
                  </a>
                ) : null}
                {a.latitude !== null && a.longitude !== null ? (
                  <Link to={`/map?lat=${a.latitude}&lon=${a.longitude}`} className="inline-flex items-center gap-1 font-medium text-brand-700 underline">
                    <MapPinIcon className="h-4 w-4" /> View on map
                  </Link>
                ) : null}
                {a.location_id ? (
                  <Link to={`/locations/${a.location_id}`} className="font-medium text-brand-700 underline">Location details</Link>
                ) : null}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  )
}
