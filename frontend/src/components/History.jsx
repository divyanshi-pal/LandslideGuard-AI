import { describeEvent, hasUntrackedStatus } from '../lib/history'
import { formatDateTime } from '../lib/risk'
import { HistoryIcon } from './Icons'

const DOT = { amber: 'bg-amber-400', blue: 'bg-[#2a78d6]', gray: 'bg-ink-muted', red: 'bg-red-500' }

// Vertical timeline of a report's verification history.
export default function History({ history, status, showActors = false }) {
  if (!history?.length) {
    return <p className="text-sm text-ink-muted">No history recorded for this report.</p>
  }
  return (
    <div>
      <ol className="relative space-y-5 border-l-2 border-line pl-5">
        {history.map((e) => {
          const d = describeEvent(e)
          return (
            <li key={e.id} className="relative">
              <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${DOT[d.tone] ?? DOT.gray}`} aria-hidden="true" />
              <p className="text-sm font-semibold text-ink">{d.title}</p>
              {d.text ? <p className="text-sm text-ink-2">{d.text}</p> : null}
              <p className="mt-0.5 text-xs text-ink-muted">
                {formatDateTime(e.created_at)}
                {showActors && e.actor ? ` · by ${e.actor}` : !showActors && e.kind === 'status_changed' ? ' · by an administrator' : ''}
              </p>
            </li>
          )
        })}
      </ol>
      {hasUntrackedStatus(status, history) ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-plane px-3 py-2 text-xs text-ink-2">
          <HistoryIcon className="mt-0.5 h-4 w-4 shrink-0" />
          The current status was set before history tracking began, so that change is not listed.
        </p>
      ) : null}
    </div>
  )
}
