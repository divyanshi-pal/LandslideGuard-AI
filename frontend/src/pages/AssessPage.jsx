import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api/client'
import { HeuristicFactors, MLContributions } from '../components/FactorBreakdown'
import { Card, CardHeader, ErrorBox, Notice, PageHeader, RiskBadge } from '../components/ui'
import { SOIL_TYPES, formatNumber, formatPercent, levelColor } from '../lib/risk'
import { useAsync } from '../lib/useAsync'

const DEFAULTS = {
  rainfall_24h_mm: 80,
  rainfall_72h_mm: 180,
  soil_moisture: 0.35,
  slope_deg: 30,
  vegetation_ndvi: 0.55,
  soil_type: 'clay',
  slope_modified: true,
}

const SLIDERS = [
  { key: 'rainfall_24h_mm', label: 'Rainfall, last 24 h', unit: 'mm', min: 0, max: 600, step: 1 },
  { key: 'rainfall_72h_mm', label: 'Rainfall, last 72 h', unit: 'mm', min: 0, max: 1500, step: 5 },
  { key: 'soil_moisture', label: 'Soil moisture', unit: 'm³/m³', min: 0, max: 0.6, step: 0.01 },
  { key: 'slope_deg', label: 'Slope angle', unit: '°', min: 0, max: 70, step: 1 },
  { key: 'vegetation_ndvi', label: 'Vegetation cover (NDVI)', unit: '', min: 0, max: 1, step: 0.01 },
]

function SliderField({ spec, value, onChange }) {
  const id = `f-${spec.key}`
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">{spec.label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number" min={spec.min} max={spec.max} step={spec.step} value={value}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            className="input tabular w-24 py-1 text-right" aria-label={`${spec.label} value`}
          />
          <span className="w-12 text-xs text-ink-muted">{spec.unit}</span>
        </div>
      </div>
      <input
        id={id} type="range" min={spec.min} max={spec.max} step={spec.step} value={value === '' ? spec.min : value}
        onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-brand-700"
      />
    </div>
  )
}

export default function AssessPage() {
  const [form, setForm] = useState(DEFAULTS)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [prefill, setPrefill] = useState('')
  const locations = useAsync((o) => api.locations(undefined, o))

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  async function assess(values = form) {
    setBusy(true)
    setError(null)
    try {
      setResult(await api.predict(values))
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    assess(DEFAULTS)
  }, [])

  function applyLocation(id) {
    setPrefill(id)
    const loc = (locations.data ?? []).find((l) => String(l.id) === id)
    if (!loc) return
    const next = {
      slope_deg: loc.slope_deg,
      vegetation_ndvi: loc.vegetation_ndvi,
      soil_type: loc.soil_type,
      slope_modified: loc.slope_modified,
      rainfall_24h_mm: loc.latest?.rainfall_24h_mm ?? form.rainfall_24h_mm,
      rainfall_72h_mm: loc.latest?.rainfall_72h_mm ?? form.rainfall_72h_mm,
      soil_moisture: loc.latest?.soil_moisture ?? form.soil_moisture,
    }
    setForm(next)
    assess(next)
  }

  const rainMismatch = Number(form.rainfall_24h_mm) > Number(form.rainfall_72h_mm)
  const h = result?.heuristic
  const ml = result?.ml

  return (
    <>
      <PageHeader
        eyebrow="Model estimate tool"
        title="Assess landslide risk"
        subtitle="Enter site conditions to see the transparent risk index, how each factor contributes, and the experimental ML estimate."
      />
      <div className="mb-6">
        <Notice tone="warn" title="An illustration, not a validated assessment">
          The weights reflect general landslide factors and were chosen with Northeast India in mind. They have not been
          validated for any region of India, so treat the result as illustrative - especially outside the Northeast.
        </Notice>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="self-start lg:col-span-2">
          <CardHeader title="Site conditions" />
          <form
            className="space-y-5 p-5"
            onSubmit={(e) => {
              e.preventDefault()
              assess()
            }}
          >
            <div>
              <label htmlFor="prefill" className="mb-1 block text-sm font-medium text-ink">Prefill from a monitored location</label>
              <select id="prefill" className="input" value={prefill} onChange={(e) => applyLocation(e.target.value)}>
                <option value="">Choose a location…</option>
                {(locations.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.name} ({l.state})</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-muted">Uses its latest rainfall and its estimated terrain attributes.</p>
            </div>
            {SLIDERS.map((s) => (
              <SliderField key={s.key} spec={s} value={form[s.key]} onChange={set(s.key)} />
            ))}
            {rainMismatch ? (
              <Notice tone="warn">The 72-hour total should include the last 24 hours, so it cannot be smaller.</Notice>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="soil" className="mb-1 block text-sm font-medium text-ink">Soil / material</label>
                <select id="soil" className="input capitalize" value={form.soil_type} onChange={(e) => set('soil_type')(e.target.value)}>
                  {SOIL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <label className="flex items-end gap-2 pb-2 text-sm text-ink">
                <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={form.slope_modified} onChange={(e) => set('slope_modified')(e.target.checked)} />
                Road cut / excavation nearby
              </label>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Assessing…' : 'Assess risk'}
            </button>
          </form>
        </Card>

        <div className="space-y-6 lg:col-span-3">
          <ErrorBox error={error} />
          {h ? (
            <Card className={busy ? 'opacity-60' : ''}>
              <CardHeader title="Transparent risk index" subtitle={`Method ${h.method} · ${h.formula}`} />
              <div className="space-y-5 p-5">
                <div className="flex flex-wrap items-center gap-5">
                  <div
                    className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full border-8"
                    style={{ borderColor: levelColor(h.level) }}
                  >
                    <span className="text-3xl font-semibold text-ink">{Math.round(h.score)}</span>
                    <span className="text-[10px] uppercase tracking-wide text-ink-muted">of 100</span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <RiskBadge level={h.level} size="lg" />
                    <p className="text-sm text-ink">{h.guidance}</p>
                    {h.top_drivers.length ? (
                      <p className="text-xs text-ink-2">Main drivers: {h.top_drivers.join(', ')}</p>
                    ) : null}
                  </div>
                </div>
                <HeuristicFactors heuristic={h} />
                <p className="text-xs text-ink-muted">
                  Weights and thresholds are documented assumptions, not calibrated against a landslide inventory.{' '}
                  <Link to="/methodology" className="underline">Read the methodology</Link>.
                </p>
              </div>
            </Card>
          ) : null}

          {ml ? (
            <Card className={busy ? 'opacity-60' : ''}>
              <CardHeader title="Machine-learning estimate (experimental)" subtitle={ml.available ? `${ml.model_name} · trained ${new Date(ml.trained_at).toLocaleDateString('en-IN')}` : 'No model available'} />
              <div className="space-y-4 p-5">
                {ml.available ? (
                  <>
                    {ml.is_synthetic ? (
                      <Notice tone="warn" title="Trained on synthetic data">{ml.warning}</Notice>
                    ) : (
                      <Notice tone="info">{ml.warning}</Notice>
                    )}
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-3xl font-semibold text-ink">{formatPercent(ml.probability, 1)}</span>
                      <span className="text-sm text-ink-2">model probability of the positive (landslide) class</span>
                    </div>
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-ink">What moved this estimate</h3>
                      <MLContributions contributions={ml.contributions} />
                      <p className="mt-2 text-xs text-ink-muted">{ml.explanation_method}</p>
                    </div>
                  </>
                ) : (
                  <Notice tone="info">{ml.message}</Notice>
                )}
              </div>
            </Card>
          ) : null}

          {result ? <p className="text-xs text-ink-muted">{result.disclaimer}</p> : null}
          {h ? (
            <p className="sr-only">
              Risk index {formatNumber(h.score, 1)} out of 100, level {h.level}.
            </p>
          ) : null}
        </div>
      </div>
    </>
  )
}
