// Staff roles. They match the CHECK constraints on users.role and user_invitations.role.
export const OWNER_ROLE = 'owner'
export const ADMIN_ROLE = 'admin'
export const AGENT_ROLE = 'agent'

// Roles that may manage staff and change what the AI does (configuration, rules, knowledge, hand-back).
export const STAFF_MANAGER_ROLES = [OWNER_ROLE, ADMIN_ROLE]

// Roles an invitation or a role change may grant. Each business has exactly one owner, created at sign-up.
export const ASSIGNABLE_ROLES = [ADMIN_ROLE, AGENT_ROLE]
