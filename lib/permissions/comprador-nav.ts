import type { FeatureKey, PermissionKey } from "@/lib/hooks/usePermissions"

export type CompradorAccessContext = {
  isSuperAdmin: boolean
  hasPermission: (permission: PermissionKey) => boolean
  hasFeature: (feature: FeatureKey) => boolean
  hasRole?: (role: string) => boolean
}

type AccessRule = {
  permissions?: PermissionKey[]
  anyPermission?: boolean
  features?: FeatureKey[]
}

type NavEntryRule = AccessRule & {
  href: string
}

type RouteRule = AccessRule & {
  prefix: string
  adminOnly?: boolean
}

export const COMPRADOR_NAV_RULES: NavEntryRule[] = [
  { href: "/comprador", permissions: ["nav.dashboard"] },
  { href: "/comprador/requisicoes", permissions: ["nav.requisitions"] },
  { href: "/comprador/cotacoes", permissions: ["nav.quotations"] },
  { href: "/comprador/pedidos", permissions: ["nav.orders"] },
  { href: "/comprador/contratos", features: ["contracts"] },
  {
    href: "/comprador/aprovacoes",
    permissions: ["approval.requisition", "approval.order"],
    anyPermission: true,
  },
  { href: "/comprador/itens", permissions: ["nav.items"] },
  { href: "/comprador/fornecedores", permissions: ["nav.suppliers"] },
  { href: "/comprador/relatorios", permissions: ["nav.reports"] },
  { href: "/comprador/configuracoes/usuarios", permissions: ["user.manage", "user.impersonate"], anyPermission: true },
  { href: "/comprador/configuracoes", permissions: ["settings.manage", "user.impersonate"], anyPermission: true },
]

const COMPRADOR_ROUTE_RULES: RouteRule[] = [
  {
    prefix: "/comprador/requisicoes/nova",
    permissions: ["requisition.create.buyer"],
  },
  {
    prefix: "/comprador/configuracoes/permissoes",
    adminOnly: true,
  },
  ...COMPRADOR_NAV_RULES.map((entry) => ({
    ...entry,
    prefix: entry.href,
  })),
]

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function evaluateRule(rule: AccessRule, ctx: CompradorAccessContext): boolean {
  if (ctx.isSuperAdmin) return true

  if (rule.features?.length) {
    if (!rule.features.every((f) => ctx.hasFeature(f))) return false
  }

  if (!rule.permissions?.length) return true

  if (rule.anyPermission) {
    return rule.permissions.some((p) => ctx.hasPermission(p))
  }

  return rule.permissions.every((p) => ctx.hasPermission(p))
}

export function canAccessCompradorNavHref(
  href: string,
  ctx: CompradorAccessContext,
): boolean {
  const rule = COMPRADOR_NAV_RULES.find((r) => r.href === href)
  if (!rule) return true
  return evaluateRule(rule, ctx)
}

export function getAccessibleCompradorNavHrefs(
  ctx: CompradorAccessContext,
): string[] {
  return COMPRADOR_NAV_RULES.filter((r) =>
    canAccessCompradorNavHref(r.href, ctx),
  ).map((r) => r.href)
}

export function getDefaultCompradorHref(ctx: CompradorAccessContext): string | null {
  const accessible = getAccessibleCompradorNavHrefs(ctx)
  return accessible[0] ?? null
}

export function canAccessCompradorPath(
  pathname: string,
  ctx: CompradorAccessContext,
): boolean {
  if (ctx.isSuperAdmin) return true
  if (!pathname.startsWith("/comprador")) return true

  if (
    pathname === "/comprador/alterar-senha" ||
    pathname.startsWith("/comprador/alterar-senha/")
  ) {
    return true
  }

  const isEqualizacao =
    pathname.includes("/equalizacao") && pathname.startsWith("/comprador/cotacoes/")

  if (isEqualizacao) {
    if (!ctx.hasFeature("equalization")) return false
    if (!ctx.hasPermission("nav.quotations")) return false
    return (
      ctx.hasPermission("quotation.equalize.view") ||
      ctx.hasPermission("quotation.equalize.select")
    )
  }

  const sorted = [...COMPRADOR_ROUTE_RULES].sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )

  const rule = sorted.find((r) => matchesPrefix(pathname, r.prefix))
  if (!rule) return true

  if (rule.adminOnly) {
    return ctx.hasRole?.("admin") ?? false
  }

  return evaluateRule(rule, ctx)
}
