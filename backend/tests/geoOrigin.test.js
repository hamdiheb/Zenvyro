import { jest } from '@jest/globals'
import {
  detectOriginForIpAddress,
  isPrivateOrLoopbackIpAddress,
  ORIGIN_STATUS,
} from '../src/services/geoOriginService.js'

// A real fetch Response, so response.ok and response.json() behave exactly as in production.
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const FRANCE_REST_COUNTRIES_ROW = {
  name: { common: 'France', official: 'French Republic' },
  region: 'Europe',
  flags: { png: 'https://flagcdn.test/fr.png', svg: 'https://flagcdn.test/fr.svg' },
  languages: { fra: 'French' },
  currencies: { EUR: { name: 'Euro', symbol: '€' } },
}

describe('isPrivateOrLoopbackIpAddress', () => {
  it('treats loopback, private, link-local and IPv4-mapped private addresses as not locatable', () => {
    for (const address of ['127.0.0.1', '10.1.2.3', '192.168.0.5', '172.20.1.1', '169.254.1.1', '::1', '::ffff:192.168.1.1', 'fd00::1', 'fe80::1']) {
      expect(isPrivateOrLoopbackIpAddress(address)).toBe(true)
    }
  })

  it('treats public addresses as locatable', () => {
    for (const address of ['8.8.8.8', '203.0.113.7', '::ffff:203.0.113.7', '2001:4860:4860::8888']) {
      expect(isPrivateOrLoopbackIpAddress(address)).toBe(false)
    }
  })
})

describe('detectOriginForIpAddress', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns private_address without any network call for a loopback visitor', async () => {
    const fetchFunction = jest.fn()
    const origin = await detectOriginForIpAddress('::ffff:127.0.0.1', { fetchFunction })
    expect(origin.status).toBe(ORIGIN_STATUS.privateAddress)
    expect(origin.countryCode).toBeNull()
    expect(fetchFunction).not.toHaveBeenCalled()
  })

  it('looks up the country and enriches it with REST Countries data', async () => {
    const fetchFunction = jest.fn(async (url) => {
      if (url.startsWith('https://geo-lookup.test/')) {
        return jsonResponse({ success: true, country_code: 'FR' })
      }
      return jsonResponse([FRANCE_REST_COUNTRIES_ROW])
    })

    const origin = await detectOriginForIpAddress('203.0.113.7', { fetchFunction })

    expect(fetchFunction.mock.calls[0][0]).toBe('https://geo-lookup.test/203.0.113.7')
    expect(fetchFunction.mock.calls[1][0]).toContain('https://rest-countries.test/v3.1/alpha/FR?fields=')
    expect(origin).toEqual({
      status: 'detected',
      countryCode: 'FR',
      countryName: 'France',
      region: 'Europe',
      flagImageUrl: 'https://flagcdn.test/fr.png',
      languages: ['French'],
      currencies: [{ code: 'EUR', name: 'Euro', symbol: '€' }],
      detectedAt: expect.any(Date),
    })
  })

  it('keeps the country code when REST Countries fails, instead of failing the whole lookup', async () => {
    const fetchFunction = jest.fn(async (url) => {
      if (url.startsWith('https://geo-lookup.test/')) {
        return jsonResponse({ success: true, country_code: 'DE' })
      }
      throw new Error('REST Countries is down')
    })

    const origin = await detectOriginForIpAddress('203.0.113.7', { fetchFunction })
    expect(origin.status).toBe('detected')
    expect(origin.countryCode).toBe('DE')
    expect(origin.countryName).toBeNull()
    expect(origin.languages).toEqual([])
  })

  it('returns unavailable when the lookup provider says it does not know the address', async () => {
    const fetchFunction = jest.fn(async () => jsonResponse({ success: false, message: 'Reserved range' }))
    const origin = await detectOriginForIpAddress('203.0.113.7', { fetchFunction })
    expect(origin.status).toBe('unavailable')
    expect(origin.countryCode).toBeNull()
  })

  it('returns unavailable instead of throwing when the lookup provider is unreachable', async () => {
    const fetchFunction = jest.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND geo-lookup.test')
    })
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const origin = await detectOriginForIpAddress('203.0.113.7', { fetchFunction })
    expect(origin.status).toBe('unavailable')
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('returns unavailable when the lookup provider answers with an error status', async () => {
    const fetchFunction = jest.fn(async () => jsonResponse({}, 503))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const origin = await detectOriginForIpAddress('203.0.113.7', { fetchFunction })
    expect(origin.status).toBe('unavailable')
  })
})
