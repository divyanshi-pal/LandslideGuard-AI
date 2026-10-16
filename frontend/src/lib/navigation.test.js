import { describe, expect, it } from 'vitest'
import { coordinateText, directionsUrl, osmUrl } from './navigation'

describe('navigation links', () => {
  it('builds a Google Maps directions link to the exact reported point', () => {
    expect(directionsUrl(9.9312, 76.2673)).toBe('https://www.google.com/maps/dir/?api=1&destination=9.9312%2C76.2673')
  })

  it('builds an OpenStreetMap link centred on the point', () => {
    expect(osmUrl(31.1048, 77.1734)).toBe('https://www.openstreetmap.org/?mlat=31.1048&mlon=77.1734#map=17/31.1048/77.1734')
  })

  it('formats coordinates for copying without float noise', () => {
    expect(coordinateText(25.18, 93.03)).toBe('25.18, 93.03')
    expect(coordinateText(10.123456789, 76.1)).toBe('10.123457, 76.1')
  })
})
