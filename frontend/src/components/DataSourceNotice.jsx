import { Notice } from './ui'

// Explains where the numbers on a page come from. Shown wherever assessments appear.
export default function DataSourceNotice({ isDemo, sources }) {
  if (isDemo) {
    return (
      <Notice tone="warn" title="Demonstration data">
        Rainfall and soil-moisture values for {sources?.demo ?? 'these'} location(s) are <strong>simulated</strong>, and
        terrain attributes (slope, soil, vegetation) for all sample locations are illustrative estimates. Alerts generated
        from them are marked DEMO and are <strong>not real warnings</strong>. An administrator can switch the backend to
        live Open-Meteo data (<code>WEATHER_PROVIDER=open-meteo</code>) and refresh.
      </Notice>
    )
  }
  return (
    <Notice tone="info" title="Live model weather, estimated terrain">
      Rainfall and soil moisture come from the Open-Meteo numerical weather model (not rain gauges). Terrain attributes
      for the sample locations are illustrative estimates, not DEM-derived measurements.
    </Notice>
  )
}
