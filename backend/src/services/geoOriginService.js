// Works out where a website visitor is, from their IP address. Every failure becomes a status, never an error,
// so starting a chat never fails because the geo lookup is down.
import { environmentConfig } from '../config/environmentConfig.js'

export const ORIGIN_STATUS = Object.freeze({
  notAttempted: 'not_attempted',
  detected: 'detected',
  unavailable: 'unavailable',
  privateAddress: 'private_address',
})

const GEO_LOOKUP_TIMEOUT_MILLISECONDS = 3000
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/
const REST_COUNTRIES_FIELDS = 'name,flags,region,languages,currencies'

const IPV4_PRIVATE_RANGE_PATTERNS = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
]

// True for loopback, private, link-local and unspecified addresses. Those cannot be located.
export function isPrivateOrLoopbackIpAddress(ipAddress) {
  if (!ipAddress) {
    return true
  }
  // An IPv4 address seen through an IPv6 socket looks like ::ffff:203.0.113.7.
  const ipv4Address = ipAddress.replace(/^::ffff:/i, '')
  if (ipv4Address.includes('.')) {
    return IPV4_PRIVATE_RANGE_PATTERNS.some((pattern) => pattern.test(ipv4Address))
  }
  const lowerCaseIpv6 = ipv4Address.toLowerCase()
  return lowerCaseIpv6 === '::1' || lowerCaseIpv6 === '::' || /^f[cd]/.test(lowerCaseIpv6) || /^fe[89ab]/.test(lowerCaseIpv6)
}

function buildOrigin(overrides) {
  return {
    status: ORIGIN_STATUS.unavailable,
    countryCode: null,
    countryName: null,
    region: null,
    flagImageUrl: null,
    languages: [],
    currencies: [],
    detectedAt: new Date(),
    ...overrides,
  }
}

// Returns the two-letter country code for a public IP, or null when the provider does not know it.
async function lookupCountryCodeForIpAddress(ipAddress, fetchFunction) {
  const response = await fetchFunction(
    `${environmentConfig.geoIpLookupBaseUrl}/${encodeURIComponent(ipAddress)}`,
    { signal: AbortSignal.timeout(GEO_LOOKUP_TIMEOUT_MILLISECONDS) },
  )
  if (!response.ok) {
    throw new Error(`Geo lookup responded with ${response.status}`)
  }
  const lookupBody = await response.json()
  const countryCode = typeof lookupBody.country_code === 'string' ? lookupBody.country_code.toUpperCase() : ''
  if (lookupBody.success === false || !COUNTRY_CODE_PATTERN.test(countryCode)) {
    return null
  }
  return countryCode
}

// Enriches a country code with REST Countries data. Returns null when that call fails, so the
// country code can still be stored on its own.
async function fetchCountryDetails(countryCode, fetchFunction) {
  try {
    const response = await fetchFunction(
      `${environmentConfig.restCountriesBaseUrl}/alpha/${countryCode}?fields=${REST_COUNTRIES_FIELDS}`,
      { signal: AbortSignal.timeout(GEO_LOOKUP_TIMEOUT_MILLISECONDS) },
    )
    if (!response.ok) {
      return null
    }
    const countryRows = await response.json()
    return Array.isArray(countryRows) && countryRows.length > 0 ? countryRows[0] : null
  } catch {
    return null
  }
}

function toLanguageNames(languagesObject) {
  return Object.values(languagesObject ?? {}).filter((name) => typeof name === 'string')
}

function toCurrencies(currenciesObject) {
  return Object.entries(currenciesObject ?? {}).map(([code, details]) => ({
    code,
    name: details?.name ?? null,
    symbol: details?.symbol ?? null,
  }))
}

// Detects the visitor's origin from an IP address. Shape is always the same, and the status says how far it got.
export async function detectOriginForIpAddress(rawIpAddress, { fetchFunction = fetch } = {}) {
  const ipAddress = (rawIpAddress ?? '').replace(/^::ffff:/i, '')
  if (isPrivateOrLoopbackIpAddress(ipAddress)) {
    return buildOrigin({ status: ORIGIN_STATUS.privateAddress })
  }

  try {
    const countryCode = await lookupCountryCodeForIpAddress(ipAddress, fetchFunction)
    if (!countryCode) {
      return buildOrigin({ status: ORIGIN_STATUS.unavailable })
    }

    const countryDetails = await fetchCountryDetails(countryCode, fetchFunction)
    return buildOrigin({
      status: ORIGIN_STATUS.detected,
      countryCode,
      countryName: countryDetails?.name?.common ?? null,
      region: countryDetails?.region ?? null,
      flagImageUrl: countryDetails?.flags?.png ?? null,
      languages: toLanguageNames(countryDetails?.languages),
      currencies: toCurrencies(countryDetails?.currencies),
    })
  } catch (error) {
    console.error('Geo origin lookup failed:', error.message)
    return buildOrigin({ status: ORIGIN_STATUS.unavailable })
  }
}
