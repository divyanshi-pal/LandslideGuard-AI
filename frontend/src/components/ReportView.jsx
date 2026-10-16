import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { assetUrl } from '../api/client'
import { coordinateText, directionsUrl, osmUrl } from '../lib/navigation'
import { LOCATION_SOURCE_LABELS, REPORT_CATEGORIES, SEVERITY_LABELS, formatDateTime } from '../lib/risk'
import { CopyIcon, ExternalIcon, ImageIcon, LayersIcon, NavigateIcon } from './Icons'
import { TILE_ATTRIBUTION, TILE_URL, incidentIcon } from './RiskMap'

const kb = (bytes) => (bytes ? `${Math.round(bytes / 1024)} KB` : null)

export function reportTitle(report) {
  return REPORT_CATEGORIES[report.category] ?? report.category
}

export function ReportMedia({ report, admin = false }) {
  const photoMeta = admin
    ? [report.photo_width ? `${report.photo_width}×${report.photo_height}` : null, kb(report.photo_size_bytes),
       report.photo_exif_datetime ? `camera time ${report.photo_exif_datetime}` : null].filter(Boolean).join(' · ')
    : ''
  if (!report.photo_url && !report.video_url) {
    return (
      <div className="grid h-40 place-items-center rounded-xl border border-dashed border-line bg-plane text-sm text-ink-muted">
        <span className="flex flex-col items-center gap-1">
          <ImageIcon className="h-7 w-7" />
          {report.has_photo ? 'Photo is shown once the report is verified' : 'No photo or video was submitted'}
        </span>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {report.photo_url ? (
        <figure>
          <a href={assetUrl(report.photo_url)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-line bg-plane">
            <img src={assetUrl(report.photo_url)} alt={`Photo submitted with report ${report.id}`} className="max-h-96 w-full object-contain" />
          </a>
          <figcaption className="mt-1.5 text-xs text-ink-muted">
            Photo from the reporter (location metadata removed){photoMeta ? ` · ${photoMeta}` : ''}. A photo alone does not verify a report.
          </figcaption>
        </figure>
      ) : null}
      {admin && report.video_url ? (
        <figure>
          <video src={assetUrl(report.video_url)} controls preload="metadata" className="max-h-80 w-full rounded-xl bg-black" aria-label={`Video for report ${report.id}`} />
          <figcaption className="mt-1.5 text-xs text-ink-muted">Video · {kb(report.video_size_bytes)} · visible to administrators only (metadata not stripped)</figcaption>
        </figure>
      ) : null}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-2.5 text-sm sm:grid-cols-[10rem_1fr]">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  )
}

export function ReportFacts({ report, admin = false }) {
  const place = [report.district, report.state].filter(Boolean).join(', ')
  return (
    <dl className="divide-y divide-line">
      <Row label="Incident type">{reportTitle(report)}</Row>
      <Row label="Severity">{SEVERITY_LABELS[report.observed_severity] ?? report.observed_severity}</Row>
      <Row label="Happened">{formatDateTime(report.observed_at ?? report.created_at)}</Row>
      <Row label="Submitted">{formatDateTime(report.created_at)}</Row>
      <Row label="State / district">{place || <span className="text-ink-muted">Not given</span>}</Row>
      {report.location_text ? <Row label="Landmark">{report.location_text}</Row> : null}
      {admin && report.address ? <Row label={`Address (${report.address_source ?? 'user'})`}>{report.address}</Row> : null}
      <Row label="Coordinates"><span className="tabular">{coordinateText(report.latitude, report.longitude)}</span></Row>
      <Row label="Location source">
        {LOCATION_SOURCE_LABELS[report.location_source] ?? report.location_source}
        {admin && report.location_accuracy_m ? ` (±${Math.round(report.location_accuracy_m)} m)` : ''}
        {admin && report.location_check === 'india_envelope' ? <span className="block text-xs text-ink-muted">Checked against India's bounding box</span> : null}
        {admin && report.location_check === 'india_boundary' ? <span className="block text-xs text-ink-muted">Checked against India's boundary</span> : null}
      </Row>
      {admin ? (
        <>
          <Row label="Reporter">
            {report.reporter_name || 'Anonymous'}
            {report.reporter_contact ? <span className="block text-ink-2">{report.reporter_contact}</span> : null}
          </Row>
          {report.possible_duplicate_of ? (
            <Row label="Possible duplicate">
              Same photo as <Link to={`/reports/${report.possible_duplicate_of}`} className="font-medium text-brand-700 underline">report #{report.possible_duplicate_of}</Link>
            </Row>
          ) : null}
        </>
      ) : null}
    </dl>
  )
}

// Leaflet measures its container once; re-measure when the card's size settles or changes.
function AutoResize() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(el)
    return () => observer.disconnect()
  }, [map])
  return null
}

export function MiniMap({ report, className = 'h-56' }) {
  return (
    <MapContainer
      center={[report.latitude, report.longitude]} zoom={13} scrollWheelZoom={false}
      className={`w-full rounded-xl ${className}`}
    >
      <AutoResize />
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <Marker position={[report.latitude, report.longitude]} icon={incidentIcon(report.status, report.observed_severity)} />
    </MapContainer>
  )
}

// Ways to get to (or share) the reported spot. Directions are for administrators only,
// so the public site never routes curious visitors towards a hazard.
export function ReachActions({ report, admin = false }) {
  const [copied, setCopied] = useState(false)
  const text = coordinateText(report.latitude, report.longitude)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy these coordinates:', text)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link to={`/incidents?report=${report.id}`} className="btn-secondary btn-sm">
        <LayersIcon className="h-4 w-4" /> Open on incident map
      </Link>
      {admin ? (
        <>
          <a href={directionsUrl(report.latitude, report.longitude)} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm" title="Google Maps directions from your current position">
            <NavigateIcon className="h-4 w-4" /> Get directions
          </a>
          <button type="button" onClick={copy} className="btn-secondary btn-sm">
            <CopyIcon className="h-4 w-4" /> {copied ? 'Copied' : 'Copy coordinates'}
          </button>
          <a href={osmUrl(report.latitude, report.longitude)} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
            OpenStreetMap <ExternalIcon className="h-3.5 w-3.5" />
          </a>
        </>
      ) : null}
    </div>
  )
}
