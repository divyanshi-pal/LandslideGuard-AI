// Client-side text search over loaded incident reports (state, district, landmark, type, text, id).
import { REPORT_CATEGORIES } from './risk'

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')

export function matchesQuery(report, query) {
  const q = norm(query).trim()
  if (!q) return true
  if (/^#?\d+$/.test(q)) return String(report.id) === q.replace('#', '')
  const haystack = norm([
    report.state, report.district, report.location_text, report.description,
    REPORT_CATEGORIES[report.category], report.category,
  ].filter(Boolean).join(' '))
  return q.split(/\s+/).every((word) => haystack.includes(word))
}
