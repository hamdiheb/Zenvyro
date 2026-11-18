import { ApplicationError } from '../utils/applicationError.js'
import { readBodyText } from '../utils/inputValidation.js'
import {
  LABEL_NAME_MAXIMUM_LENGTH,
  DEFAULT_LABEL_COLOR_HEX,
  LABEL_COLOR_HEX_PATTERN,
} from '../utils/labelValues.js'

export function validateCreateLabelMiddleware(request, _response, nextFunction) {
  const labelName = readBodyText(request.body, 'name').trim()
  if (labelName.length === 0 || labelName.length > LABEL_NAME_MAXIMUM_LENGTH) {
    return nextFunction(
      new ApplicationError(400, `name is required and must be 1 to ${LABEL_NAME_MAXIMUM_LENGTH} characters.`),
    )
  }

  const colorHex = request.body?.colorHex === undefined ? DEFAULT_LABEL_COLOR_HEX : readBodyText(request.body, 'colorHex')
  if (!LABEL_COLOR_HEX_PATTERN.test(colorHex)) {
    return nextFunction(new ApplicationError(400, 'colorHex must be a hex colour such as #4a6cf7.'))
  }

  request.validatedBody = { name: labelName, colorHex }
  return nextFunction()
}
