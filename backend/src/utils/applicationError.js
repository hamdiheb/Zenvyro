// An expected, client-facing failure (bad input, wrong credentials, conflicts).
// The error handler turns it into a JSON response with this status code.
export class ApplicationError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.name = 'ApplicationError'
    this.statusCode = statusCode
  }
}
