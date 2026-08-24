import type { PermissionKey } from "@/lib/hooks/usePermissions"

export type QuotationOwnerContext = {
  isSuperAdmin: boolean
  hasRole?: (role: string) => boolean
  hasPermission: (permission: PermissionKey) => boolean
}

export function canViewAllQuotations(ctx: QuotationOwnerContext): boolean {
  if (ctx.isSuperAdmin) return true
  if (ctx.hasRole?.("admin")) return true
  return ctx.hasPermission("quotation.view_all")
}

export function canAccessQuotation(opts: {
  createdBy: string | null | undefined
  userId: string | null | undefined
  canViewAll: boolean
}): boolean {
  if (opts.canViewAll) return true
  if (!opts.userId) return false
  return opts.createdBy === opts.userId
}

export function formatResponsibleName(name: string | null | undefined): string {
  const trimmed = name?.trim()
  return trimmed ? trimmed : "—"
}

const BUYER_OR_HIGHER_ROLES = new Set(["buyer", "manager", "admin"])

export function isBuyerOrHigherProfile(profile: {
  profile_type?: string | null
  roles?: string[] | null
  is_superadmin?: boolean | null
}): boolean {
  if (profile.is_superadmin) return true
  const type = profile.profile_type ?? ""
  if (type === "supplier" || type === "requester") return false
  if (type === "buyer") return true
  const roles = Array.isArray(profile.roles) ? profile.roles : []
  return roles.some((role) => BUYER_OR_HIGHER_ROLES.has(role))
}
