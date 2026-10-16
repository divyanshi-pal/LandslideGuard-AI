import { cloneElement, useEffect, useId, useRef } from 'react'
import { Link } from 'react-router'
import { REPORT_STATUS_LABELS, levelColor } from '../lib/risk'
import {
  AlertIcon,
  BellIcon,
  CheckCircleIcon,
  CheckIcon,
  ClipboardIcon,
  CloseIcon,
  InfoIcon,
  SparkIcon,
  XCircleIcon,
} from './Icons'

// ---------------------------------------------------------------- layout
export function Card({ className = '', children, as: Element = 'section', ...rest }) {
  return (
    <Element className={`card ${className}`} {...rest}>
      {children}
    </Element>
  )
}

export function CardHeader({ title, subtitle, action, icon }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, eyebrow, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-3xl text-ink-2">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  )
}

export function SectionTitle({ title, subtitle, eyebrow, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h2 className="text-lg font-semibold text-ink sm:text-xl">{title}</h2>
        {subtitle ? <p className="mt-0.5 max-w-3xl text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

// ---------------------------------------------------------------- badges
export function RiskBadge({ level, score, size = 'md' }) {
  const pad = size === 'lg' ? 'px-3 py-1.5 text-base' : 'px-2.5 py-0.5 text-sm'
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white font-medium text-ink ${pad}`}>
      <span className={size === 'lg' ? 'h-3 w-3 rounded-full' : 'h-2.5 w-2.5 rounded-full'} style={{ background: levelColor(level) }} aria-hidden="true" />
      {level}
      {score !== undefined && score !== null ? <span className="tabular text-ink-muted">· {Math.round(score)}</span> : null}
    </span>
  )
}

export function DemoTag({ children = 'DEMO' }) {
  return (
    <span className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
      {children}
    </span>
  )
}

const TAG_TONES = {
  gray: 'border-line bg-plane text-ink-2',
  blue: 'border-blue-200 bg-blue-50 text-blue-900',
  green: 'border-brand-200 bg-brand-50 text-brand-800',
  red: 'border-red-200 bg-red-50 text-red-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  navy: 'border-navy-700/20 bg-navy-800 text-white',
}

export function Tag({ children, tone = 'gray', icon }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium ${TAG_TONES[tone] ?? TAG_TONES.gray}`}>
      {icon}
      {children}
    </span>
  )
}

const STATUS_STYLE = {
  pending: { tone: 'amber', Icon: ClipboardIcon },
  verified: { tone: 'blue', Icon: CheckCircleIcon },
  resolved: { tone: 'gray', Icon: CheckIcon },
  rejected: { tone: 'red', Icon: XCircleIcon },
}

// Verification status of a citizen report. Never implies verification from a photo alone.
export function StatusBadge({ status, short = false }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending
  const label = short ? { pending: 'Unverified', verified: 'Verified', resolved: 'Resolved', rejected: 'Rejected' }[status] : REPORT_STATUS_LABELS[status]
  return <Tag tone={s.tone} icon={<s.Icon className="h-3.5 w-3.5" />}>{label ?? status}</Tag>
}

// The four kinds of information the platform shows - always visually distinct.
export const KINDS = {
  citizen: { label: 'Citizen report', tone: 'amber', Icon: ClipboardIcon, help: 'Submitted by a member of the public. Not yet checked unless marked verified.' },
  verified: { label: 'Verified incident', tone: 'blue', Icon: CheckCircleIcon, help: 'A citizen report confirmed by a LandslideGuard administrator.' },
  model: { label: 'Model estimate', tone: 'gray', Icon: SparkIcon, help: 'Computed by the risk model for monitored towns in Northeast India. Not an official warning.' },
  official: { label: 'Official alert', tone: 'red', Icon: BellIcon, help: 'A warning issued by IMD, NDMA, an SDMA or a DDMA and relayed here with its source.' },
}

export function KindBadge({ kind, withHelp = false }) {
  const k = KINDS[kind]
  const badge = <Tag tone={k.tone} icon={<k.Icon className="h-3.5 w-3.5" />}>{k.label}</Tag>
  return withHelp ? <Tooltip content={k.help}><span tabIndex={0} className="rounded-md focus-visible:outline-2 focus-visible:outline-brand-500">{badge}</span></Tooltip> : badge
}

// ---------------------------------------------------------------- tooltips
// Shows on hover and keyboard focus; the content is linked with aria-describedby.
export function Tooltip({ content, children, side = 'top' }) {
  const id = useId()
  const pos = side === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'
  return (
    <span className="group/tip relative inline-flex">
      {cloneElement(children, { 'aria-describedby': id })}
      <span
        role="tooltip" id={id}
        className={`pointer-events-none absolute left-1/2 z-50 hidden w-max max-w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg bg-navy-900 px-2.5 py-1.5 text-xs font-normal leading-snug text-white shadow-(--shadow-pop) group-focus-within/tip:block group-hover/tip:block ${pos}`}
      >
        {content}
      </span>
    </span>
  )
}

export function InfoTip({ content, label = 'More information' }) {
  return (
    <Tooltip content={content}>
      <button type="button" aria-label={label} className="inline-grid h-5 w-5 place-items-center rounded-full text-ink-muted hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500">
        <InfoIcon className="h-4 w-4" />
      </button>
    </Tooltip>
  )
}

// ---------------------------------------------------------------- stats
export function StatCard({ label, value, hint, accent, icon, to, help, loading = false }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-ink-2">
          {accent ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} aria-hidden="true" /> : null}
          {label}
          {help ? <InfoTip content={help} label={`About ${label}`} /> : null}
        </div>
        {icon ? <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">{icon}</span> : null}
      </div>
      {loading ? <div className="skeleton mt-3 h-8 w-20" /> : <div className="mt-2 text-3xl font-bold tracking-tight text-ink">{value}</div>}
      {hint ? <div className="mt-1 text-sm text-ink-muted">{hint}</div> : null}
    </>
  )
  if (to) {
    return (
      <Link to={to} className="card block p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-(--shadow-pop) focus-visible:outline-2 focus-visible:outline-brand-500">
        {body}
      </Link>
    )
  }
  return <Card className="p-5">{body}</Card>
}

// ---------------------------------------------------------------- feedback
export function Spinner({ className = 'h-4 w-4' }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-hidden="true" />
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-3 p-6 text-ink-2" role="status">
      <Spinner className="h-5 w-5 text-brand-600" />
      {label}
    </div>
  )
}

export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <Card className="space-y-3 p-5" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} className={`h-3 ${i % 2 ? 'w-5/6' : 'w-full'}`} />)}
    </Card>
  )
}

export function ErrorBox({ error, onRetry, title = 'Something went wrong' }) {
  if (!error) return null
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900" role="alert">
      <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm">{error.message ?? String(error)}</p>
      </div>
      {onRetry ? <button type="button" onClick={onRetry} className="btn-secondary btn-sm">Try again</button> : null}
    </div>
  )
}

export function Notice({ tone = 'info', title, children }) {
  const styles = {
    info: 'border-blue-200 bg-blue-50/70 text-blue-950',
    warn: 'border-amber-300 bg-amber-50 text-amber-950',
    danger: 'border-red-200 bg-red-50 text-red-950',
    success: 'border-brand-200 bg-brand-50 text-brand-900',
  }
  const Icon = tone === 'success' ? CheckCircleIcon : tone === 'info' ? InfoIcon : AlertIcon
  return (
    <div className={`flex gap-3 rounded-2xl border p-4 text-sm ${styles[tone]}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
      </div>
    </div>
  )
}

export function EmptyState({ children, title, icon, action }) {
  if (!title && !icon && !action) return <p className="p-6 text-center text-sm text-ink-muted">{children}</p>
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon ? <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">{icon}</span> : null}
      {title ? <p className="font-semibold text-ink">{title}</p> : null}
      {children ? <p className="mt-1 max-w-sm text-sm text-ink-muted">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function Field({ label, htmlFor, hint, error, required, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
        {required ? <span className="text-red-600" aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-xs font-medium text-red-700" id={htmlFor ? `${htmlFor}-error` : undefined}>{error}</p> : null}
      {hint && !error ? <p className="mt-1.5 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  )
}

// ---------------------------------------------------------------- drawer
// Accessible slide-over panel: Esc closes, focus moves into the panel and returns afterwards.
export function Drawer({ open, onClose, title, children, footer, width = 'sm:max-w-xl' }) {
  const panel = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    requestAnimationFrame(() => panel.current?.focus())
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[1100] flex justify-end">
      <button type="button" aria-label="Close panel" className="absolute inset-0 bg-navy-900/40 backdrop-blur-[1px]" onClick={onClose} />
      <div
        ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Details'}
        className={`relative flex h-full w-full flex-col bg-white shadow-(--shadow-pop) outline-none ${width}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">{typeof title === 'string' ? <h2 className="text-lg font-semibold text-ink">{title}</h2> : title}</div>
          <button type="button" onClick={onClose} className="btn-ghost -mr-2 p-2" aria-label="Close">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="border-t border-line bg-plane/60 px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- stepper
export function Stepper({ steps, current, onStepClick, maxReached }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3" aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        const reachable = onStepClick && i <= maxReached && !active
        const circle = (
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold transition ${
            active ? 'bg-brand-600 text-white ring-4 ring-brand-100' : done ? 'bg-brand-100 text-brand-800' : 'bg-plane text-ink-muted ring-1 ring-line'
          }`}>
            {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
          </span>
        )
        return (
          <li key={s} className={`flex min-w-0 items-center gap-2 ${i < steps.length - 1 ? 'flex-1' : ''}`} aria-current={active ? 'step' : undefined}>
            {reachable ? (
              <button type="button" onClick={() => onStepClick(i)} className="flex min-w-0 items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-brand-500">
                {circle}
                <span className="hidden truncate text-sm font-medium text-ink-2 hover:text-brand-700 md:block">{s}</span>
              </button>
            ) : (
              <span className="flex min-w-0 items-center gap-2">
                {circle}
                <span className={`hidden truncate text-sm md:block ${active ? 'font-semibold text-ink' : 'text-ink-muted'}`}>{s}</span>
              </span>
            )}
            {i < steps.length - 1 ? <span className={`h-0.5 min-w-4 flex-1 rounded ${done ? 'bg-brand-300' : 'bg-line'}`} aria-hidden="true" /> : null}
          </li>
        )
      })}
    </ol>
  )
}
