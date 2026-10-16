import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../lib/auth'
import {
  BellIcon,
  BookIcon,
  ChevronDownIcon,
  ClipboardIcon,
  CloseIcon,
  GridIcon,
  HomeIcon,
  LayersIcon,
  LogoMark,
  LogoutIcon,
  MenuIcon,
  MountainIcon,
  PhoneIcon,
  ShieldIcon,
  SparkIcon,
  UserIcon,
} from './Icons'

export const NAV = [
  { to: '/', label: 'Home', end: true, icon: HomeIcon, mobileOnly: true },
  { to: '/dashboard', label: 'Dashboard', icon: GridIcon },
  { to: '/incidents', label: 'Incident Map', icon: LayersIcon },
  { to: '/map', label: 'Risk Monitor', icon: MountainIcon, hint: 'Model estimates · Northeast India' },
  { to: '/alerts', label: 'Alerts', icon: BellIcon },
  { to: '/assess', label: 'Assess Risk', icon: SparkIcon },
  { to: '/methodology', label: 'Methodology', icon: BookIcon },
]

const FULL_BLEED = new Set(['/', '/map', '/incidents'])

function desktopLink({ isActive }) {
  return `relative rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'text-brand-700 after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:rounded after:bg-brand-600' : 'text-ink-2 hover:bg-brand-50 hover:text-brand-800'
  }`
}

function mobileLink({ isActive }) {
  return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
    isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-2 hover:bg-plane'
  }`
}

function ProfileMenu() {
  const { user, isAdmin, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!isAdmin) {
    return (
      <Link to="/admin" className="btn-ghost btn-sm hidden sm:inline-flex" title="Administrator sign in">
        <UserIcon className="h-4 w-4" /> Admin sign in
      </Link>
    )
  }

  const item = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink-2 hover:bg-brand-50 hover:text-brand-800 focus-visible:bg-brand-50 focus-visible:outline-none'
  return (
    <div ref={ref} className="relative">
      <button
        type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full border border-line bg-white py-1 pl-1 pr-2 shadow-sm hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white" aria-hidden="true">
          {user.slice(0, 1).toUpperCase()}
        </span>
        <span className="sr-only">Account menu for {user}</span>
        <ChevronDownIcon className="h-4 w-4 text-ink-muted" />
      </button>
      {open ? (
        <div role="menu" className="card absolute right-0 z-50 mt-2 w-60 p-1.5">
          <div className="px-3 py-2">
            <p className="text-xs text-ink-muted">Signed in as</p>
            <p className="font-semibold text-ink">{user}</p>
            <p className="text-xs text-brand-700">Administrator</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link role="menuitem" to="/admin" className={item} onClick={() => setOpen(false)}>
            <ShieldIcon className="h-4 w-4" /> Admin console
          </Link>
          <Link role="menuitem" to="/admin?tab=reports&status=pending" className={item} onClick={() => setOpen(false)}>
            <ClipboardIcon className="h-4 w-4" /> Reports awaiting review
          </Link>
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); logout(); navigate('/') }}>
            <LogoutIcon className="h-4 w-4" /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { isAdmin, user, logout } = useAuth()
  const fullBleed = FULL_BLEED.has(location.pathname)

  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[2000] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow">
        Skip to content
      </a>
      <header className="sticky top-0 z-[1000] border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-brand-500">
            <LogoMark className="h-9 w-9" />
            <span className="leading-tight">
              <span className="block text-[17px] font-bold tracking-tight text-ink">LandslideGuard <span className="text-brand-600">AI</span></span>
              <span className="hidden text-[11px] font-medium text-ink-muted sm:block">Report · Monitor · Stay safer</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Main">
            {NAV.filter((n) => !n.mobileOnly).map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={desktopLink} title={n.hint}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/report" className="btn-primary btn-sm hidden sm:inline-flex sm:px-4 sm:py-2 sm:text-sm">
              <ClipboardIcon className="h-4 w-4" /> Report an Incident
            </Link>
            <ProfileMenu />
            <button
              type="button" className="btn-ghost p-2 xl:hidden" onClick={() => setOpen((o) => !o)}
              aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'}
            >
              {open ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
        {open ? (
          <nav id="mobile-nav" className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-line bg-white px-4 pb-4 pt-2 xl:hidden" aria-label="Mobile">
            <div className="grid gap-1 sm:grid-cols-2">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={mobileLink}>
                  <n.icon className="h-5 w-5" />
                  <span>
                    {n.label}
                    {n.hint ? <span className="block text-xs font-normal text-ink-muted">{n.hint}</span> : null}
                  </span>
                </NavLink>
              ))}
            </div>
            <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
              <Link to="/report" className="btn-primary">
                <ClipboardIcon className="h-4 w-4" /> Report an Incident
              </Link>
              {isAdmin ? (
                <>
                  <Link to="/admin" className="btn-secondary"><ShieldIcon className="h-4 w-4" /> Admin console ({user})</Link>
                  <button type="button" className="btn-ghost" onClick={logout}><LogoutIcon className="h-4 w-4" /> Sign out</button>
                </>
              ) : (
                <Link to="/admin" className="btn-secondary"><UserIcon className="h-4 w-4" /> Admin sign in</Link>
              )}
            </div>
          </nav>
        ) : null}
      </header>

      <main id="main" className={fullBleed ? 'flex-1' : 'mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-10'}>
        <Outlet />
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <LogoMark className="h-8 w-8" />
              <span className="font-bold text-ink">LandslideGuard <span className="text-brand-600">AI</span></span>
            </Link>
            <p className="mt-3 max-w-md text-sm text-ink-2">
              Citizen incident reporting for all of India and landslide risk monitoring for Northeast India.
              A prototype decision-support tool - <strong className="text-ink">not an official warning service</strong>.
            </p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
              <PhoneIcon className="h-4 w-4" /> In an emergency call 112
            </p>
          </div>
          <div>
            <p className="eyebrow mb-3">Platform</p>
            <ul className="space-y-2 text-sm">
              {[...NAV.filter((n) => !n.mobileOnly), { to: '/report', label: 'Report an Incident' }].map((n) => (
                <li key={n.to}><Link to={n.to} className="text-ink-2 hover:text-brand-700">{n.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-3">Official sources</p>
            <p className="text-sm text-ink-2">
              Always follow advisories from IMD, GSI, NDMA and your State / District Disaster Management Authority.
            </p>
            <p className="mt-4 text-xs text-ink-muted">Map data &copy; OpenStreetMap contributors.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
