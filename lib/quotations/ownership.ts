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
