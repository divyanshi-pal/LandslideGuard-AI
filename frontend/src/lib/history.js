// Human-readable timeline entries for a report's verification history.
import { REPORT_STATUS_LABELS } from './risk'

export function describeEvent(event) {
  switch (event.kind) {
    case 'submitted':
      return { title: 'Report submitted', tone: 'amber', text: 'Received as an unverified citizen report.' }
    case 'status_changed': {
      const to = REPORT_STATUS_LABELS[event.to_status] ?? event.to_status
      const from = event.from_status ? REPORT_STATUS_LABELS[event.from_status] ?? event.from_status : null
      const tone = { verified: 'blue', resolved: 'gray', rejected: 'red', pending: 'amber' }[event.to_status] ?? 'gray'
      return { title: `Status: ${to}`, tone, text: from ? `Changed from ${from}.` : 'Previous status was not recorded.' }
    }
    case 'location_corrected':
      return { title: 'Location details corrected', tone: 'gray', text: event.detail ?? null }
    case 'notes_updated':
      return { title: 'Internal note updated', tone: 'gray', text: null }
    default:
      return { title: event.kind, tone: 'gray', text: event.detail ?? null }
  }
}

// True when the report's current status was set before history tracking started.
export function hasUntrackedStatus(status, history) {
  const statusEvents = (history ?? []).filter((e) => e.kind === 'status_changed' || e.kind === 'submitted')
  const last = statusEvents[statusEvents.length - 1]
  return Boolean(last) && last.to_status !== status
}
