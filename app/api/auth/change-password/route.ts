import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { resolveTenantCompanyId } from "@/lib/api/resolve-tenant-company-id"
import { loadPasswordPolicy } from "@/lib/settings/password-policy"
import {
  applyPasswordChange,
  validateNewPasswordForTenant,
} from "@/lib/auth/password-policy-server"

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as {
      currentPassword?: string
      newPassword?: string
    }

    const newPassword = body.newPassword?.trim() ?? ""
    const currentPassword = body.currentPassword?.trim() ?? ""

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

    if (!currentPassword) {
      return NextResponse.json(
        { error: "Informe a senha atual para confirmar a alteração." },
        { status: 400 },
      )
    }

    const email = user.email
    if (!email) {
      return NextResponse.json({ error: "E-mail do usuário não encontrado." }, { status: 400 })
    }

    const verifyClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { error: signInError } = await verifyClient.auth.signInWithPassword({
      email,
      password: currentPassword,
    })

    if (signInError) {
      return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 })
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
