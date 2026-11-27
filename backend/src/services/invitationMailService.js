// Port for delivering staff invitations. A mailer has one method:
//   deliverInvitation({ email, role, invitationLink, businessName, inviterName })
//     -> { isLinkReturnedToInviter: boolean }
// No mail provider is chosen yet, so the default adapter sends nothing and asks the API to return the
// link to the inviter, who shares it with the invitee. A real provider replaces it with setInvitationMailer
// and returns isLinkReturnedToInviter: false, so the link stays out of API responses.
const linkOnlyInvitationMailer = Object.freeze({
  async deliverInvitation() {
    return { isLinkReturnedToInviter: true }
  },
})

let activeInvitationMailer = linkOnlyInvitationMailer

export function getInvitationMailer() {
  return activeInvitationMailer
}

// Swaps the adapter (at startup, or in tests). Passing nothing restores the link-only adapter.
export function setInvitationMailer(invitationMailer = linkOnlyInvitationMailer) {
  activeInvitationMailer = invitationMailer
}
