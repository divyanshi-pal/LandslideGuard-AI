// Reporting coverage (India) - mirrors backend/app/services/geo.py.
// The envelope is a bounding box around India's extreme points; the server may apply a
// precise boundary file on top of it.

export const INDIA_ENVELOPE = { minLat: 6.0, maxLat: 37.6, minLon: 68.0, maxLon: 97.6 }
export const INDIA_BOUNDS = [
  [INDIA_ENVELOPE.minLat, INDIA_ENVELOPE.minLon],
  [INDIA_ENVELOPE.maxLat, INDIA_ENVELOPE.maxLon],
]

export const INDIA_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
]

// Parse a user-typed coordinate. Returns a finite number or null.
export function parseCoordinate(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(text)) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

export function validateIndiaCoordinates(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, error: 'Enter latitude and longitude as decimal numbers, e.g. 31.1048 and 77.1734.' }
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return { ok: false, error: 'Latitude must be between -90 and 90, and longitude between -180 and 180.' }
  }
  const e = INDIA_ENVELOPE
  if (lat < e.minLat || lat > e.maxLat || lon < e.minLon || lon > e.maxLon) {
    return { ok: false, error: 'This point is outside India. Reports can only be made for locations in India.' }
  }
  return { ok: true }
}
