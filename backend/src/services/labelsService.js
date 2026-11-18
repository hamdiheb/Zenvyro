import { pool } from '../db/databasePool.js'
import { ApplicationError } from '../utils/applicationError.js'
import {
  findLabelsForBusiness,
  insertLabel,
} from '../repositories/labelsRepository.js'

const LABEL_NAME_TAKEN_MESSAGE = 'A label with this name already exists.'
const UNIQUE_VIOLATION_CODE = '23505'
const LABELS_NAME_CONSTRAINT_NAME = 'labels_business_id_name_key'

function toPublicLabel(labelRow) {
  return { id: labelRow.id, name: labelRow.name, colorHex: labelRow.color_hex }
}

export async function listLabelsForBusiness({ businessId }) {
  const labelRows = await findLabelsForBusiness(pool, { businessId })
  return labelRows.map(toPublicLabel)
}

export async function createLabelForBusiness({ businessId, name, colorHex }) {
  try {
    const labelRow = await insertLabel(pool, { businessId, name, colorHex })
    return toPublicLabel(labelRow)
  } catch (error) {
    if (error.code === UNIQUE_VIOLATION_CODE && error.constraint === LABELS_NAME_CONSTRAINT_NAME) {
      throw new ApplicationError(409, LABEL_NAME_TAKEN_MESSAGE)
    }
    throw error
  }
}
