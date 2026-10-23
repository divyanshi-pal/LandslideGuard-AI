import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, errorMessage, request } from './client'

afterEach(() => vi.unstubAllGlobals())

function mockFetch(status, body) {
  const fn = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }))
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('errorMessage', () => {
  it('flattens FastAPI validation errors', () => {
    const detail = [{ loc: ['body', 'slope_deg'], msg: 'Input should be less than or equal to 70' }]
    expect(errorMessage(detail, 'x')).toBe('slope_deg: Input should be less than or equal to 70')
  })
  it('passes through plain strings and falls back otherwise', () => {
    expect(errorMessage('Report not found', 'x')).toBe('Report not found')
    expect(errorMessage(null, 'fallback')).toBe('fallback')
  })
})

describe('request', () => {
  it('sends JSON and parses the response', async () => {
    const fetch = mockFetch(200, { heuristic: { score: 50 } })
    const data = await api.predict({ slope_deg: 30 })
    expect(data.heuristic.score).toBe(50)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/api/risk/predict')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('throws ApiError with the server detail', async () => {
    mockFetch(401, { detail: 'Invalid username or password' })
    await expect(request('/api/admin/login', { method: 'POST', json: {} })).rejects.toMatchObject({
      status: 401,
      message: 'Invalid username or password',
    })
  })

  it('reports an unreachable backend clearly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const err = await request('/api/health').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.message).toMatch(/Cannot reach/)
  })

  it('rejects an HTML page returned instead of JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => '<!doctype html><html></html>' })))
    const err = await request('/api/meta').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.message).toMatch(/expected JSON/)
  })

  it('returns null for 204 responses', async () => {
    mockFetch(204)
    expect(await request('/api/admin/reports/1', { method: 'DELETE' })).toBeNull()
  })
})
