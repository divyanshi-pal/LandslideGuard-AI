// Shared risk-level metadata and formatting helpers.

export const LEVELS = ['Low', 'Moderate', 'High', 'Very High']

export const LEVEL_COLORS = {
  Low: '#0ca30c',
  Moderate: '#fab219',
  High: '#ec835a',
  'Very High': '#d03b3b',
}

export function levelColor(level) {
  return LEVEL_COLORS[level] ?? '#898781'
}

export function levelRank(level) {
  return LEVELS.indexOf(level)
}

export function levelForScore(score) {
  if (score >= 75) return 'Very High'
  if (score >= 50) return 'High'
  if (score >= 25) return 'Moderate'
  return 'Low'
}

export const SOURCE_LABELS = {
  demo: 'Simulated demo data',
  'open-meteo': 'Open-Meteo model data (live)',
  mixed: 'Mixed sources',
}

export function sourceLabel(source) {
  return SOURCE_LABELS[source] ?? source ?? 'Unknown'
}

// Incident types (keys must match backend REPORT_CATEGORIES).
export const REPORT_CATEGORIES = {
  landslide: 'Landslide',
  debris_flow: 'Debris flow / mudslide',
  rockfall: 'Rockfall',
  ground_crack: 'Cracks in ground, slope or walls',
  slope_movement: 'Soil movement / tilting trees or poles',
  land_subsidence: 'Land subsidence / sinking ground',
  flood: 'Flood / waterlogging',
  flash_flood: 'Flash flood / cloudburst',
  water_seepage: 'Unusual water seepage or new springs',
  road_blocked: 'Road blocked by debris or water',
  other: 'Other',
}

export const REPORT_CATEGORY_HINTS = {
  landslide: 'Earth or rock slid down a slope',
  debris_flow: 'Fast flow of mud, rocks and water',
  rockfall: 'Rocks falling from a cliff or road cut',
  ground_crack: 'New cracks in ground, slopes or walls',
  slope_movement: 'Tilting trees, poles or walls',
  land_subsidence: 'Ground sinking or settling',
  flood: 'Water flooding homes, fields or roads',
  flash_flood: 'Sudden flood or cloudburst',
  water_seepage: 'New springs or muddy seepage',
  road_blocked: 'Debris, fallen trees or water on the road',
  other: 'Something else worth reporting',
}

export const SEVERITY_LABELS = { minor: 'Minor', moderate: 'Moderate', severe: 'Severe' }

export const REPORT_STATUSES = ['pending', 'verified', 'resolved', 'rejected']

// How each kind of information is labelled everywhere in the UI.
export const REPORT_STATUS_LABELS = {
  pending: 'Unverified citizen report',
  verified: 'Verified incident',
  resolved: 'Resolved incident',
  rejected: 'Rejected report',
}

export const LOCATION_SOURCE_LABELS = {
  gps: 'Device GPS',
  map: 'Selected on map',
  manual: 'Entered manually',
  unknown: 'Source not recorded',
}

export function alertKind(alert) {
  if (alert.official_source) return { label: `Official warning relayed from ${alert.official_source}`, tone: 'red' }
  if (alert.source === 'admin') return { label: 'Advisory by LandslideGuard admin (not an official warning)', tone: 'blue' }
  return { label: 'Automatic model estimate (not an official warning)', tone: 'gray' }
}

export const SOIL_TYPES = ['rock', 'sandy', 'loamy', 'clay']

export function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatPercent(fraction, digits = 0) {
  if (fraction === null || fraction === undefined) return '-'
  return `${formatNumber(fraction * 100, digits)}%`
}

export function formatDateTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeAgo(iso, now = Date.now()) {
  if (!iso) return '-'
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000)
  if (Number.isNaN(seconds)) return '-'
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} days ago`
}
