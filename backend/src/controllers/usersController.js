import { listStaffForBusiness } from '../services/usersService.js'

export async function listUsers(request, response) {
  const users = await listStaffForBusiness({ businessId: request.authenticatedUser.businessId })
  response.status(200).json({ users })
}
