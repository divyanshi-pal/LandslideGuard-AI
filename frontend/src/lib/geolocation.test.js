import { describe, expect, it } from 'vitest'
import { GeoError, requestCurrentPosition } from './geolocation'

function fakeGeolocation({ position, error }) {
  const calls = []
  return {
    calls,
    getCurrentPosition(success, failure, options) {
      calls.push(options)
      if (error) failure(error)
      else success(position)
    },
  }
}

describe('requestCurrentPosition', () => {
  it('returns the device coordinates and accuracy, labelled as GPS', async () => {
    const geo = fakeGeolocation({ position: { coords: { latitude: 31.1048, longitude: 77.1734, accuracy: 14 }, timestamp: 5 } })
    const pos = await requestCurrentPosition({ geolocation: geo, secure: true })
    expect(pos).toEqual({ latitude: 31.1048, longitude: 77.1734, accuracy: 14, timestamp: 5, source: 'gps' })
    expect(geo.calls[0]).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 })
  })

  it.each([
    [1, 'permission_denied', /permission was denied/],
    [2, 'position_unavailable', /could not determine/],
    [3, 'timeout', /too long/],
    [99, 'unknown', /Could not get your location/],
  ])('maps browser error code %i to %s', async (code, expected, message) => {
    const geo = fakeGeolocation({ error: { code, message: 'browser text' } })
    const err = await requestCurrentPosition({ geolocation: geo, secure: true }).catch((e) => e)
    expect(err).toBeInstanceOf(GeoError)
    expect(err.code).toBe(expected)
    expect(err.message).toMatch(message)
  })

  it('reports missing browser support', async () => {
    const err = await requestCurrentPosition({ geolocation: undefined }).catch((e) => e)
    expect(err.code).toBe('unsupported')
  })

  it('refuses on an insecure page instead of asking', async () => {
    const geo = fakeGeolocation({ position: { coords: { latitude: 1, longitude: 2, accuracy: 3 } } })
    const err = await requestCurrentPosition({ geolocation: geo, secure: false }).catch((e) => e)
    expect(err.code).toBe('insecure')
    expect(geo.calls).toHaveLength(0)
  })

  it('never resolves with invented coordinates when the device gives none', async () => {
    const geo = fakeGeolocation({ position: { coords: { latitude: NaN, longitude: undefined } } })
    const err = await requestCurrentPosition({ geolocation: geo, secure: true }).catch((e) => e)
    expect(err.code).toBe('position_unavailable')
  })
})
