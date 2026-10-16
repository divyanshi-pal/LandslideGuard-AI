import { api } from '../api/client'
import { Card, CardHeader, ErrorBox, Loading, Notice, PageHeader, RiskBadge } from '../components/ui'
import { formatDateTime, formatNumber } from '../lib/risk'
import { useAsync } from '../lib/useAsync'

const METRIC_LABELS = {
  roc_auc: 'ROC-AUC',
  average_precision: 'Average precision',
  brier_score: 'Brier score (lower is better)',
  accuracy: 'Accuracy',
  precision: 'Precision',
  recall: 'Recall',
  f1: 'F1',
}

function WeightsTable({ title, weights, specs }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink">{title}</h3>
      <table className="table-basic">
        <thead><tr><th>Factor</th><th className="text-right">Weight</th></tr></thead>
        <tbody>
          {Object.entries(weights).map(([k, w]) => (
            <tr key={k}><td>{specs[k]?.label ?? k}</td><td className="tabular text-right">{w}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ModelCard({ status }) {
  if (!status.available) {
    return <Notice tone="info" title="No trained model">{status.message}</Notice>
  }
  const c = status.card
  const m = c.test_metrics
  return (
    <div className="space-y-5">
      <Notice tone={c.is_synthetic ? 'warn' : 'info'} title={c.is_synthetic ? 'Synthetic training data' : 'User-supplied training data'}>
        {c.warning}
      </Notice>
      <dl className="tabular grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {[
          ['Selected model', c.model_name],
          ['Trained', formatDateTime(c.trained_at)],
          ['Data source', `${c.data.source} - ${c.data.detail}`],
          ['Rows (train / test)', `${c.data.n_samples} (${c.data.n_train} / ${c.data.n_test})`],
          ['Positive rate', formatNumber(c.data.positive_rate, 3)],
          ['Dataset SHA-256', `${c.data.sha256.slice(0, 16)}…`],
          ['scikit-learn', c.environment.scikit_learn],
          ['Selection rule', c.selection],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-line pb-1">
            <dt className="text-ink-2">{k}</dt>
            <dd className="text-right text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">Held-out test metrics (n = {m.n})</h3>
          <table className="table-basic">
            <thead><tr><th>Metric</th><th className="text-right">Model</th><th className="text-right">Trivial baseline</th></tr></thead>
            <tbody>
              {Object.entries(METRIC_LABELS).map(([k, label]) => {
                const baseline = {
                  roc_auc: c.baselines.random_roc_auc,
                  average_precision: c.baselines.average_precision_of_random,
                  brier_score: c.baselines.base_rate_brier_score,
                  accuracy: c.baselines.majority_class_accuracy,
                }[k]
                return (
                  <tr key={k}>
                    <td>{label}</td>
                    <td className="tabular text-right font-medium">{formatNumber(m[k], 3)}</td>
                    <td className="tabular text-right text-ink-muted">{baseline !== undefined ? formatNumber(baseline, 3) : '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-ink-muted">
            Threshold {m.decision_threshold}. Confusion matrix: TN {m.confusion_matrix.tn}, FP {m.confusion_matrix.fp}, FN {m.confusion_matrix.fn}, TP {m.confusion_matrix.tp}.
          </p>
        </div>
        <div className="space-y-5">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Candidate models (cross-validated ROC-AUC)</h3>
            <table className="table-basic">
              <thead><tr><th>Model</th><th className="text-right">Mean</th><th className="text-right">Std</th></tr></thead>
              <tbody>
                {Object.entries(c.candidates).map(([name, v]) => (
                  <tr key={name} className={name === c.model_name ? 'font-semibold' : ''}>
                    <td>{name}{name === c.model_name ? ' (selected)' : ''}</td>
                    <td className="tabular text-right">{formatNumber(v.cv_roc_auc_mean, 3)}</td>
                    <td className="tabular text-right">{formatNumber(v.cv_roc_auc_std, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Permutation importance (drop in test ROC-AUC)</h3>
            <table className="table-basic">
              <tbody>
                {c.permutation_importance.map((p) => (
                  <tr key={p.feature}>
                    <td>{p.label}</td>
                    <td className="tabular text-right">{formatNumber(p.mean, 3)} ± {formatNumber(p.std, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="text-xs text-ink-muted">
        Reproduce: <code className="rounded bg-plane px-1">{c.command ?? 'python -m ml.train'}</code> in the backend folder.
      </p>
    </div>
  )
}

export default function MethodologyPage() {
  const method = useAsync((o) => api.methodology(o))
  const model = useAsync((o) => api.modelCard(o))
  const m = method.data

  return (
    <>
      <PageHeader
        eyebrow="Transparency"
        title="Methodology & transparency"
        subtitle="How LandslideGuard AI computes risk, where its data comes from, and what it cannot do."
      />
      <div className="space-y-6">
        <Notice tone="warn" title="Prototype status">
          This system has not been validated against observed landslide events in Northeast India. It is a decision-support
          prototype and must not replace official advisories from IMD, GSI, NDMA or State/District Disaster Management Authorities.
        </Notice>

        <Card>
          <CardHeader title="1. Transparent risk index (primary)" subtitle="Used for map colours, dashboard statistics and automatic alerts" />
          <ErrorBox error={method.error} />
          {!m && method.loading ? <Loading /> : null}
          {m ? (
            <div className="space-y-5 p-5 text-sm text-ink-2">
              <p>
                The index follows the common hazard formulation <em>risk = susceptibility × trigger</em>. Each raw input is
                mapped to a 0-1 sub-score; sub-scores are combined with fixed weights:
              </p>
              <pre className="overflow-x-auto rounded-lg bg-plane p-3 text-ink">
                {`${m.formula}
S = Σ weight × sub-score   (terrain factors)
T = Σ weight × sub-score   (rainfall & soil moisture)`}
              </pre>
              <p>
                Susceptibility sets the ceiling a site can reach; the trigger decides how close to that ceiling it is now. Even
                with no rain, {m.baseline_trigger * 100}% of susceptibility is expressed, so steep, cut slopes never read as zero risk.
              </p>
              <div className="grid gap-6 md:grid-cols-2">
                <WeightsTable title="Susceptibility weights" weights={m.susceptibility_weights} specs={m.features} />
                <WeightsTable title="Trigger weights" weights={m.trigger_weights} specs={m.features} />
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-ink">Sub-score rules</h3>
                  <table className="table-basic">
                    <tbody>
                      {Object.entries(m.thresholds).map(([k, v]) => (
                        <tr key={k}>
                          <td>{m.features[k]?.label ?? k}</td>
                          <td className="tabular">{typeof v === 'string' ? v : `0 at ${v.zero_at}, 1 at ${v.full_at} (linear)`}</td>
                        </tr>
                      ))}
                      <tr>
                        <td>Soil / material</td>
                        <td>{Object.entries(m.soil_scores).map(([k, v]) => `${k} ${v}`).join(', ')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-ink">Levels and guidance</h3>
                  <ul className="space-y-2">
                    {[...m.levels].reverse().map((l) => (
                      <li key={l.level}>
                        <div className="flex items-center gap-2"><RiskBadge level={l.level} /> <span className="tabular text-xs">score ≥ {l.min_score}</span></div>
                        <p className="mt-0.5 text-xs">{m.guidance[l.level]}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="font-medium text-ink">{m.calibration_status}</p>
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="2. Machine-learning model (experimental, secondary)" subtitle="Shown alongside the index; never used to trigger alerts" />
          <div className="p-5">
            <ErrorBox error={model.error} />
            {!model.data && model.loading ? <Loading /> : null}
            {model.data ? <ModelCard status={model.data} /> : null}
          </div>
        </Card>

        <Card>
          <CardHeader title="3. Data sources" />
          <div className="overflow-x-auto p-5">
            <table className="table-basic">
              <thead><tr><th>Data</th><th>Source in this MVP</th><th>Status</th></tr></thead>
              <tbody>
                <tr><td>Monitoring locations</td><td>46 district headquarters / towns across the 8 states (approximate coordinates)</td><td>Sample data</td></tr>
                <tr><td>Slope, soil, vegetation, road cuts</td><td>Illustrative estimates in <code>backend/data/locations_ne_india.json</code></td><td>Demo estimates - replace with DEM (SRTM / Cartosat), soil maps and NDVI</td></tr>
                <tr><td>Rainfall & soil moisture</td><td>Open-Meteo numerical weather model (when <code>WEATHER_PROVIDER=open-meteo</code>), otherwise deterministic simulation</td><td>Live model data or labelled demo</td></tr>
                <tr><td>ML training data</td><td>Synthetic generator <code>ml/synthetic.py</code>, or your own labelled CSV</td><td>Synthetic by default</td></tr>
                <tr><td>Citizen incident reports</td><td>Submitted from anywhere in India (GPS, map or typed location); reviewed by an administrator</td><td>Real user input - verification is separate from risk prediction</td></tr>
                <tr><td>Address suggestions</td><td>Optional reverse geocoding via OpenStreetMap Nominatim</td><td>Off unless configured</td></tr>
                <tr><td>Base map</td><td>OpenStreetMap tiles via Leaflet</td><td>Live</td></tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs text-ink-muted">
              Map boundaries come from OpenStreetMap and may not match official Survey of India depictions.
            </p>
          </div>
        </Card>
      </div>
    </>
  )
}
