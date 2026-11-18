import { ApplicationError } from './applicationError.js'
import { isValidUuid } from './inputValidation.js'

export const DEFAULT_PAGE_LIMIT = 20
export const MAXIMUM_PAGE_LIMIT = 50

// Postgres text form of a timestamptz, for example "2026-11-18 10:00:00.123456+00".
// Keeping the full microsecond text avoids the millisecond rounding that JavaScript Dates would add.
const TIMESTAMP_TEXT_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}(:?\d{2})?$/
const INVALID_CURSOR_MESSAGE = 'Cursor is not valid.'

function parseCursorJson(encodedCursorText) {
  try {
    return JSON.parse(Buffer.from(encodedCursorText, 'base64url').toString('utf8'))
  } catch {
    throw new ApplicationError(400, INVALID_CURSOR_MESSAGE)
  }
}

// A cursor marks the last row of a page: its sort value (as text) and its id, as base64url JSON.
export function encodePaginationCursor({ sortValue, id }) {
  return Buffer.from(JSON.stringify({ sortValue, id }), 'utf8').toString('base64url')
}

export function decodePaginationCursor(encodedCursorText) {
  const parsedCursor = parseCursorJson(encodedCursorText)

  const isCursorShapeValid =
    parsedCursor !== null &&
    typeof parsedCursor === 'object' &&
    typeof parsedCursor.sortValue === 'string' &&
    TIMESTAMP_TEXT_PATTERN.test(parsedCursor.sortValue) &&
    typeof parsedCursor.id === 'string' &&
    isValidUuid(parsedCursor.id)

  if (!isCursorShapeValid) {
    throw new ApplicationError(400, INVALID_CURSOR_MESSAGE)
  }
  return { sortValue: parsedCursor.sortValue, id: parsedCursor.id }
}

// Reads the optional limit query value. Empty means the default; values above the maximum are capped.
export function readPageLimit(limitText) {
  if (limitText === undefined || limitText === '') {
    return DEFAULT_PAGE_LIMIT
  }
  if (!/^\d+$/.test(limitText) || Number(limitText) < 1) {
    throw new ApplicationError(400, 'limit must be a positive whole number.')
  }
  return Math.min(Number(limitText), MAXIMUM_PAGE_LIMIT)
}
