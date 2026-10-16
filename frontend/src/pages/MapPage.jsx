import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api/client'
import RiskMap, { MapLegend } from '../components/RiskMap'
import { ArrowRightIcon } from '../components/Icons'
import { DemoTag, ErrorBox, Loading, RiskBadge } from '../components/ui'
import { LEVELS, formatNumber, levelRank } from '../lib/risk'
import { useAsync } from '../lib/useAsync'

export default function MapPage() {
  const [params] = useSearchParams()
  const locations = useAsync((o) => api.locations(undefined, o))
  const reports = useAsync((o) => api.publicReports(o))
  const [state, setState] = useState('')
  const [minLevel, setMinLevel] = useState('Low')
  const [showReports, setShowReports] = useState(true)

  const lat = Number(params.get('lat'))
  const lon = Number(params.get('lon'))
  const focus = useMemo(() => (lat && lon ? [lat, lon] : null), [lat, lon])

  const all = locations.data ?? []
  const states = [...new Set(all.map((l) => l.state))].sort()
  const visible = all.filter(
    (l) => (!state || l.state === state) && levelRank(l.latest?.level ?? 'Low') >= levelRank(minLevel),
  )
  const ranked = [...visible].sort((a, b) => (b.latest?.score ?? 0) - (a.latest?.score ?? 0))
  const anyDemo = all.some((l) => l.latest?.data_source === 'demo')

  return (
    <div className="flex flex-col lg:h-[calc(100vh-4rem)] lg:flex-row">
      <aside className="flex flex-col border-b border-line bg-white lg:w-80 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="space-y-3 border-b border-line p-4">
          <div>
            <p className="eyebrow">Model estimates · Northeast India</p>
            <h1 className="mt-0.5 text-xl font-bold text-ink">Risk monitor</h1>
            <p className="mt-1 text-sm text-ink-2">Latest risk index for 46 monitored towns. Click a marker for the factors behind it. Not an official warning.</p>
            <Link to="/incidents" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
              Citizen reports from all of India <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
          {anyDemo ? (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
              <DemoTag /> Rainfall is simulated; terrain values are estimates.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-ink-2">
              State
              <select className="input mt-1" value={state} onChange={(e) => setState(e.target.value)}>
                <option value="">All states</option>
                {states.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-ink-2">
              Minimum level
              <select className="input mt-1" value={minLevel} onChange={(e) => setMinLevel(e.target.value)}>
                {LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={showReports} onChange={(e) => setShowReports(e.target.checked)} className="h-4 w-4 accent-brand-700" />
            Show verified citizen reports in this area ({reports.data?.length ?? 0} in India)
          </label>
        </div>
        <ErrorBox error={locations.error} onRetry={locations.reload} />
        {locations.loading && !locations.data ? <Loading /> : null}
        <ul className="max-h-72 overflow-y-auto p-2 lg:max-h-none lg:flex-1">
          {ranked.map((l) => (
            <li key={l.id}>
              <Link to={`/locations/${l.id}`} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-plane">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{l.name}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {l.state} · {formatNumber(l.latest?.rainfall_72h_mm, 0)} mm / 72 h
                  </span>
                </span>
                {l.latest ? <RiskBadge level={l.latest.level} score={l.latest.score} /> : null}
              </Link>
            </li>
          ))}
          {locations.data && ranked.length === 0 ? (
            <li className="p-4 text-sm text-ink-muted">No locations match these filters.</li>
          ) : null}
        </ul>
      </aside>
      <div className="relative min-h-[420px] flex-1">
        <RiskMap
          locations={visible}
          reports={showReports ? reports.data ?? [] : []}
          focus={focus}
          className="h-[60vh] lg:h-full"
        />
        <div className="pointer-events-none absolute bottom-6 left-3 z-[1000]">
          <MapLegend />
        </div>
      </div>
    </div>
  )
}
