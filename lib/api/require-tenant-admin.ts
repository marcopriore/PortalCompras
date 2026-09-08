import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import type { PermissionKey } from "@/lib/hooks/usePermissions"
import {
  hasUserPermission,
  loadUserPermissionKeys,
} from "@/lib/permissions/resolve-user-permissions"

type AuthOk = {
  supabase: SupabaseClient
  user: { id: string }
  profile: {
    id: string
    company_id: string
    role: string | null
    roles: string[] | null
    is_superadmin: boolean | null
  }
  companyId: string
  isSuperAdmin: boolean
}

async function resolveCompanyAuth(): Promise<
  AuthOk | { error: NextResponse }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, company_id, role, roles, is_superadmin")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  let companyId = profile.company_id as string
  const isSuperAdmin = Boolean(profile.is_superadmin)
  if (isSuperAdmin) {
    const cookieStore = await cookies()
    const selectedCookie = cookieStore.get("selected_company_id")
    if (selectedCookie?.value) {
      companyId = decodeURIComponent(selectedCookie.value)
    }
  }

  return {
    supabase,
    user,
    profile: profile as AuthOk["profile"],
    companyId,
    isSuperAdmin,
  }
}

/**
 * Exige superadmin ou uma das permission keys (grupo/perfil).
 * Não usa bypass por role `admin` — só permissões parametrizadas.
 */
export async function requireAnyPermission(
  permissions: PermissionKey[],
): Promise<AuthOk | { error: NextResponse }> {
  const auth = await resolveCompanyAuth()
  if ("error" in auth) return auth

  if (auth.isSuperAdmin) return auth

  const service = createServiceRoleClient()
  const keys = await loadUserPermissionKeys(service, auth.user.id, auth.companyId)
  const ok = permissions.some((p) => hasUserPermission(keys, p))
  if (!ok) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return auth
}

/** Configurações / grupos de perfil: settings.manage */
export async function requireTenantAdmin() {
  return requireAnyPermission(["settings.manage"])
}

/** Monitor e APIs de integração: integration.monitor + feature */
export async function requireIntegrationsAdmin() {
  const auth = await requireAnyPermission(["integration.monitor"])
  if ("error" in auth) return auth

  const enabled = await isTenantFeatureEnabled(auth.companyId, "api_integrations")
  if (!enabled) {
    return {
      error: NextResponse.json(
        { error: "Módulo de integrações não habilitado para este tenant." },
        { status: 403 },
      ),
    }
  }

  return auth
}
