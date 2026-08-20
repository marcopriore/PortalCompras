import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { resolveTenantCompanyId } from "@/lib/api/resolve-tenant-company-id"
import { loadPasswordPolicy } from "@/lib/settings/password-policy"
import {
  applyPasswordChange,
  validateNewPasswordForTenant,
} from "@/lib/auth/password-policy-server"

/**
 * Define nova senha após clique no link de recuperação (sessão recovery).
 * Não exige senha atual.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "Sessão de recuperação inválida ou expirada. Solicite um novo link." },
        { status: 401 },
      )
    }

    const body = (await request.json()) as { newPassword?: string }
    const newPassword = body.newPassword?.trim() ?? ""
    if (!newPassword) {
      return NextResponse.json({ error: "Nova senha é obrigatória." }, { status: 400 })
    }

    const resolved = await resolveTenantCompanyId(supabase, user.id)
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    const service = createServiceRoleClient()
    const policy = await loadPasswordPolicy(service, resolved.companyId)

    const validation = await validateNewPasswordForTenant(
      service,
      user.id,
      resolved.companyId,
      newPassword,
      policy,
    )
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { error: updateError } = await service.auth.admin.updateUserById(user.id, {
      password: newPassword,
    })
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    await applyPasswordChange(
      service,
      user.id,
      resolved.companyId,
      newPassword,
      policy,
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
