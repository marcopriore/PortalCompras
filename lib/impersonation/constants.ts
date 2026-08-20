export const IMPERSONATED_USER_COOKIE = "impersonated_user_id"

export const IMPERSONATION_PERMISSION = "user.impersonate" as const

export type ImpersonationSession = {
  actorUserId: string
  impersonatedUserId: string
  impersonatedName: string | null
  impersonatedRoles: string[]
  impersonatedProfileType: "buyer" | "requester" | "supplier"
}
