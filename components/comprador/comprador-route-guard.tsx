"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import {
  canAccessCompradorPath,
  getDefaultCompradorHref,
  type CompradorAccessContext,
} from "@/lib/permissions/comprador-nav"
import { PageLoading } from "@/components/ui/page-loading"

export function CompradorRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isSuperAdmin, hasRole, loading: userLoading } = useUser()
  const { hasPermission, hasFeature, loading: permissionsLoading } = usePermissions()
  const lastRedirectRef = React.useRef<string | null>(null)

  const loading = userLoading || permissionsLoading

  const ctx = React.useMemo<CompradorAccessContext>(
    () => ({
      isSuperAdmin,
      hasPermission,
      hasFeature,
      hasRole,
    }),
    [isSuperAdmin, hasPermission, hasFeature, hasRole],
  )

  React.useEffect(() => {
    if (loading) return
    if (!pathname.startsWith("/comprador")) return

    if (canAccessCompradorPath(pathname, ctx)) {
      lastRedirectRef.current = null
      return
    }

    const fallback = getDefaultCompradorHref(ctx)
    const target = fallback ?? "/comprador?error=sem_permissao"

    if (pathname === target || lastRedirectRef.current === target) return
    lastRedirectRef.current = target

    if (!fallback) {
      toast.error("Você não tem permissão para acessar nenhuma área do portal.")
    } else if (pathname !== fallback) {
      toast.error("Você não tem permissão para acessar esta página.")
    }

    router.replace(target)
  }, [loading, pathname, ctx, router])

  if (loading) {
    return <PageLoading label="Carregando permissões..." />
  }

  if (!canAccessCompradorPath(pathname, ctx) && !isSuperAdmin) {
    const fallback = getDefaultCompradorHref(ctx)
    if (!fallback) {
      return (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <p className="text-lg font-medium text-foreground">Acesso restrito</p>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            Seu perfil não possui permissões para navegar no portal do comprador.
            Entre em contato com o administrador da empresa.
          </p>
        </div>
      )
    }
    return null
  }

  return <>{children}</>
}
