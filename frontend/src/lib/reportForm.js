// Pure helpers for the incident report form (kept free of React so they can be unit-tested).
import { parseCoordinate, validateIndiaCoordinates } from './india'

export const PHOTO_TYPES = { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] }
export const VIDEO_TYPES = {
  'video/mp4': ['.mp4', '.m4v'],
  'video/quicktime': ['.mov'],
  'video/webm': ['.webm'],
  'video/3gpp': ['.3gp'],
}

const round6 = (n) => Number(Number(n).toFixed(6))

// ---------------------------------------------------------------- location state
// `source` records where the coordinates came from: 'gps' | 'map' | 'manual' | null.
// GPS coordinates are only ever set by a successful 'gps_success' action.
export const initialLocation = { lat: '', lon: '', source: null, accuracy: null, gps: { status: 'idle', error: null, code: null } }

export function locationReducer(state, action) {
  switch (action.type) {
    case 'gps_start':
      return { ...state, gps: { status: 'locating', error: null, code: null } }
    case 'gps_success':
      return {
        lat: String(round6(action.latitude)),
        lon: String(round6(action.longitude)),
        source: 'gps',
        accuracy: Number.isFinite(action.accuracy) ? action.accuracy : null,
        gps: { status: 'success', error: null, code: null },
      }
    case 'gps_error':
      // Keep whatever location the user already had; never substitute a position.
      return { ...state, gps: { status: 'error', error: action.message, code: action.code ?? 'unknown' } }
    case 'map_pick':
      return { ...state, lat: String(round6(action.lat)), lon: String(round6(action.lon)), source: 'map', accuracy: null }
    case 'manual_edit': {
      const next = { ...state, [action.field]: action.value, accuracy: null }
      next.source = next.lat === '' && next.lon === '' ? null : 'manual'
      return next
    }
    case 'reset':
      return initialLocation
    default:
      return state
  }
}

export function locationPoint(loc) {
  const lat = parseCoordinate(loc.lat)
  const lon = parseCoordinate(loc.lon)
  if (lat === null || lon === null) return null
  return validateIndiaCoordinates(lat, lon).ok ? [lat, lon] : null
}

export function describeSource(loc) {
  if (loc.source === 'gps') {
    return loc.accuracy !== null ? `From your device's GPS (accuracy ±${Math.round(loc.accuracy)} m)` : "From your device's GPS"
  }
  if (loc.source === 'map') return 'Selected on the map'
  if (loc.source === 'manual') return 'Entered manually'
  return 'Not set yet'
}

// ---------------------------------------------------------------- files
function extOf(name = '') {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

export function validateFile(file, kind, limits) {
  if (!file) return null
  const types = kind === 'video' ? VIDEO_TYPES : PHOTO_TYPES
  const maxMb = kind === 'video' ? limits.videoMb : limits.photoMb
  const typeOk = file.type ? file.type in types : Object.values(types).flat().includes(extOf(file.name))
  if (!typeOk) {
    return kind === 'video' ? 'Please choose an MP4, MOV, WebM or 3GP video.' : 'Please choose a JPEG, PNG or WebP photo.'
  }
  if (file.size === 0) return `The selected ${kind} is empty.`
  if (file.size > maxMb * 1024 * 1024) return `The ${kind} is larger than ${maxMb} MB.`
  return null
}

// ---------------------------------------------------------------- time
// Value for <input type="datetime-local"> in the user's local time.
export function toLocalInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ---------------------------------------------------------------- validation and payload
// Wizard steps: 0 details, 1 location, 2 media, 3 review.
export const WIZARD_STEPS = ['Incident details', 'Location', 'Photo & video', 'Review & submit']

export function validateDetails(form, now = new Date()) {
  if (!form.category) return { field: 'category', message: 'Choose the type of incident.' }
  if (!form.severity) return { field: 'severity', message: 'Choose how serious it is.' }
  if (!form.observedAt) return { field: 'observedAt', message: 'Enter when it happened.' }
  const when = new Date(form.observedAt)
  if (Number.isNaN(when.getTime())) return { field: 'observedAt', message: 'Enter a valid date and time.' }
  if (when.getTime() > now.getTime() + 10 * 60 * 1000) {
    return { field: 'observedAt', message: 'The incident time cannot be in the future.' }
  }
  if (when.getTime() < now.getTime() - 365 * 24 * 3600 * 1000) {
    return { field: 'observedAt', message: 'Reports can be made for incidents within the last year.' }
  }
  if ((form.description ?? '').trim().length < 10) {
    return { field: 'description', message: 'Describe what you saw in at least 10 characters.' }
  }
  return null
}

export function validateLocation(loc) {
  if (loc.lat === '' && loc.lon === '') {
    return { field: 'location', message: 'Set the location: use your location, tap the map, or type the coordinates.' }
  }
  const lat = parseCoordinate(loc.lat)
  const lon = parseCoordinate(loc.lon)
  const check = validateIndiaCoordinates(lat ?? NaN, lon ?? NaN)
  if (!check.ok) return { field: 'location', message: check.error }
  if (!loc.source) return { field: 'location', message: 'Set the location again so its source is known.' }
  return null
}

export function validateStep(step, form, loc, now = new Date()) {
  if (step === 0) return validateDetails(form, now)
  if (step === 1) return validateLocation(loc)
  return null
}

export function validateReport(form, loc, now = new Date()) {
  if (!form.category) return { field: 'category', message: 'Choose the type of incident.' }
  if ((form.description ?? '').trim().length < 10) {
    return { field: 'description', message: 'Describe what you saw in at least 10 characters.' }
  }
  if (form.observedAt) {
    const when = new Date(form.observedAt)
    if (Number.isNaN(when.getTime())) return { field: 'observedAt', message: 'Enter a valid date and time.' }
    if (when.getTime() > now.getTime() + 10 * 60 * 1000) {
      return { field: 'observedAt', message: 'The incident time cannot be in the future.' }
    }
  }
  if (loc.lat === '' && loc.lon === '') {
    return { field: 'location', message: 'Set the location: use your location, tap the map, or type the coordinates.' }
  }
  const lat = parseCoordinate(loc.lat)
  const lon = parseCoordinate(loc.lon)
  const check = validateIndiaCoordinates(lat ?? NaN, lon ?? NaN)
  if (!check.ok) return { field: 'location', message: check.error }
  if (!loc.source) return { field: 'location', message: 'Set the location again so its source is known.' }
  return null
}

export function buildReportFormData({ form, loc, photo, video, submissionId }) {
  const fd = new FormData()
  fd.append('category', form.category)
  fd.append('observed_severity', form.severity)
  fd.append('description', form.description.trim())
  if (form.observedAt) fd.append('observed_at', new Date(form.observedAt).toISOString())
  fd.append('latitude', String(parseCoordinate(loc.lat)))
  fd.append('longitude', String(parseCoordinate(loc.lon)))
  fd.append('location_source', loc.source)
  if (loc.source === 'gps' && loc.accuracy !== null) fd.append('location_accuracy_m', String(loc.accuracy))
  for (const [key, field] of [
    ['state', 'state'], ['district', 'district'], ['address', 'address'], ['location_text', 'landmark'],
    ['reporter_name', 'name'], ['reporter_contact', 'contact'],
  ]) {
    const value = (form[field] ?? '').trim()
    if (value) fd.append(key, value)
  }
  if ((form.address ?? '').trim()) fd.append('address_source', form.addressSource === 'geocoder' ? 'geocoder' : 'user')
  fd.append('client_submission_id', submissionId)
  if (photo) fd.append('photo', photo)
  if (video) fd.append('video', video)
  return fd
}

export function newSubmissionId() {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID().replaceAll('-', '')
  const bytes = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Merge a reverse-geocoding suggestion: only fill fields that are empty or still hold the previous suggestion.
export function mergeSuggestion(form, previous, suggestion) {
  const next = { ...form }
  for (const field of ['state', 'district', 'address']) {
    const value = suggestion?.[field]
    if (!value) continue
    if (!form[field] || form[field] === previous?.[field]) next[field] = value
  }
  if (suggestion?.address && next.address === suggestion.address) next.addressSource = 'geocoder'
  return next
}
