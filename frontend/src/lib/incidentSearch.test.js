import { describe, expect, it } from 'vitest'
import { matchesQuery } from './incidentSearch'

const report = {
  id: 6, category: 'flood', state: 'Kerala', district: 'Ernakulam',
  location_text: 'Near the canal bridge', description: 'Water entering houses after heavy rain',
}

describe('incident search', () => {
  it('matches state, district, landmark, type and description, case-insensitively', () => {
    for (const q of ['kerala', 'ERNAKULAM', 'canal bridge', 'flood', 'waterlogging', 'heavy rain', 'kerala flood']) {
      expect(matchesQuery(report, q)).toBe(true)
    }
  })

  it('requires every word to match', () => {
    expect(matchesQuery(report, 'kerala landslide')).toBe(false)
    expect(matchesQuery(report, 'Assam')).toBe(false)
  })

  it('finds a report by its id', () => {
    expect(matchesQuery(report, '#6')).toBe(true)
    expect(matchesQuery(report, '6')).toBe(true)
    expect(matchesQuery(report, '61')).toBe(false)
  })

  it('treats an empty query as a match', () => {
    expect(matchesQuery(report, '   ')).toBe(true)
  })
})
