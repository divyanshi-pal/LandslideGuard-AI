import { Link, useParams } from 'react-router'
import { api } from '../api/client'
import History from '../components/History'
import { ChevronLeftIcon, ClipboardIcon, HistoryIcon, ShieldIcon } from '../components/Icons'
import { MiniMap, ReachActions, ReportFacts, ReportMedia, reportTitle } from '../components/ReportView'
import { Card, CardHeader, DemoTag, EmptyState, ErrorBox, Notice, SkeletonCard, StatusBadge } from '../components/ui'
import { useAuth } from '../lib/auth'
import { formatDateTime } from '../lib/risk'
import { useAsync } from '../lib/useAsync'

function useReport(id, isAdmin, checking) {
  return useAsync(async (o) => {
    if (checking) return null
    if (isAdmin) {
      const d = await api.admin.reportDetail(id, o)
      return { visible: true, admin: true, status: d.report.status, report: d.report, history: d.history }
    }
    return { ...(await api.reportDetail(id, o)), admin: false }
  }, [id, isAdmin, checking])
}

export default function ReportDetailPage() {
  const { id } = useParams()
  const { isAdmin, checking } = useAuth()
  const res = useReport(id, isAdmin, checking)
  const d = res.data

  const back = (
    <Link to="/incidents" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-brand-700">
      <ChevronLeftIcon className="h-4 w-4" /> Incident map
    </Link>
  )

  if (res.error?.status === 404) {
    return (
      <>
        {back}
        <Card>
          <EmptyState icon={<ClipboardIcon className="h-6 w-6" />} title={`Report #${id} not found`} action={<Link to="/incidents" className="btn-primary btn-sm">Explore incident map</Link>}>
            The report may have been deleted, or the link is wrong.
          </EmptyState>
        </Card>
      </>
    )
  }
  if (res.error) return <>{back}<ErrorBox error={res.error} onRetry={res.reload} title="Could not load this report" /></>
  if (!d) return <>{back}<div className="grid gap-6 lg:grid-cols-3"><div className="lg:col-span-2"><SkeletonCard lines={8} /></div><SkeletonCard lines={5} /></div></>

  // Not public yet: status and timeline only, so a reporter can follow their report.
  if (!d.visible) {
    return (
      <>
        {back}
        <div className="mx-auto max-w-2xl space-y-6">
          <div>
            <p className="eyebrow">Citizen report</p>
            <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-bold text-ink sm:text-3xl">
              Report #{d.id} <StatusBadge status={d.status} />
            </h1>
            <p className="mt-1 text-sm text-ink-muted">Submitted {formatDateTime(d.created_at)}</p>
          </div>
          <Notice tone={d.status === 'rejected' ? 'warn' : 'info'} title={d.status === 'rejected' ? 'Not published' : 'Awaiting review'}>
            {d.message} Its details stay private until it is verified.
          </Notice>
          <Card>
            <CardHeader icon={<HistoryIcon className="h-4 w-4" />} title="Progress" />
            <div className="p-5"><History history={d.history} status={d.status} /></div>
          </Card>
        </div>
      </>
    )
  }

  const r = d.report
  return (
    <>
      {back}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Report #{r.id}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{reportTitle(r)}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={r.status} />
            {r.is_demo ? <DemoTag /> : null}
            {d.admin ? <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700"><ShieldIcon className="h-3.5 w-3.5" /> Admin view</span> : null}
          </div>
        </div>
        {d.admin ? <Link to={`/admin?tab=reports&report=${r.id}`} className="btn-secondary"><ShieldIcon className="h-4 w-4" /> Review in admin</Link> : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="What was reported" subtitle="In the reporter's own words" />
            <div className="space-y-5 p-5">
              <p className="whitespace-pre-line text-base leading-relaxed text-ink">{r.description}</p>
              <ReportMedia report={r} admin={d.admin} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Details" />
            <div className="px-5 pb-2"><ReportFacts report={r} admin={d.admin} /></div>
          </Card>
          <p className="text-xs text-ink-muted">
            This is a citizen report{r.status === 'verified' || r.status === 'resolved' ? ' confirmed by a LandslideGuard administrator' : ''}.
            It is not an official warning or a risk assessment.
          </p>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <MiniMap report={r} />
            <div className="p-4"><ReachActions report={r} admin={d.admin} /></div>
          </Card>
          <Card>
            <CardHeader icon={<HistoryIcon className="h-4 w-4" />} title="Verification history" subtitle={d.admin ? 'Full audit trail (admin)' : 'Submission and status changes'} />
            <div className="p-5"><History history={d.history} status={r.status} showActors={d.admin} /></div>
          </Card>
        </div>
      </div>
    </>
  )
}
