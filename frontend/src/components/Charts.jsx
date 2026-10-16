import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { LEVELS, REPORT_CATEGORIES, formatDateTime, formatNumber, levelColor } from '../lib/risk'
import { ChartIcon, TableIcon } from './Icons'
import { Card, CardHeader, RiskBadge } from './ui'

const INK_2 = '#3d4b66'
const MUTED = '#66728a'
const GRID = '#e3e8ef'
const SERIES_1 = '#2a78d6'
const axisProps = { stroke: GRID, tick: { fill: MUTED, fontSize: 12 }, tickLine: false }

function TooltipBox({ children }) {
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-sm shadow-(--shadow-pop)">{children}</div>
  )
}

// A card that shows a chart, with a toggle to an accessible table of the same data.
export function ChartCard({ title, subtitle, table, children, height = 280 }) {
  const [asTable, setAsTable] = useState(false)
  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={subtitle}
        action={
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setAsTable((t) => !t)}
            title={asTable ? 'Show as chart' : 'Show the same data as a table'}
            aria-pressed={asTable}
          >
            {asTable ? <ChartIcon className="h-4 w-4" /> : <TableIcon className="h-4 w-4" />}
            {asTable ? 'Chart' : 'Table'}
          </button>
        }
      />
      <div className="p-4">
        {asTable ? (
          <div className="overflow-x-auto" style={{ maxHeight: height + 40 }}>
            {table}
          </div>
        ) : (
          <div style={{ height }}>{children}</div>
        )}
      </div>
    </Card>
  )
}

export function LevelDistributionChart({ counts }) {
  const data = LEVELS.map((level) => ({ level, count: counts?.[level] ?? 0 }))
  return (
    <ChartCard
      title="Locations by risk level"
      subtitle="Latest assessment for each monitored location"
      table={
        <table className="table-basic">
          <thead>
            <tr><th>Level</th><th className="text-right">Locations</th></tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.level}>
                <td><RiskBadge level={d.level} /></td>
                <td className="tabular text-right">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 8, left: -16, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="level" {...axisProps} />
          <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
          <Tooltip
            cursor={{ fill: 'rgba(11,11,11,0.04)' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox>
                  <RiskBadge level={payload[0].payload.level} />
                  <div className="mt-1 text-ink-2">{payload[0].value} locations</div>
                </TooltipBox>
              ) : null
            }
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.level} fill={levelColor(d.level)} />
            ))}
            <LabelList dataKey="count" position="top" fill={INK_2} fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function StateRiskChart({ states }) {
  const data = (states ?? []).map((s) => ({ ...s, short: s.state.replace('Arunachal Pradesh', 'Arunachal') }))
  return (
    <ChartCard
      title="Average risk index by state"
      subtitle="Mean of latest scores across monitored locations (0-100)"
      height={300}
      table={
        <table className="table-basic">
          <thead>
            <tr>
              <th>State</th><th className="text-right">Locations</th><th className="text-right">Avg</th>
              <th className="text-right">Max</th><th className="text-right">High+</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.state}>
                <td>{s.state}</td>
                <td className="tabular text-right">{s.locations}</td>
                <td className="tabular text-right">{formatNumber(s.avg_score, 1)}</td>
                <td className="tabular text-right">{formatNumber(s.max_score, 1)}</td>
                <td className="tabular text-right">{s.high_or_above}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 8, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" domain={[0, 100]} {...axisProps} />
          <YAxis type="category" dataKey="short" width={86} {...axisProps} axisLine={false} />
          <Tooltip
            cursor={{ fill: 'rgba(11,11,11,0.04)' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox>
                  <div className="font-medium">{payload[0].payload.state}</div>
                  <div className="tabular text-ink-2">Average {formatNumber(payload[0].payload.avg_score, 1)} · max {formatNumber(payload[0].payload.max_score, 1)}</div>
                  <div className="text-ink-2">{payload[0].payload.locations} locations, {payload[0].payload.high_or_above} High or above</div>
                </TooltipBox>
              ) : null
            }
          />
          <Bar dataKey="avg_score" fill={SERIES_1} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="avg_score" position="right" fill={INK_2} fontSize={12} formatter={(v) => formatNumber(v, 0)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

const THRESHOLDS = [
  { y: 25, label: 'Moderate' },
  { y: 50, label: 'High' },
  { y: 75, label: 'Very High' },
]

export function RainRiskScatter({ points, sourceNote }) {
  const data = points ?? []
  return (
    <ChartCard
      title="72-hour rainfall vs risk index"
      subtitle={`Each dot is a monitored location. Rainfall: ${sourceNote}.`}
      height={320}
      table={
        <table className="table-basic">
          <thead>
            <tr><th>Location</th><th>State</th><th className="text-right">Rain 72 h (mm)</th><th className="text-right">Risk index</th><th>Level</th></tr>
          </thead>
          <tbody>
            {[...data].sort((a, b) => b.score - a.score).map((p) => (
              <tr key={p.location_id}>
                <td>{p.name}</td><td>{p.state}</td>
                <td className="tabular text-right">{formatNumber(p.rainfall_72h_mm, 0)}</td>
                <td className="tabular text-right">{formatNumber(p.score, 1)}</td>
                <td><RiskBadge level={p.level} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 72, left: -8, bottom: 16 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis
            type="number" dataKey="rainfall_72h_mm" name="Rainfall 72 h" unit=" mm" {...axisProps}
            label={{ value: 'Rainfall, last 72 h (mm)', position: 'insideBottom', offset: -10, fill: MUTED, fontSize: 12 }}
          />
          <YAxis type="number" dataKey="score" name="Risk index" domain={[0, 100]} {...axisProps} />
          {THRESHOLDS.map((t) => (
            <ReferenceLine
              key={t.y} y={t.y} stroke="#c3c2b7"
              label={{ value: t.label, position: 'right', fill: MUTED, fontSize: 11 }}
            />
          ))}
          <Tooltip
            cursor={{ stroke: GRID }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload
              return (
                <TooltipBox>
                  <div className="font-medium">{p.name}, {p.state}</div>
                  <div className="mt-1"><RiskBadge level={p.level} score={p.score} /></div>
                  <div className="tabular mt-1 text-ink-2">Rain 72 h: {formatNumber(p.rainfall_72h_mm, 0)} mm · 24 h: {formatNumber(p.rainfall_24h_mm, 0)} mm</div>
                </TooltipBox>
              )
            }}
          />
          <Scatter data={data} fill={SERIES_1} stroke="#fff" strokeWidth={2} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function ScoreHistoryChart({ history }) {
  const data = (history ?? []).map((h) => ({ ...h, t: new Date(h.created_at).getTime() }))
  return (
    <ChartCard
      title="Risk index history"
      subtitle="One point per stored assessment"
      height={240}
      table={
        <table className="table-basic">
          <thead>
            <tr><th>Assessed</th><th className="text-right">Rain 24 h</th><th className="text-right">Rain 72 h</th><th className="text-right">Index</th><th>Level</th><th>Source</th></tr>
          </thead>
          <tbody>
            {[...data].reverse().map((h) => (
              <tr key={h.id}>
                <td>{formatDateTime(h.created_at)}</td>
                <td className="tabular text-right">{formatNumber(h.rainfall_24h_mm, 0)}</td>
                <td className="tabular text-right">{formatNumber(h.rainfall_72h_mm, 0)}</td>
                <td className="tabular text-right">{formatNumber(h.score, 1)}</td>
                <td><RiskBadge level={h.level} /></td>
                <td>{h.data_source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {data.length < 2 ? (
        <p className="flex h-full items-center justify-center text-sm text-ink-muted">
          Only {data.length} assessment stored so far. Run a refresh from the Admin page to build history.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} {...axisProps}
              tickFormatter={(t) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            />
            <YAxis domain={[0, 100]} {...axisProps} axisLine={false} />
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox>
                    <div className="text-ink-2">{formatDateTime(payload[0].payload.created_at)}</div>
                    <RiskBadge level={payload[0].payload.level} score={payload[0].payload.score} />
                  </TooltipBox>
                ) : null
              }
            />
            <Line type="monotone" dataKey="score" stroke={SERIES_1} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: SERIES_1 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}

// ---------------------------------------------------------------- citizen report charts
const SERIES_2 = '#eb6834'

export function IncidentTypesChart({ byType }) {
  const data = Object.entries(byType ?? {})
    .map(([key, count]) => ({ key, label: REPORT_CATEGORIES[key] ?? key, count }))
    .sort((a, b) => b.count - a.count)
  const height = Math.max(160, data.length * 40 + 30)
  return (
    <ChartCard
      title="Incident types"
      subtitle="Verified and resolved incidents, all of India"
      height={height}
      table={
        <table className="table-basic">
          <thead><tr><th>Incident type</th><th className="text-right">Incidents</th></tr></thead>
          <tbody>
            {data.map((d) => <tr key={d.key}><td>{d.label}</td><td className="tabular text-right">{d.count}</td></tr>)}
          </tbody>
        </table>
      }
    >
      {data.length === 0 ? (
        <p className="flex h-full items-center justify-center text-sm text-ink-muted">No verified incidents yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 8, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" allowDecimals={false} {...axisProps} />
            <YAxis type="category" dataKey="label" width={150} {...axisProps} axisLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(15,31,61,0.04)' }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox>
                    <div className="font-medium">{payload[0].payload.label}</div>
                    <div className="text-ink-2">{payload[0].value} incident{payload[0].value === 1 ? '' : 's'}</div>
                  </TooltipBox>
                ) : null
              }
            />
            <Bar dataKey="count" fill={SERIES_1} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <LabelList dataKey="count" position="right" fill={INK_2} fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}

const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

export function ReportsTrendChart({ trend, days = 30 }) {
  const data = trend ?? []
  const total = data.reduce((n, d) => n + d.received, 0)
  return (
    <ChartCard
      title="Report trend"
      subtitle={`Reports received per day, last ${days} days (all statuses) and how many of them are verified or resolved now`}
      height={260}
      table={
        <table className="table-basic">
          <thead><tr><th>Date</th><th className="text-right">Received</th><th className="text-right">Verified / resolved now</th></tr></thead>
          <tbody>
            {[...data].reverse().filter((d) => d.received).map((d) => (
              <tr key={d.date}><td>{shortDate(d.date)}</td><td className="tabular text-right">{d.received}</td><td className="tabular text-right">{d.verified_now}</td></tr>
            ))}
          </tbody>
        </table>
      }
    >
      {total === 0 ? (
        <p className="flex h-full items-center justify-center text-sm text-ink-muted">No reports in the last {days} days.</p>
      ) : (
        <div className="flex h-full flex-col">
          <ul className="mb-2 flex flex-wrap gap-4 text-xs text-ink-2" aria-label="Legend">
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_1 }} /> Received</li>
            <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: SERIES_2 }} /> Verified / resolved now</li>
          </ul>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} interval="preserveStartEnd" minTickGap={24} />
                <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(15,31,61,0.04)' }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <TooltipBox>
                        <div className="font-medium">{shortDate(payload[0].payload.date)}</div>
                        <div className="text-ink-2">{payload[0].payload.received} received · {payload[0].payload.verified_now} verified/resolved now</div>
                      </TooltipBox>
                    ) : null
                  }
                />
                <Bar dataKey="received" fill={SERIES_1} radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={18} />
                <Line dataKey="verified_now" stroke={SERIES_2} strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </ChartCard>
  )
}
