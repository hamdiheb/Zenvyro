import { requestJson } from './apiClient.js'

const AUTHENTICATION_BASE_PATH = '/api/authentication'

export function signUpBusinessOwner({ businessName, name, email, password }) {
  return requestJson(`${AUTHENTICATION_BASE_PATH}/sign-up`, {
    method: 'POST',
    body: { businessName, name, email, password },
  })
}

export function signInStaffUser({ email, password }) {
  return requestJson(`${AUTHENTICATION_BASE_PATH}/sign-in`, { method: 'POST', body: { email, password } })
}

export function fetchCurrentUser() {
  return requestJson(`${AUTHENTICATION_BASE_PATH}/me`)
}

export function signOutStaffUser() {
  return requestJson(`${AUTHENTICATION_BASE_PATH}/sign-out`, { method: 'POST' })
}
