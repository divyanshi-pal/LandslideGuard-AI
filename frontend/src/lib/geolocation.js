// Promise wrapper around the browser Geolocation API with clear, actionable error messages.
// It only ever returns coordinates the device actually reported - it never invents a position.

export const GEO_MESSAGES = {
  unsupported: 'This browser cannot share your location. Pick the spot on the map or type the coordinates.',
  insecure:
    'Location access needs a secure connection (https or http://localhost). Pick the spot on the map instead.',
  permission_denied:
    'Location permission was denied. To use GPS, allow location for this site in your browser settings, or pick the spot on the map.',
  position_unavailable:
    'Your device could not determine its location (GPS or network unavailable). Try again outdoors, or pick the spot on the map.',
  timeout: 'Getting your location took too long. Try again, or pick the spot on the map.',
  unknown: 'Could not get your location. Pick the spot on the map or type the coordinates.',
}

const CODES = { 1: 'permission_denied', 2: 'position_unavailable', 3: 'timeout' }

export class GeoError extends Error {
  constructor(code) {
    super(GEO_MESSAGES[code] ?? GEO_MESSAGES.unknown)
    this.name = 'GeoError'
    this.code = GEO_MESSAGES[code] ? code : 'unknown'
  }
}

export function requestCurrentPosition({
  geolocation = globalThis.navigator?.geolocation,
  secure = globalThis.isSecureContext ?? true,
  timeoutMs = 20000,
} = {}) {
  return new Promise((resolve, reject) => {
    if (!geolocation || typeof geolocation.getCurrentPosition !== 'function') {
      reject(new GeoError('unsupported'))
      return
    }
    if (secure === false) {
      reject(new GeoError('insecure'))
      return
    }
    geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords ?? {}
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          reject(new GeoError('position_unavailable'))
          return
        }
        resolve({
          latitude,
          longitude,
          accuracy: Number.isFinite(accuracy) ? accuracy : null,
          timestamp: pos.timestamp ?? Date.now(),
          source: 'gps',
        })
      },
      (err) => reject(new GeoError(CODES[err?.code] ?? 'unknown')),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    )
  })
}
