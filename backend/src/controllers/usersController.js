import {
  listStaffForBusiness,
  inviteStaffMember,
  changeStaffMemberRole,
  removeStaffMember,
} from '../services/usersService.js'

export async function listUsers(request, response) {
  const users = await listStaffForBusiness({ businessId: request.authenticatedUser.businessId })
  response.status(200).json({ users })
}

// invitationLink is present only while no mail provider delivers invitations (see invitationMailService.js).
export async function createInvitation(request, response) {
  const { invitation, invitationLink } = await inviteStaffMember({
    business: request.authenticatedBusiness,
    inviter: request.authenticatedUser,
    email: request.validatedBody.email,
    role: request.validatedBody.role,
  })
  response.status(201).json({ invitation, invitationLink })
}

export async function updateUserRole(request, response) {
  const user = await changeStaffMemberRole({
    businessId: request.authenticatedUser.businessId,
    actingUserId: request.authenticatedUser.id,
    userId: request.params.userId,
    role: request.validatedBody.role,
  })
  response.status(200).json({ user })
}

export async function removeUser(request, response) {
  await removeStaffMember({
    businessId: request.authenticatedUser.businessId,
    actingUserId: request.authenticatedUser.id,
    userId: request.params.userId,
  })
  response.status(204).end()
}
