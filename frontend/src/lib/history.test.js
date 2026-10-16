import { describe, expect, it } from 'vitest'
import { describeEvent, hasUntrackedStatus } from './history'

describe('report history', () => {
  it('describes submissions and status changes in plain words', () => {
    expect(describeEvent({ kind: 'submitted', to_status: 'pending' }).title).toBe('Report submitted')
    const verified = describeEvent({ kind: 'status_changed', from_status: 'pending', to_status: 'verified' })
    expect(verified.title).toBe('Status: Verified incident')
    expect(verified.text).toBe('Changed from Unverified citizen report.')
    expect(verified.tone).toBe('blue')
    expect(describeEvent({ kind: 'status_changed', from_status: null, to_status: 'rejected' }).text).toMatch(/not recorded/)
  })

  it('describes admin edits', () => {
    expect(describeEvent({ kind: 'location_corrected', detail: 'Corrected: district' }).text).toBe('Corrected: district')
    expect(describeEvent({ kind: 'notes_updated' }).title).toBe('Internal note updated')
  })

  it('detects a status set before history tracking began', () => {
    const submittedOnly = [{ kind: 'submitted', to_status: 'pending' }]
    expect(hasUntrackedStatus('verified', submittedOnly)).toBe(true)
    expect(hasUntrackedStatus('pending', submittedOnly)).toBe(false)
    expect(hasUntrackedStatus('verified', [...submittedOnly, { kind: 'status_changed', to_status: 'verified' }])).toBe(false)
    expect(hasUntrackedStatus('verified', [])).toBe(false)
  })
})
