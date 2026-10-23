// Thin wrapper around fetch for the LandslideGuard FastAPI backend.

export const API_BASE = (import.meta.env?.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const TOKEN_KEY = 'landslideguard.adminToken'
const MISSING_BASE_MESSAGE =
  'This website was built without VITE_API_BASE_URL, so it cannot reach the LandslideGuard API. ' +
  'Set it to the backend URL in the hosting settings and redeploy.'

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

export function assetUrl(path) {
  return path ? `${API_BASE}${path}` : null
}

export function errorMessage(detail, fallback) {
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        const field = Array.isArray(d.loc) ? d.loc.filter((p) => p !== 'body').join('.') : ''
        return field ? `${field}: ${d.msg}` : d.msg
      })
      .join('; ')
  }
  return fallback
}

export const tokenStore = {
  get() {
    try {
      return sessionStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token) {
    try {
      sessionStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* storage unavailable: token lives only in memory for this page */
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
  },
}

export async function request(path, { method = 'GET', json, form, auth = false, signal } = {}) {
  const headers = {}
  let body
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form) {
    body = form // browser sets the multipart boundary
  }
  if (auth) {
    const token = tokenStore.get()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let resp
  try {
    resp = await fetch(`${API_BASE}${path}`, { method, headers, body, signal })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError('Cannot reach the LandslideGuard API. Is the backend running on port 8000?', 0)
  }

  if (resp.status === 204) return null
  const text = await resp.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  // A production build without VITE_API_BASE_URL calls its own host, which has no API.
  const missingBase = !API_BASE && import.meta.env?.PROD
  if (!resp.ok) {
    const detail = data && typeof data === 'object' ? data.detail : data
    if (missingBase && resp.status === 404 && typeof data === 'string') {
      throw new ApiError(MISSING_BASE_MESSAGE, 404, detail)
    }
    throw new ApiError(errorMessage(detail, `Request failed (${resp.status})`), resp.status, detail)
  }
  if (typeof data === 'string') {
    // Every API endpoint returns JSON; HTML here means the request reached a website, not the API.
    throw new ApiError(missingBase ? MISSING_BASE_MESSAGE : 'Unexpected response from the API (expected JSON).', resp.status)
  }
  return data
}

const q = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
  const str = s.toString()
  return str ? `?${str}` : ''
}

export const api = {
  meta: (opts) => request('/api/meta', opts),
  dashboard: (opts) => request('/api/dashboard/summary', opts),
  locations: (state, opts) => request(`/api/locations${q({ state })}`, opts),
  location: (id, opts) => request(`/api/locations/${id}?history=60`, opts),
  predict: (inputs) => request('/api/risk/predict', { method: 'POST', json: inputs }),
  methodology: (opts) => request('/api/risk/methodology', opts),
  modelCard: (opts) => request('/api/risk/model', opts),
  alerts: (status = 'active', opts) => request(`/api/alerts${q({ status })}`, opts),
  publicReports: (opts) => request('/api/reports', opts),
  reports: (filters = {}, opts) => request(`/api/reports${q(filters)}`, opts),
  reportDetail: (id, opts) => request(`/api/reports/${id}`, opts),
  placeSearch: (query, opts) => request(`/api/geocode/search${q({ q: query })}`, opts),
  createReport: (formData) => request('/api/reports', { method: 'POST', form: formData }),
  riskContext: (lat, lon, opts) => request(`/api/risk/context${q({ lat, lon })}`, opts),
  geocodeReverse: (lat, lon, opts) => request(`/api/geocode/reverse${q({ lat, lon })}`, opts),

  admin: {
    login: (username, password) =>
      request('/api/admin/login', { method: 'POST', json: { username, password } }),
    me: () => request('/api/admin/me', { auth: true }),
    reports: (filters = {}, opts) => request(`/api/admin/reports${q(filters)}`, { auth: true, ...opts }),
    reportDetail: (id, opts) => request(`/api/admin/reports/${id}`, { auth: true, ...opts }),
    updateReport: (id, changes) =>
      request(`/api/admin/reports/${id}`, { method: 'PATCH', json: changes, auth: true }),
    deleteReport: (id) => request(`/api/admin/reports/${id}`, { method: 'DELETE', auth: true }),
    createAlert: (alert) => request('/api/admin/alerts', { method: 'POST', json: alert, auth: true }),
    updateAlert: (id, changes) =>
      request(`/api/admin/alerts/${id}`, { method: 'PATCH', json: changes, auth: true }),
    refresh: () => request('/api/admin/assessments/refresh', { method: 'POST', auth: true }),
  },
}
