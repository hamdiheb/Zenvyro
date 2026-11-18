import { requestJson } from './apiClient.js'

// Widget requests never send the staff cookie. The visitor proves who they are with the
// widget session token in the Authorization header.
const WIDGET_BASE_PATH = '/api/widget'

function buildWidgetAuthorizationHeaders(widgetSessionToken) {
  return { Authorization: `Bearer ${widgetSessionToken}` }
}

export function startWidgetSession({ widgetKey, name, email }) {
  return requestJson(`${WIDGET_BASE_PATH}/sessions`, {
    method: 'POST',
    credentials: 'omit',
    body: { widgetKey, name, email },
  })
}

export function getWidgetSession(widgetSessionToken) {
  return requestJson(`${WIDGET_BASE_PATH}/session`, {
    credentials: 'omit',
    headers: buildWidgetAuthorizationHeaders(widgetSessionToken),
  })
}

export function postWidgetMessage(widgetSessionToken, messageBody) {
  return requestJson(`${WIDGET_BASE_PATH}/messages`, {
    method: 'POST',
    credentials: 'omit',
    headers: buildWidgetAuthorizationHeaders(widgetSessionToken),
    body: { body: messageBody },
  })
}
