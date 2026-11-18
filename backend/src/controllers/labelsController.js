import { listLabelsForBusiness, createLabelForBusiness } from '../services/labelsService.js'

export async function listLabels(request, response) {
  const labels = await listLabelsForBusiness({ businessId: request.authenticatedUser.businessId })
  response.status(200).json({ labels })
}

export async function createLabel(request, response) {
  const label = await createLabelForBusiness({
    businessId: request.authenticatedUser.businessId,
    name: request.validatedBody.name,
    colorHex: request.validatedBody.colorHex,
  })
  response.status(201).json({ label })
}
