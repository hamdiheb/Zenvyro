import { requestJson } from './apiClient.js'

const LABELS_BASE_PATH = '/api/labels'

export function listLabels() {
  return requestJson(LABELS_BASE_PATH)
}

export function createLabel({ name, colorHex }) {
  return requestJson(LABELS_BASE_PATH, { method: 'POST', body: { name, colorHex } })
}
