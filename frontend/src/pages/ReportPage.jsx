import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api/client'
import {
  ArrowRightIcon,
  CameraIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronLeftIcon,
  EditIcon,
  LayersIcon,
  LocateIcon,
  MapPinIcon,
  PhoneIcon,
  TrashIcon,
  UploadIcon,
  VideoIcon,
} from '../components/Icons'
import { LocationPicker } from '../components/RiskMap'
import { Card, Field, Notice, PageHeader, RiskBadge, Spinner, StatusBadge, Stepper, Tag } from '../components/ui'
import { requestCurrentPosition } from '../lib/geolocation'
import { INDIA_STATES } from '../lib/india'
import {
  PHOTO_TYPES,
  VIDEO_TYPES,
  WIZARD_STEPS,
  buildReportFormData,
  describeSource,
  initialLocation,
  locationPoint,
  locationReducer,
  mergeSuggestion,
  newSubmissionId,
  toLocalInputValue,
  validateFile,
  validateReport,
  validateStep,
} from '../lib/reportForm'
import { REPORT_CATEGORIES, REPORT_CATEGORY_HINTS, SEVERITY_LABELS, formatDateTime } from '../lib/risk'
import { useAsync } from '../lib/useAsync'

const SEVERITIES = [
  { value: 'minor', hint: 'Small cracks, minor seepage' },
  { value: 'moderate', hint: 'Visible movement, partial blockage' },
  { value: 'severe', hint: 'Slide or flood happened; homes or roads affected' },
]

function emptyForm() {
  return {
    category: '', severity: '', description: '', observedAt: toLocalInputValue(),
    state: '', district: '', address: '', addressSource: null, landmark: '', name: '', contact: '',
  }
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

// ---------------------------------------------------------------- small pieces
function ChoiceCard({ name, value, checked, onChange, title, hint, invalid }) {
  return (
    <label
      className={`relative flex cursor-pointer flex-col rounded-xl border p-3 text-left transition focus-within:ring-4 focus-within:ring-brand-500/20 ${
        checked ? 'border-brand-500 bg-brand-50 shadow-sm' : invalid ? 'border-red-300 bg-white hover:border-brand-300' : 'border-line bg-white hover:border-brand-300'
      }`}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      <span className="flex items-start justify-between gap-2">
        <span className={`text-sm font-semibold ${checked ? 'text-brand-800' : 'text-ink'}`}>{title}</span>
        {checked ? <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-600" /> : null}
      </span>
      {hint ? <span className="mt-0.5 text-xs text-ink-muted">{hint}</span> : null}
    </label>
  )
}

function SourceBadge({ loc }) {
  const tone = { gps: 'green', map: 'blue', manual: 'amber' }[loc.source] ?? 'gray'
  return <Tag tone={tone}>{describeSource(loc)}</Tag>
}

function RiskContextPanel({ ctx }) {
  if (!ctx) return null
  if (ctx.status === 'nearby_monitored') {
    return (
      <Notice tone="info" title="Nearest monitored town (model estimate)">
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <RiskBadge level={ctx.level} score={ctx.score} /> {ctx.location.name}, {ctx.location.state} · {ctx.distance_km} km away
        </span>
        <span className="mt-1 block">{ctx.message}</span>
      </Notice>
    )
  }
  if (ctx.status === 'unavailable') return <Notice tone="info" title="Risk assessment unavailable for this location">{ctx.message}</Notice>
  return null
}

function DropZone({ id, kind, accept, file, previewUrl, limitMb, onFile, onClear, inputRef }) {
  const [dragging, setDragging] = useState(false)
  const Icon = kind === 'video' ? VideoIcon : CameraIcon
  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) onFile(dropped)
  }
  if (file) {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {kind === 'photo' && previewUrl ? <img src={previewUrl} alt="Selected photo preview" className="max-h-72 w-full bg-plane object-contain" /> : null}
        {kind === 'video' && previewUrl ? <video src={previewUrl} controls className="max-h-72 w-full bg-black" aria-label="Selected video preview" /> : null}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{file.name}</p>
            <p className="text-xs text-ink-muted">{mb(file.size)}</p>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={onClear}><TrashIcon className="h-4 w-4" /> Remove</button>
        </div>
      </div>
    )
  }
  return (
    <label
      htmlFor={id}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition focus-within:ring-4 focus-within:ring-brand-500/20 ${
        dragging ? 'border-brand-500 bg-brand-50' : 'border-line bg-plane/60 hover:border-brand-300 hover:bg-brand-50/50'
      }`}
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-brand-700 shadow-sm"><Icon className="h-6 w-6" /></span>
      <span className="mt-3 text-sm font-semibold text-ink">
        <span className="text-brand-700 underline">Choose a {kind}</span> or drag it here
      </span>
      <span className="mt-1 text-xs text-ink-muted">
        {kind === 'video' ? `MP4, MOV, WebM or 3GP · up to ${limitMb} MB · seen only by administrators` : `JPEG, PNG or WebP · up to ${limitMb} MB · location data inside is removed`}
      </span>
      <input
        ref={inputRef} id={id} type="file" className="sr-only"
        accept={Object.keys(kind === 'video' ? VIDEO_TYPES : PHOTO_TYPES).join(',')}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </label>
  )
}

function ReviewRow({ label, children }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 py-2 text-sm sm:grid-cols-[10rem_1fr]">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  )
}

function ReviewSection({ title, onEdit, children }) {
  return (
    <section className="rounded-2xl border border-line p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="font-semibold text-ink">{title}</h3>
        <button type="button" className="btn-ghost btn-sm" onClick={onEdit}><EditIcon className="h-4 w-4" /> Edit</button>
      </div>
      <dl className="divide-y divide-line">{children}</dl>
    </section>
  )
}

function SuccessScreen({ result, onAnother }) {
  const ref = useRef(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <Card className="mx-auto max-w-2xl p-6 text-center sm:p-10">
      <div ref={ref} tabIndex={-1} role="status" className="outline-none">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-100 text-brand-700"><CheckCircleIcon className="h-9 w-9" /></span>
        <h1 className="mt-5 text-2xl font-bold text-ink sm:text-3xl">
          {result.duplicate ? `We already have this report` : 'Report received - thank you'}
        </h1>
        <p className="mt-2 text-ink-2">
          {result.duplicate
            ? 'It looks like this report was submitted already, so no duplicate was created.'
            : 'An administrator will review it. Until then it is an unverified citizen report and is not shown publicly.'}
        </p>
        <div className="mx-auto mt-6 inline-flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-plane px-4 py-3">
          <span className="text-sm text-ink-2">Reference</span>
          <span className="text-lg font-bold text-ink">#{result.id}</span>
          <StatusBadge status={result.status} />
        </div>
        <ul className="mx-auto mt-6 max-w-md space-y-2 text-left text-sm text-ink-2">
          {result.has_photo ? <li className="flex gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> Your photo was stored with its location metadata removed.</li> : null}
          {result.has_video ? <li className="flex gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> Your video is visible only to administrators.</li> : null}
          <li className="flex gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> Use the reference number or the button below to follow its status.</li>
        </ul>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to={`/reports/${result.id}`} className="btn-primary">Track this report <ArrowRightIcon className="h-4 w-4" /></Link>
          <button type="button" className="btn-secondary" onClick={onAnother}>Report another incident</button>
          <Link to="/incidents" className="btn-ghost"><LayersIcon className="h-4 w-4" /> Incident map</Link>
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- page
export default function ReportPage() {
  const meta = useAsync((o) => api.meta(o))
  const reporting = meta.data?.reporting
  const limits = { photoMb: reporting?.max_photo_mb ?? meta.data?.max_upload_mb ?? 5, videoMb: reporting?.max_video_mb ?? 25 }
  const videoEnabled = reporting?.video_enabled ?? false
  const geocodingEnabled = Boolean(reporting?.geocoding?.enabled)

  const [step, setStep] = useState(0)
  const [maxReached, setMaxReached] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const [loc, dispatch] = useReducer(locationReducer, initialLocation)
  const [photo, setPhoto] = useState(null)
  const [video, setVideo] = useState(null)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [submissionId, setSubmissionId] = useState(newSubmissionId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null) // { field?, message }
  const [result, setResult] = useState(null)
  const [ctx, setCtx] = useState(null)
  const [lookup, setLookup] = useState(null)
  const suggestionRef = useRef(null)
  const lookupSeq = useRef(0)
  const errorRef = useRef(null)
  const headingRef = useRef(null)
  const photoInput = useRef(null)
  const videoInput = useRef(null)

  const point = locationPoint(loc)
  const lat = point?.[0]
  const lon = point?.[1]
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const fieldError = (name) => (error?.field === name ? error.message : null)

  useEffect(() => {
    if (!photo) return setPhotoUrl(null)
    const url = URL.createObjectURL(photo)
    setPhotoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])
  useEffect(() => {
    if (!video) return setVideoUrl(null)
    const url = URL.createObjectURL(video)
    setVideoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [video])

  // Risk context and optional address lookup whenever the point changes (debounced).
  useEffect(() => {
    setCtx(null)
    setLookup(null)
    if (lat === undefined) return undefined
    const seq = ++lookupSeq.current
    const timer = setTimeout(async () => {
      api.riskContext(lat, lon).then((c) => seq === lookupSeq.current && setCtx(c)).catch(() => {})
      if (!geocodingEnabled) return
      setLookup({ status: 'loading' })
      try {
        const g = await api.geocodeReverse(lat, lon)
        if (seq !== lookupSeq.current) return
        setLookup(g)
        if (g.status === 'ok') {
          setForm((f) => mergeSuggestion(f, suggestionRef.current, g))
          suggestionRef.current = { state: g.state, district: g.district, address: g.address }
        }
      } catch (err) {
        if (seq === lookupSeq.current) setLookup({ status: 'error', message: err.message })
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [lat, lon, geocodingEnabled])

  const pickOnMap = useCallback((pickLat, pickLon) => dispatch({ type: 'map_pick', lat: pickLat, lon: pickLon }), [])

  async function locateMe() {
    dispatch({ type: 'gps_start' })
    try {
      dispatch({ type: 'gps_success', ...(await requestCurrentPosition()) })
      if (error?.field === 'location') setError(null)
    } catch (err) {
      dispatch({ type: 'gps_error', code: err.code, message: err.message })
    }
  }

  function chooseFile(kind, file) {
    const input = kind === 'video' ? videoInput.current : photoInput.current
    const problem = validateFile(file, kind, limits)
    if (problem) {
      setError({ field: kind, message: problem })
      if (input) input.value = ''
      return
    }
    if (error?.field === kind) setError(null)
    ;(kind === 'video' ? setVideo : setPhoto)(file)
  }

  function clearFile(kind) {
    ;(kind === 'video' ? setVideo : setPhoto)(null)
    const input = kind === 'video' ? videoInput.current : photoInput.current
    if (input) input.value = ''
  }

  function goTo(target) {
    setError(null)
    setStep(target)
    setMaxReached((m) => Math.max(m, target))
    requestAnimationFrame(() => {
      headingRef.current?.focus()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  function showError(problem) {
    setError(problem)
    requestAnimationFrame(() => errorRef.current?.focus())
  }

  function next() {
    const problem = validateStep(step, form, loc)
    if (problem) return showError(problem)
    goTo(step + 1)
  }

  async function submit() {
    if (submitting) return
    const problem = validateReport(form, loc) ?? validateStep(0, form, loc)
    if (problem) {
      goTo(problem.field === 'location' ? 1 : 0)
      requestAnimationFrame(() => setError(problem))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const created = await api.createReport(buildReportFormData({ form, loc, photo, video, submissionId }))
      setResult(created)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      // Keep the same submission id: retrying cannot create a duplicate.
      showError({ message: err.status === 0 ? `${err.message} Your report was not lost - press Submit again to retry.` : err.message })
    } finally {
      setSubmitting(false)
    }
  }

  function startAnother() {
    setResult(null)
    setForm(emptyForm())
    dispatch({ type: 'reset' })
    clearFile('photo')
    clearFile('video')
    suggestionRef.current = null
    setSubmissionId(newSubmissionId()) // the next report gets a new idempotency key
    setStep(0)
    setMaxReached(0)
  }

  if (result) return <SuccessScreen result={result} onAnother={startAnother} />

  const gps = loc.gps
  const place = [form.district, form.state].filter(Boolean).join(', ')

  return (
    <>
      <PageHeader
        eyebrow="Citizen report · anywhere in India"
        title="Report an incident"
        subtitle="Landslides, floods, blocked roads, ground cracks or soil movement. An administrator reviews every report before it is shown publicly."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <Stepper steps={WIZARD_STEPS} current={step} maxReached={maxReached} onStepClick={goTo} />
            <p className="mt-3 text-xs font-medium text-ink-muted md:hidden">Step {step + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[step]}</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); step < 3 ? next() : submit() }} noValidate aria-busy={submitting} className="px-5 py-6 sm:px-6">
            <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-ink outline-none">{WIZARD_STEPS[step]}</h2>

            {/* ------------------------------------------------ step 1: details */}
            {step === 0 ? (
              <div className="mt-5 space-y-6">
                <fieldset>
                  <legend className="label">What happened? <span className="text-red-600" aria-hidden="true">*</span></legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {Object.entries(REPORT_CATEGORIES).map(([value, label]) => (
                      <ChoiceCard key={value} name="category" value={value} title={label} hint={REPORT_CATEGORY_HINTS[value]}
                        checked={form.category === value} onChange={set('category')} invalid={error?.field === 'category'} />
                    ))}
                  </div>
                  {fieldError('category') ? <p className="mt-1.5 text-xs font-medium text-red-700">{fieldError('category')}</p> : null}
                </fieldset>
                <fieldset>
                  <legend className="label">How serious is it? <span className="text-red-600" aria-hidden="true">*</span></legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {SEVERITIES.map((s) => (
                      <ChoiceCard key={s.value} name="severity" value={s.value} title={SEVERITY_LABELS[s.value]} hint={s.hint}
                        checked={form.severity === s.value} onChange={set('severity')} invalid={error?.field === 'severity'} />
                    ))}
                  </div>
                  {fieldError('severity') ? <p className="mt-1.5 text-xs font-medium text-red-700">{fieldError('severity')}</p> : null}
                </fieldset>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="When did it happen?" htmlFor="observedAt" required hint="Your local time." error={fieldError('observedAt')}>
                    <input id="observedAt" type="datetime-local" className="input" value={form.observedAt} max={toLocalInputValue()}
                      onChange={set('observedAt')} aria-invalid={error?.field === 'observedAt'} required />
                  </Field>
                </div>
                <Field label="Description" htmlFor="description" required error={fieldError('description')}
                  hint={`What did you see, and exactly where? ${form.description.trim().length}/2000 characters (at least 10).`}>
                  <textarea id="description" rows={5} className="input" value={form.description} onChange={set('description')} maxLength={2000}
                    placeholder="e.g. Fresh cracks have opened across the road above the school since last night's rain."
                    aria-invalid={error?.field === 'description'} required minLength={10} />
                </Field>
              </div>
            ) : null}

            {/* ------------------------------------------------ step 2: location */}
            {step === 1 ? (
              <div className="mt-5 space-y-5">
                <div className="flex flex-col gap-3 rounded-2xl bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-brand-900">Are you at the incident site?</p>
                    <p className="text-sm text-brand-900/80">Use your device's location. Otherwise tap the map or type the coordinates.</p>
                  </div>
                  <button type="button" className="btn-primary shrink-0" onClick={locateMe} disabled={gps.status === 'locating'}>
                    {gps.status === 'locating' ? <Spinner /> : <LocateIcon className="h-4 w-4" />}
                    {gps.status === 'locating' ? 'Getting location…' : 'Use My Location'}
                  </button>
                </div>
                <div aria-live="polite" className="text-sm">
                  {gps.status === 'locating' ? <p className="text-ink-2">Waiting for your device. Your browser may ask for permission - choose Allow.</p> : null}
                  {gps.status === 'error' ? <Notice tone="warn" title="Location not available">{gps.error}</Notice> : null}
                </div>

                <LocationPicker value={point} accuracy={loc.accuracy} source={loc.source} onPick={pickOnMap} className="h-72 sm:h-96" />

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Latitude" htmlFor="lat">
                    <input id="lat" className="input tabular" inputMode="decimal" autoComplete="off" placeholder="e.g. 31.1048" value={loc.lat}
                      onChange={(e) => dispatch({ type: 'manual_edit', field: 'lat', value: e.target.value })}
                      aria-invalid={error?.field === 'location'} aria-describedby="loc-source" />
                  </Field>
                  <Field label="Longitude" htmlFor="lon">
                    <input id="lon" className="input tabular" inputMode="decimal" autoComplete="off" placeholder="e.g. 77.1734" value={loc.lon}
                      onChange={(e) => dispatch({ type: 'manual_edit', field: 'lon', value: e.target.value })}
                      aria-invalid={error?.field === 'location'} aria-describedby="loc-source" />
                  </Field>
                </div>
                <div id="loc-source" className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-plane/60 px-3 py-2.5 text-sm">
                  <MapPinIcon className="h-4 w-4 text-ink-muted" />
                  <span className="text-ink-2">Location source:</span> <SourceBadge loc={loc} />
                  {point ? <span className="tabular text-ink">{point[0]}, {point[1]}</span> : null}
                </div>

                {geocodingEnabled && lookup ? (
                  <div className="text-sm" aria-live="polite">
                    {lookup.status === 'loading' ? <p className="flex items-center gap-2 text-ink-2"><Spinner className="h-3.5 w-3.5" /> Looking up the address…</p> : null}
                    {lookup.status === 'ok' ? (
                      <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2.5 text-blue-950">
                        <p><strong>Address found:</strong> {lookup.address}</p>
                        {lookup.in_india === false ? <p className="mt-1 font-semibold text-red-800">The lookup places this point outside India.</p> : null}
                        <p className="mt-1 text-xs text-blue-900/70">Suggested by OpenStreetMap - please check the fields below. {lookup.attribution}</p>
                      </div>
                    ) : null}
                    {lookup.status === 'not_found' ? <p className="text-ink-2">No address found for this point - please type the details below.</p> : null}
                    {lookup.status === 'error' ? <p className="text-ink-2">{lookup.message ?? 'Address lookup failed.'} Please type the details below.</p> : null}
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="State / union territory" htmlFor="state">
                    <select id="state" className="input" value={form.state} onChange={set('state')}>
                      <option value="">Not sure / choose…</option>
                      {INDIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="District" htmlFor="district">
                    <input id="district" className="input" value={form.district} onChange={set('district')} maxLength={120} autoComplete="address-level2" />
                  </Field>
                </div>
                <Field label="Address or directions (optional)" htmlFor="address" hint="Visible only to administrators.">
                  <textarea id="address" rows={2} className="input" value={form.address} maxLength={300}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value, addressSource: 'user' }))} />
                </Field>
                <Field label="Nearby landmark (optional)" htmlFor="landmark" hint="Shown publicly once verified, e.g. NH-5 near Km 32, above the bridge.">
                  <input id="landmark" className="input" value={form.landmark} onChange={set('landmark')} maxLength={200} />
                </Field>
                <RiskContextPanel ctx={ctx} />
              </div>
            ) : null}

            {/* ------------------------------------------------ step 3: media */}
            {step === 2 ? (
              <div className="mt-5 space-y-6">
                <p className="text-sm text-ink-2">Photos and videos help administrators verify a report faster. Both are optional.</p>
                <div>
                  <p className="label">Photo</p>
                  <DropZone id="photo" kind="photo" file={photo} previewUrl={photoUrl} limitMb={limits.photoMb} inputRef={photoInput}
                    onFile={(f) => chooseFile('photo', f)} onClear={() => clearFile('photo')} />
                  {fieldError('photo') ? <p className="mt-1.5 text-xs font-medium text-red-700">{fieldError('photo')}</p> : null}
                </div>
                {videoEnabled ? (
                  <div>
                    <p className="label">Video</p>
                    <DropZone id="video" kind="video" file={video} previewUrl={videoUrl} limitMb={limits.videoMb} inputRef={videoInput}
                      onFile={(f) => chooseFile('video', f)} onClear={() => clearFile('video')} />
                    {fieldError('video') ? <p className="mt-1.5 text-xs font-medium text-red-700">{fieldError('video')}</p> : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* ------------------------------------------------ step 4: review */}
            {step === 3 ? (
              <div className="mt-5 space-y-4">
                <ReviewSection title="Incident details" onEdit={() => goTo(0)}>
                  <ReviewRow label="Type">{REPORT_CATEGORIES[form.category]}</ReviewRow>
                  <ReviewRow label="Severity">{SEVERITY_LABELS[form.severity]}</ReviewRow>
                  <ReviewRow label="Happened">{formatDateTime(new Date(form.observedAt).toISOString())}</ReviewRow>
                  <ReviewRow label="Description"><span className="whitespace-pre-line">{form.description.trim()}</span></ReviewRow>
                </ReviewSection>
                <ReviewSection title="Location" onEdit={() => goTo(1)}>
                  <ReviewRow label="Coordinates"><span className="tabular">{point ? `${point[0]}, ${point[1]}` : '-'}</span></ReviewRow>
                  <ReviewRow label="Source"><SourceBadge loc={loc} /></ReviewRow>
                  <ReviewRow label="State / district">{place || <span className="text-ink-muted">Not given</span>}</ReviewRow>
                  {form.address ? <ReviewRow label="Address">{form.address}</ReviewRow> : null}
                  {form.landmark ? <ReviewRow label="Landmark">{form.landmark}</ReviewRow> : null}
                </ReviewSection>
                <ReviewSection title="Photo & video" onEdit={() => goTo(2)}>
                  <ReviewRow label="Photo">{photo ? `${photo.name} (${mb(photo.size)})` : <span className="text-ink-muted">None</span>}</ReviewRow>
                  {videoEnabled ? <ReviewRow label="Video">{video ? `${video.name} (${mb(video.size)})` : <span className="text-ink-muted">None</span>}</ReviewRow> : null}
                </ReviewSection>
                <section className="rounded-2xl border border-line p-4">
                  <h3 className="font-semibold text-ink">Your details <span className="font-normal text-ink-muted">(optional)</span></h3>
                  <p className="mt-0.5 text-xs text-ink-muted">Only administrators can see these, in case they need to ask you something.</p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field label="Your name" htmlFor="name">
                      <input id="name" className="input" value={form.name} onChange={set('name')} maxLength={120} autoComplete="name" />
                    </Field>
                    <Field label="Phone or email" htmlFor="contact">
                      <input id="contact" className="input" value={form.contact} onChange={set('contact')} maxLength={120} autoComplete="tel" />
                    </Field>
                  </div>
                </section>
              </div>
            ) : null}

            {error && !['category', 'severity', 'observedAt', 'description', 'photo', 'video'].includes(error.field) ? (
              <div ref={errorRef} tabIndex={-1} role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-900 outline-none">
                {error.message}
              </div>
            ) : error ? (
              <p ref={errorRef} tabIndex={-1} role="alert" className="sr-only">{error.message}</p>
            ) : null}

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              {step > 0 ? (
                <button type="button" className="btn-secondary" onClick={() => goTo(step - 1)} disabled={submitting}>
                  <ChevronLeftIcon className="h-4 w-4" /> Back
                </button>
              ) : <span className="hidden sm:block" />}
              {step < 3 ? (
                <button type="submit" className="btn-primary">
                  {step === 2 && !photo && !video ? 'Skip - continue to review' : 'Continue'} <ArrowRightIcon className="h-4 w-4" />
                </button>
              ) : (
                <button type="submit" className="btn-primary px-6 py-3 text-base" disabled={submitting}>
                  {submitting ? <><Spinner /> {photo || video ? 'Uploading and submitting…' : 'Submitting…'}</> : <><UploadIcon className="h-5 w-5" /> Submit report</>}
                </button>
              )}
            </div>
          </form>
        </Card>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-950">
            <p className="flex items-center gap-2 font-semibold"><PhoneIcon className="h-4 w-4" /> If anyone is in danger, call 112 first.</p>
            <p className="mt-1">This form is not monitored around the clock and does not dispatch emergency services.</p>
          </div>
          <Card className="p-5">
            <h2 className="font-semibold text-ink">Your privacy</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-ink-2">
              {[
                'Photos are re-encoded on the server, which removes GPS position and camera details.',
                'Photos become public only after an administrator verifies the report. Videos are never public.',
                'Your name, contact details and address are visible only to administrators.',
                'Your location is used only for this report. We never guess or invent a GPS position.',
              ].map((t) => (
                <li key={t} className="flex gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />{t}</li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold text-ink">What happens next</h2>
            <ol className="mt-3 space-y-3 text-sm text-ink-2">
              <li><StatusBadge status="pending" /><p className="mt-1">Your report is received and waits for review.</p></li>
              <li><StatusBadge status="verified" /><p className="mt-1">An administrator confirms it; it appears on the public incident map.</p></li>
              <li><StatusBadge status="resolved" /><p className="mt-1">The situation has been dealt with.</p></li>
            </ol>
            <p className="mt-4 text-xs text-ink-muted">A photo alone never verifies a report.</p>
          </Card>
        </aside>
      </div>
    </>
  )
}
