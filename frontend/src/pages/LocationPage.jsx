import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { api } from '../api/client'
import { ScoreHistoryChart } from '../components/Charts'
import { HeuristicFactors } from '../components/FactorBreakdown'
import RiskMap from '../components/RiskMap'
import { Card, CardHeader, DemoTag, ErrorBox, Loading, Notice, PageHeader, RiskBadge, Tag } from '../components/ui'
import { formatDateTime, formatNumber, formatPercent, sourceLabel } from '../lib/risk'
import { useAsync } from '../lib/useAsync'

export default function LocationPage() {
  const { id } = useParams()
  const loc = useAsync((o) => api.location(id, o), [id])
  const d = loc.data
  const a = d?.latest
  const focus = useMemo(() => (d ? [d.latitude, d.longitude] : null), [d])

  if (loc.error) return <ErrorBox error={loc.error} onRetry={loc.reload} />
  if (!d) return <Loading />

  const heuristic = a
    ? { susceptibility: a.susceptibility, trigger: a.trigger, factors: a.details.factors ?? [] }
    : null

  return (
    <>
      <p className="mb-2 text-sm"><Link to="/map" className="text-brand-700 underline">← Back to map</Link></p>
      <PageHeader title={d.name} subtitle={`${d.district} district, ${d.state}`}>
        {a ? <RiskBadge level={a.level} score={a.score} size="lg" /> : null}
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {a ? (
            <Card>
              <CardHeader
                title="Latest assessment"
                subtitle={`${formatDateTime(a.created_at)} · ${a.details.method ?? ''}`}
                action={a.data_source === 'demo' ? <DemoTag>Simulated rainfall</DemoTag> : <Tag tone="blue">{sourceLabel(a.data_source)}</Tag>}
              />
              <div className="space-y-5 p-5">
                <p className="text-sm text-ink">{a.details.guidance}</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    ['Risk index', `${formatNumber(a.score, 1)} / 100`],
                    ['Rain 24 h', `${formatNumber(a.rainfall_24h_mm, 0)} mm`],
                    ['Rain 72 h', `${formatNumber(a.rainfall_72h_mm, 0)} mm`],
                    ['ML prob. (exp.)', formatPercent(a.ml_probability)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="text-xs text-ink-muted">{k}</div>
                      <div className="text-lg font-semibold text-ink">{v}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-ink-muted">{a.details.weather_note}</p>
                {heuristic.factors.length ? <HeuristicFactors heuristic={heuristic} /> : null}
              </div>
            </Card>
          ) : (
            <Notice>No assessment stored for this location yet.</Notice>
          )}
          <ScoreHistoryChart history={d.history} />
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <RiskMap locations={[d]} focus={focus} className="h-64" />
          </Card>
          <Card>
            <CardHeader title="Site attributes" action={d.attributes_source === 'demo-estimate' ? <DemoTag>Estimates</DemoTag> : null} />
            <dl className="tabular grid grid-cols-2 gap-y-2 p-5 text-sm">
              <dt className="text-ink-2">Coordinates</dt>
              <dd className="text-right">{d.latitude.toFixed(3)}, {d.longitude.toFixed(3)}</dd>
              <dt className="text-ink-2">Slope</dt>
              <dd className="text-right">{formatNumber(d.slope_deg, 0)}°</dd>
              <dt className="text-ink-2">Soil / material</dt>
              <dd className="text-right capitalize">{d.soil_type}</dd>
              <dt className="text-ink-2">Vegetation (NDVI)</dt>
              <dd className="text-right">{formatNumber(d.vegetation_ndvi, 2)}</dd>
              <dt className="text-ink-2">Road cut / excavation</dt>
              <dd className="text-right">{d.slope_modified ? 'Yes' : 'No'}</dd>
            </dl>
            {d.attributes_source === 'demo-estimate' ? (
              <p className="border-t border-line px-5 py-3 text-xs text-ink-muted">
                Terrain attributes are illustrative estimates for this demo, not values derived from a DEM, soil map or
                satellite imagery. Coordinates are approximate town centres.
              </p>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  )
}
