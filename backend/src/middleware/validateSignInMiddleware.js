import { z } from 'zod'
import { ApplicationError } from '../utils/applicationError.js'

const signInBodySchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required.').max(254),
  password: z.string().min(1, 'Password is required.').max(72),
})

export function validateSignInMiddleware(request, _response, nextFunction) {
  const parseResult = signInBodySchema.safeParse(request.body)
  if (!parseResult.success) {
    return nextFunction(new ApplicationError(400, parseResult.error.issues[0].message))
  }
  request.validatedBody = parseResult.data
  return nextFunction()
}
