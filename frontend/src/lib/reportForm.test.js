import { describe, expect, it } from 'vitest'
import { INDIA_STATES, parseCoordinate, validateIndiaCoordinates } from './india'
import {
  buildReportFormData,
  describeSource,
  initialLocation,
  locationPoint,
  locationReducer,
  mergeSuggestion,
  newSubmissionId,
  validateFile,
  validateReport,
  validateStep,
  WIZARD_STEPS,
} from './reportForm'

const reduce = (actions, start = initialLocation) => actions.reduce(locationReducer, start)

describe('India coordinates', () => {
  it.each([
    ['Kochi, Kerala', 9.931, 76.267],
    ['Leh, Ladakh', 34.152, 77.577],
    ['Port Blair, Andaman and Nicobar', 11.623, 92.726],
    ['Bhuj, Gujarat', 23.242, 69.666],
    ['Tawang, Arunachal Pradesh', 27.586, 91.866],
    ['Shimla, Himachal Pradesh', 31.104, 77.173],
  ])('accepts %s', (_, lat, lon) => {
    expect(validateIndiaCoordinates(lat, lon).ok).toBe(true)
  })

  it.each([
    ['London', 51.5, -0.12],
    ['Karachi', 24.86, 67.01],
    ['Null Island', 0, 0],
    ['bad latitude', 95, 77],
  ])('rejects %s', (_, lat, lon) => {
    expect(validateIndiaCoordinates(lat, lon).ok).toBe(false)
  })

  it('parses typed coordinates strictly', () => {
    expect(parseCoordinate(' 31.1048 ')).toBe(31.1048)
    expect(parseCoordinate('-0.5')).toBe(-0.5)
    expect(parseCoordinate('31,1')).toBeNull()
    expect(parseCoordinate('abc')).toBeNull()
    expect(parseCoordinate('')).toBeNull()
    expect(parseCoordinate('1e3')).toBeNull()
  })

  it('lists all 28 states and 8 union territories', () => {
    expect(INDIA_STATES).toHaveLength(36)
    expect(new Set(INDIA_STATES).size).toBe(36)
  })
})

describe('location source tracking', () => {
  it('records GPS coordinates and accuracy only from a successful GPS fix', () => {
    const loc = reduce([{ type: 'gps_start' }, { type: 'gps_success', latitude: 31.10412345, longitude: 77.1734, accuracy: 9.6 }])
    expect(loc).toMatchObject({ lat: '31.104123', lon: '77.1734', source: 'gps', accuracy: 9.6 })
    expect(describeSource(loc)).toBe("From your device's GPS (accuracy ±10 m)")
  })

  it('permission denial leaves the location empty - nothing is fabricated', () => {
    const loc = reduce([{ type: 'gps_start' }, { type: 'gps_error', code: 'permission_denied', message: 'denied' }])
    expect(loc.lat).toBe('')
    expect(loc.source).toBeNull()
    expect(loc.gps).toEqual({ status: 'error', error: 'denied', code: 'permission_denied' })
    expect(locationPoint(loc)).toBeNull()
  })

  it('a GPS failure keeps an earlier map selection unchanged', () => {
    const loc = reduce([{ type: 'map_pick', lat: 25.5, lon: 91.9 }, { type: 'gps_error', code: 'timeout', message: 't' }])
    expect(loc).toMatchObject({ lat: '25.5', lon: '91.9', source: 'map' })
  })

  it('picking on the map replaces GPS and drops its accuracy', () => {
    const loc = reduce([
      { type: 'gps_success', latitude: 31.1, longitude: 77.1, accuracy: 20 },
      { type: 'map_pick', lat: 31.2, lon: 77.2 },
    ])
    expect(loc).toMatchObject({ source: 'map', accuracy: null, lat: '31.2', lon: '77.2' })
    expect(describeSource(loc)).toBe('Selected on the map')
  })

  it('typing coordinates marks them as manual', () => {
    const loc = reduce([
      { type: 'gps_success', latitude: 31.1, longitude: 77.1, accuracy: 20 },
      { type: 'manual_edit', field: 'lat', value: '31.15' },
    ])
    expect(loc).toMatchObject({ source: 'manual', accuracy: null, lat: '31.15' })
    expect(locationPoint(loc)).toEqual([31.15, 77.1])
  })

  it('clearing both typed fields clears the source', () => {
    const loc = reduce([
      { type: 'manual_edit', field: 'lat', value: '1' },
      { type: 'manual_edit', field: 'lat', value: '' },
    ])
    expect(loc.source).toBeNull()
  })
})

describe('form validation and payload', () => {
  const form = {
    category: 'flood', severity: 'severe', description: 'Water over the bridge since morning',
    observedAt: '', state: 'Kerala', district: 'Idukki', address: '', addressSource: null,
    landmark: 'Old bridge', name: '', contact: '',
  }
  const mapLoc = reduce([{ type: 'map_pick', lat: 10.089, lon: 77.06 }])

  it('requires a valid location in India', () => {
    expect(validateReport(form, initialLocation).field).toBe('location')
    const london = reduce([{ type: 'manual_edit', field: 'lat', value: '51.5' }, { type: 'manual_edit', field: 'lon', value: '-0.1' }])
    expect(validateReport(form, london).message).toMatch(/outside India/)
    expect(validateReport(form, mapLoc)).toBeNull()
  })

  it('rejects short descriptions and future incident times', () => {
    expect(validateReport({ ...form, description: 'short' }, mapLoc).field).toBe('description')
    const now = new Date('2026-10-12T10:00:00')
    expect(validateReport({ ...form, observedAt: '2026-10-12T12:00' }, mapLoc, now).field).toBe('observedAt')
  })

  it('builds the multipart payload with the location source', () => {
    const fd = buildReportFormData({ form: { ...form, observedAt: '2026-10-12T09:30' }, loc: mapLoc, submissionId: 'abc12345' })
    expect(fd.get('location_source')).toBe('map')
    expect(fd.get('latitude')).toBe('10.089')
    expect(fd.get('location_accuracy_m')).toBeNull()
    expect(fd.get('state')).toBe('Kerala')
    expect(fd.get('location_text')).toBe('Old bridge')
    expect(fd.get('client_submission_id')).toBe('abc12345')
    expect(fd.get('reporter_contact')).toBeNull()
    expect(fd.get('observed_at')).toBe(new Date('2026-10-12T09:30').toISOString())
  })

  it('sends GPS accuracy only for GPS locations', () => {
    const gps = reduce([{ type: 'gps_success', latitude: 10.1, longitude: 77.1, accuracy: 12 }])
    expect(buildReportFormData({ form, loc: gps, submissionId: 'abc12345' }).get('location_accuracy_m')).toBe('12')
  })

  it('creates unique submission ids in the accepted format', () => {
    const a = newSubmissionId()
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    expect(newSubmissionId()).not.toBe(a)
  })
})

describe('wizard step validation', () => {
  const now = new Date('2026-10-13T10:00:00')
  const details = { category: 'landslide', severity: 'severe', observedAt: '2026-10-13T08:30', description: 'Road above the school has collapsed' }

  it('blocks step 1 until type, severity, a sensible time and a description are given', () => {
    expect(validateStep(0, details, initialLocation, now)).toBeNull()
    expect(validateStep(0, { ...details, severity: '' }, initialLocation, now).field).toBe('severity')
    expect(validateStep(0, { ...details, observedAt: '' }, initialLocation, now).field).toBe('observedAt')
    expect(validateStep(0, { ...details, observedAt: '2026-10-13T12:00' }, initialLocation, now).message).toMatch(/future/)
    expect(validateStep(0, { ...details, observedAt: '2025-01-01T00:00' }, initialLocation, now).message).toMatch(/last year/)
    expect(validateStep(0, { ...details, description: 'too short' }, initialLocation, now).field).toBe('description')
  })

  it('blocks step 2 until a location in India with a known source is set', () => {
    expect(validateStep(1, details, initialLocation, now).field).toBe('location')
    const gpsDenied = reduce([{ type: 'gps_error', code: 'permission_denied', message: 'denied' }])
    expect(validateStep(1, details, gpsDenied, now).field).toBe('location') // GPS failure never fills a location
    const picked = reduce([{ type: 'map_pick', lat: 31.1, lon: 77.17 }])
    expect(validateStep(1, details, picked, now)).toBeNull()
  })

  it('does not block the optional media step', () => {
    expect(validateStep(2, details, initialLocation, now)).toBeNull()
    expect(WIZARD_STEPS).toHaveLength(4)
  })
})

describe('file validation', () => {
  const limits = { photoMb: 5, videoMb: 25 }
  const file = (name, type, size) => ({ name, type, size })

  it('accepts supported photos and videos', () => {
    expect(validateFile(file('a.jpg', 'image/jpeg', 1000), 'photo', limits)).toBeNull()
    expect(validateFile(file('v.mov', 'video/quicktime', 1000), 'video', limits)).toBeNull()
    expect(validateFile(file('v.webm', '', 1000), 'video', limits)).toBeNull() // type missing: use extension
  })

  it('rejects wrong types, empty and oversized files', () => {
    expect(validateFile(file('a.gif', 'image/gif', 10), 'photo', limits)).toMatch(/JPEG, PNG or WebP/)
    expect(validateFile(file('a.exe', 'application/x-msdownload', 10), 'video', limits)).toMatch(/MP4/)
    expect(validateFile(file('a.jpg', 'image/jpeg', 0), 'photo', limits)).toMatch(/empty/)
    expect(validateFile(file('a.jpg', 'image/jpeg', 6 * 1024 * 1024), 'photo', limits)).toMatch(/larger than 5 MB/)
    expect(validateFile(file('v.mp4', 'video/mp4', 26 * 1024 * 1024), 'video', limits)).toMatch(/larger than 25 MB/)
  })
})

describe('address suggestions', () => {
  it('fills empty fields and replaces only previous suggestions, never user input', () => {
    const first = { state: 'Himachal Pradesh', district: 'Shimla', address: 'The Mall, Shimla' }
    let form = mergeSuggestion({ state: '', district: 'Typed by user', address: '' }, null, first)
    expect(form).toMatchObject({ state: 'Himachal Pradesh', district: 'Typed by user', address: 'The Mall, Shimla', addressSource: 'geocoder' })
    form = mergeSuggestion(form, first, { state: 'Punjab', district: 'Mohali', address: 'Sector 70' })
    expect(form).toMatchObject({ state: 'Punjab', district: 'Typed by user', address: 'Sector 70' })
  })
})
