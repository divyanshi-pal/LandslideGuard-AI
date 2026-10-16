import { describe, expect, it } from 'vitest'
import { LEVELS, formatNumber, formatPercent, levelColor, levelForScore, levelRank, sourceLabel, timeAgo } from './risk'

describe('risk levels', () => {
  it('maps scores to the same thresholds as the backend', () => {
    expect(levelForScore(0)).toBe('Low')
    expect(levelForScore(24.9)).toBe('Low')
    expect(levelForScore(25)).toBe('Moderate')
    expect(levelForScore(50)).toBe('High')
    expect(levelForScore(75)).toBe('Very High')
  })

  it('orders levels and gives each a distinct colour', () => {
    expect(LEVELS.map(levelRank)).toEqual([0, 1, 2, 3])
    expect(new Set(LEVELS.map(levelColor)).size).toBe(4)
    expect(levelColor('Unknown')).toBe('#898781')
  })
})

describe('formatting', () => {
  it('formats numbers and missing values', () => {
    expect(formatNumber(1234.567, 1)).toBe('1,234.6')
    expect(formatNumber(null)).toBe('-')
    expect(formatPercent(0.4567, 1)).toBe('45.7%')
    expect(formatPercent(undefined)).toBe('-')
  })

  it('labels data sources honestly', () => {
    expect(sourceLabel('demo')).toMatch(/Simulated/)
    expect(sourceLabel('open-meteo')).toMatch(/Open-Meteo/)
  })

  it('describes elapsed time', () => {
    const now = Date.parse('2026-10-11T12:00:00Z')
    expect(timeAgo('2026-10-11T11:59:30Z', now)).toBe('just now')
    expect(timeAgo('2026-10-11T11:30:00Z', now)).toBe('30 min ago')
    expect(timeAgo('2026-10-11T07:00:00Z', now)).toBe('5 h ago')
    expect(timeAgo('2026-10-07T12:00:00Z', now)).toBe('4 days ago')
  })
})
