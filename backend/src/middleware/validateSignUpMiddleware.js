import { z } from 'zod'
import { ApplicationError } from '../utils/applicationError.js'

const signUpBodySchema = z.object({
  businessName: z.string().trim().min(2, 'Business name must be at least 2 characters.').max(120),
  name: z.string().trim().min(1, 'Name is required.').max(120),
  email: z.string().trim().toLowerCase().email('A valid email is required.').max(254),
  // bcrypt only uses the first 72 bytes, so longer passwords are rejected instead of silently truncated.
  password: z.string().min(8, 'Password must be at least 8 characters.').max(72, 'Password must be at most 72 characters.'),
})

export function validateSignUpMiddleware(request, _response, nextFunction) {
  const parseResult = signUpBodySchema.safeParse(request.body)
  if (!parseResult.success) {
    return nextFunction(new ApplicationError(400, parseResult.error.issues[0].message))
  }
  request.validatedBody = parseResult.data
  return nextFunction()
}
