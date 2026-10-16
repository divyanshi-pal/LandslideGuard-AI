import { formatNumber } from '../lib/risk'

const UP = '#e34948'
const DOWN = '#2a78d6'

function Meter({ value, color = '#2a78d6' }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-plane" aria-hidden="true">
      <div className="h-full rounded-full" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  )
}

function formatValue(f) {
  if (f.name === 'slope_modified') return f.value ? 'Yes' : 'No'
  if (f.name === 'soil_type') return f.value
  const digits = f.name === 'soil_moisture' || f.name === 'vegetation_ndvi' ? 2 : 0
  return `${formatNumber(f.value, digits)}${f.unit && f.unit !== '' ? ` ${f.unit}` : ''}`
}

export function HeuristicFactors({ heuristic }) {
  const groups = [
    { key: 'susceptibility', title: 'Susceptibility (terrain)', total: heuristic.susceptibility },
    { key: 'trigger', title: 'Trigger (rainfall & moisture)', total: heuristic.trigger },
  ]
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.key}>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">{g.title}</h3>
            <span className="tabular text-sm text-ink-2">
              {g.key === 'susceptibility' ? 'S' : 'T'} = <strong className="text-ink">{formatNumber(g.total, 2)}</strong>
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="table-basic">
              <thead>
                <tr>
                  <th>Factor</th>
                  <th>Value</th>
                  <th className="w-1/3">Sub-score (0-1)</th>
                  <th className="text-right">Weight</th>
                  <th className="text-right">Weighted</th>
                </tr>
              </thead>
              <tbody>
                {heuristic.factors
                  .filter((f) => f.group === g.key)
                  .map((f) => (
                    <tr key={f.name}>
                      <td className="font-medium text-ink">{f.label}</td>
                      <td className={`tabular text-ink-2 ${f.name === 'soil_type' ? 'capitalize' : ''}`}>{formatValue(f)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Meter value={f.sub_score} />
                          <span className="tabular w-10 text-right text-xs text-ink-2">{formatNumber(f.sub_score, 2)}</span>
                        </div>
                      </td>
                      <td className="tabular text-right text-ink-2">{formatNumber(f.weight, 2)}</td>
                      <td className="tabular text-right font-medium">{formatNumber(f.weighted, 3)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// Occlusion contributions from the ML model: diverging bars around zero.
export function MLContributions({ contributions }) {
  const max = Math.max(0.01, ...contributions.map((c) => Math.abs(c.delta)))
  return (
    <ul className="space-y-2">
      {contributions.map((c) => {
        const width = `${(Math.abs(c.delta) / max) * 50}%`
        const up = c.delta >= 0
        return (
          <li key={c.feature} className="grid grid-cols-[minmax(0,9rem)_1fr_4.5rem] items-center gap-2 text-sm">
            <span className="truncate text-ink-2" title={c.label}>{c.label}</span>
            <div className="relative h-3 rounded bg-plane" aria-hidden="true">
              <div className="absolute inset-y-0 left-1/2 w-px bg-stone-400" />
              <div
                className="absolute inset-y-0 rounded"
                style={{ width, background: up ? UP : DOWN, left: up ? '50%' : undefined, right: up ? undefined : '50%' }}
              />
            </div>
            <span className="tabular text-right text-xs font-medium text-ink">
              {up ? '+' : '−'}{formatNumber(Math.abs(c.delta) * 100, 1)} pts
            </span>
          </li>
        )
      })}
    </ul>
  )
}
