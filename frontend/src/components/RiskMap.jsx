import { useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import L from 'leaflet'
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import {
  LEVELS,
  LOCATION_SOURCE_LABELS,
  REPORT_CATEGORIES,
  REPORT_STATUS_LABELS,
  SEVERITY_LABELS,
  formatDateTime,
  formatNumber,
  formatPercent,
  levelColor,
  levelRank,
} from '../lib/risk'
import { INDIA_BOUNDS } from '../lib/india'
import { directionsUrl } from '../lib/navigation'
import { assetUrl } from '../api/client'
import { DemoTag, RiskBadge } from './ui'

export const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
export const NE_INDIA_BOUNDS = [
  [21.9, 88.0],
  [29.5, 97.4],
]

const SEVERITY_SIZE = { minor: 12, moderate: 15, severe: 19 }
const iconCache = new Map()

// Diamond marker for a citizen report: fill = verification status, size = reported severity.
export function incidentIcon(status, severity, selected = false) {
  const key = `${status}-${severity}-${selected}`
  if (!iconCache.has(key)) {
    const size = (SEVERITY_SIZE[severity] ?? 15) + (selected ? 4 : 0)
    iconCache.set(key, L.divIcon({
      className: '',
      html: `<span class="incident-marker status-${status}${selected ? ' is-selected' : ''}"></span>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2 - 2],
    }))
  }
  return iconCache.get(key)
}

const pickIcon = L.divIcon({
  className: '',
  html: '<span class="pick-marker"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

function ViewController({ focus }) {
  const map = useMap()
  useEffect(() => {
    if (focus) map.setView(focus, 10)
    else map.fitBounds(NE_INDIA_BOUNDS, { padding: [10, 10] })
  }, [focus, map])
  return null
}

function LocationPopup({ loc }) {
  const a = loc.latest
  return (
    <div className="space-y-1.5 text-sm">
      <div>
        <div className="text-base font-semibold text-ink">{loc.name}</div>
        <div className="text-ink-2">
          {loc.district}, {loc.state}
        </div>
      </div>
      {a ? (
        <>
          <RiskBadge level={a.level} score={a.score} />
          <dl className="tabular grid grid-cols-2 gap-x-3 text-ink-2">
            <dt>Rain 24 h</dt>
            <dd className="text-right text-ink">{formatNumber(a.rainfall_24h_mm, 0)} mm</dd>
            <dt>Rain 72 h</dt>
            <dd className="text-right text-ink">{formatNumber(a.rainfall_72h_mm, 0)} mm</dd>
            <dt>Soil moisture</dt>
            <dd className="text-right text-ink">{formatNumber(a.soil_moisture, 2)}</dd>
            <dt>Slope</dt>
            <dd className="text-right text-ink">{formatNumber(loc.slope_deg, 0)}°</dd>
            {a.ml_probability !== null ? (
              <>
                <dt>ML prob. (exp.)</dt>
                <dd className="text-right text-ink">{formatPercent(a.ml_probability)}</dd>
              </>
            ) : null}
          </dl>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
            {a.data_source === 'demo' ? <DemoTag>Demo rainfall</DemoTag> : <span>Open-Meteo model data</span>}
            <DemoTag>Terrain: estimate</DemoTag>
          </div>
          <div className="text-xs text-ink-muted">Assessed {formatDateTime(a.created_at)}</div>
        </>
      ) : (
        <p className="text-ink-muted">Not assessed yet.</p>
      )}
      <Link to={`/locations/${loc.id}`} className="inline-block font-medium text-brand-700 underline">
        View details
      </Link>
    </div>
  )
}

export function IncidentPopup({ report, adminLink = false }) {
  const place = [report.district, report.state].filter(Boolean).join(', ')
  return (
    <div className="space-y-1.5 text-sm">
      <div className="font-semibold text-ink">{REPORT_CATEGORIES[report.category] ?? report.category}</div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-medium text-ink">{REPORT_STATUS_LABELS[report.status] ?? report.status}</span>
        <span className="text-ink-2">· {SEVERITY_LABELS[report.observed_severity] ?? report.observed_severity}</span>
        {report.is_demo ? <DemoTag /> : null}
      </div>
      <p className="text-ink-2">{report.description}</p>
      {report.photo_url ? (
        <img src={assetUrl(report.photo_url)} alt="Photo submitted with this report" className="max-h-40 w-full rounded object-cover" />
      ) : null}
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-xs text-ink-2">
        <dt>When</dt><dd className="text-ink">{formatDateTime(report.observed_at ?? report.created_at)}</dd>
        {place ? (<><dt>Where</dt><dd className="text-ink">{place}</dd></>) : null}
        {report.location_text ? (<><dt>Landmark</dt><dd className="text-ink">{report.location_text}</dd></>) : null}
        <dt>Location</dt><dd className="text-ink">{LOCATION_SOURCE_LABELS[report.location_source] ?? report.location_source}</dd>
      </dl>
      <p className="text-xs text-ink-muted">Citizen report - not an official warning and not a risk assessment.</p>
      {adminLink ? (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <a href={directionsUrl(report.latitude, report.longitude)} target="_blank" rel="noopener noreferrer"
            className="font-semibold text-brand-700 underline">Get directions</a>
          <Link to="/admin" className="font-medium text-brand-700 underline">Review in Admin</Link>
        </div>
      ) : null}
    </div>
  )
}

export function MapLegend() {
  return (
    <div className="pointer-events-auto rounded-xl border border-line bg-white/95 p-3 text-xs shadow-(--shadow-card)">
      <div className="mb-1.5 font-semibold text-ink">Risk level</div>
      <ul className="space-y-1">
        {LEVELS.map((l) => (
          <li key={l} className="flex items-center gap-2 text-ink-2">
            <span className="h-3 w-3 rounded-full ring-2 ring-white" style={{ background: levelColor(l) }} />
            {l}
          </li>
        ))}
        <li className="flex items-center gap-2 pt-1 text-ink-2">
          <span className="inline-block h-3 w-3"><span className="incident-marker status-verified" /></span>
          Verified incident (citizen report)
        </li>
      </ul>
    </div>
  )
}

export default function RiskMap({ locations = [], reports = [], focus = null, className = 'h-[480px]' }) {
  const sorted = [...locations].sort(
    (a, b) => levelRank(a.latest?.level ?? 'Low') - levelRank(b.latest?.level ?? 'Low'),
  )
  return (
    <MapContainer bounds={NE_INDIA_BOUNDS} className={`w-full ${className}`} scrollWheelZoom>
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <ViewController focus={focus} />
      {sorted.map((loc) => (
        <CircleMarker
          key={`loc-${loc.id}`}
          center={[loc.latitude, loc.longitude]}
          radius={loc.latest && levelRank(loc.latest.level) >= 2 ? 10 : 8}
          pathOptions={{
            color: '#ffffff',
            weight: 2,
            fillColor: levelColor(loc.latest?.level),
            fillOpacity: 0.95,
          }}
        >
          <Popup>
            <LocationPopup loc={loc} />
          </Popup>
        </CircleMarker>
      ))}
      {reports.map((r) => (
        <Marker key={`rep-${r.id}`} position={[r.latitude, r.longitude]} icon={incidentIcon(r.status, r.observed_severity)}>
          <Popup>
            <IncidentPopup report={r} />
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

// Move the view to a newly set point. GPS fixes zoom in further than map clicks.
function Recenter({ position, zoom }) {
  const map = useMap()
  const lat = position?.[0]
  const lon = position?.[1]
  useEffect(() => {
    if (lat === undefined) return
    const target = L.latLng(lat, lon)
    if (!map.getBounds().pad(-0.15).contains(target) || map.getZoom() < zoom) {
      map.setView(target, Math.max(map.getZoom(), zoom))
    }
  }, [lat, lon, zoom, map])
  return null
}

// India-wide map used in the report form: tap/click to place the pin, or drag it.
export function LocationPicker({ value, accuracy = null, source = null, onPick, className = 'h-80' }) {
  const handlers = useMemo(
    () => ({
      dragend(e) {
        const { lat, lng } = e.target.getLatLng()
        onPick(lat, lng)
      },
    }),
    [onPick],
  )
  return (
    <MapContainer
      bounds={INDIA_BOUNDS}
      minZoom={3}
      maxBounds={[[2, 62], [41.5, 103]]}
      className={`w-full rounded-lg ${className}`}
      scrollWheelZoom
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <ClickHandler onPick={onPick} />
      <Recenter position={value} zoom={source === 'gps' ? 15 : 11} />
      {value && source === 'gps' && accuracy ? (
        <Circle center={value} radius={accuracy} pathOptions={{ color: '#2a78d6', weight: 1, fillOpacity: 0.12 }} />
      ) : null}
      {value ? (
        <Marker position={value} icon={pickIcon} draggable eventHandlers={handlers} title="Incident location (drag to adjust)" />
      ) : null}
    </MapContainer>
  )
}
