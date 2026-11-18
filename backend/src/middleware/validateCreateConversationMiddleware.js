import { ApplicationError } from '../utils/applicationError.js'
import { readBodyText, isValidEmail, isValidUuid } from '../utils/inputValidation.js'
import { MESSAGE_BODY_MAXIMUM_LENGTH } from '../utils/conversationValues.js'

const CUSTOMER_NAME_MAXIMUM_LENGTH = 120
const EXTERNAL_ID_MAXIMUM_LENGTH = 120

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readNewCustomerOrError(customerObject) {
  const customerName = readBodyText(customerObject, 'name').trim()
  const customerEmail = readBodyText(customerObject, 'email').trim().toLowerCase()
  const externalId = readBodyText(customerObject, 'externalId').trim()

  if (customerName.length === 0 || customerName.length > CUSTOMER_NAME_MAXIMUM_LENGTH) {
    return { error: `customer.name is required and must be at most ${CUSTOMER_NAME_MAXIMUM_LENGTH} characters.` }
  }
  if (customerEmail.length > 0 && !isValidEmail(customerEmail)) {
    return { error: 'customer.email must be a valid email when given.' }
  }
  if (externalId.length > EXTERNAL_ID_MAXIMUM_LENGTH) {
    return { error: `customer.externalId must be at most ${EXTERNAL_ID_MAXIMUM_LENGTH} characters.` }
  }

  return {
    newCustomer: {
      name: customerName,
      email: customerEmail || null,
      externalId: externalId || null,
    },
  }
}

// Exactly one of customerId (an existing customer) or customer (a new one) must be given.
export function validateCreateConversationMiddleware(request, _response, nextFunction) {
  const requestBody = request.body ?? {}
  const hasCustomerId = requestBody.customerId !== undefined
  const hasNewCustomer = requestBody.customer !== undefined

  if (hasCustomerId === hasNewCustomer) {
    return nextFunction(new ApplicationError(400, 'Give either customerId or customer, not both or neither.'))
  }

  let customerId = null
  let newCustomer = null
  if (hasCustomerId) {
    if (typeof requestBody.customerId !== 'string' || !isValidUuid(requestBody.customerId)) {
      return nextFunction(new ApplicationError(400, 'customerId must be a valid id.'))
    }
    customerId = requestBody.customerId
  } else {
    if (!isPlainObject(requestBody.customer)) {
      return nextFunction(new ApplicationError(400, 'customer must be an object.'))
    }
    const newCustomerResult = readNewCustomerOrError(requestBody.customer)
    if (newCustomerResult.error) {
      return nextFunction(new ApplicationError(400, newCustomerResult.error))
    }
    newCustomer = newCustomerResult.newCustomer
  }

  let firstMessageText = null
  if (requestBody.firstMessageText !== undefined) {
    firstMessageText = readBodyText(requestBody, 'firstMessageText').trim()
    if (firstMessageText.length === 0 || firstMessageText.length > MESSAGE_BODY_MAXIMUM_LENGTH) {
      return nextFunction(
        new ApplicationError(400, `firstMessageText must be 1 to ${MESSAGE_BODY_MAXIMUM_LENGTH} characters.`),
      )
    }
  }

  request.validatedBody = { customerId, newCustomer, firstMessageText }
  return nextFunction()
}
