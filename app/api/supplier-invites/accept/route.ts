import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { applyPasswordChange } from "@/lib/auth/password-policy-server"
import { loadPasswordPolicy } from "@/lib/settings/password-policy"
import { validatePasswordAgainstPolicy } from "@/lib/settings/password-policy-registry"
import { logAuditServer } from "@/lib/audit-server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isValidCnpjLength, normalizeCnpj } from "@/lib/utils/cnpj"

/** POST — conclui cadastro do administrador via convite */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string
      fullName?: string
      cnpj?: string
      password?: string
    }

    if (!body.token?.trim() || !body.fullName?.trim() || !body.password || !body.cnpj) {
      return NextResponse.json({ error: "Preencha todos os campos." }, { status: 400 })
    }

    if (!isValidCnpjLength(body.cnpj)) {
      return NextResponse.json({ error: "CNPJ inválido." }, { status: 400 })
    }

    const supabaseAdmin = createServiceRoleClient()

    const { data: invite } = await supabaseAdmin
      .from("supplier_invites")
      .select("id, email, status, expires_at, company_id, supplier_id")
      .eq("token", body.token.trim())
      .maybeSingle()

    if (!invite || invite.status !== "pending") {
      return NextResponse.json({ error: "Convite inválido." }, { status: 404 })
    }

    if (new Date(invite.expires_at) < new Date()) {
      await supabaseAdmin
        .from("supplier_invites")
        .update({ status: "expired" })
        .eq("id", invite.id)
      return NextResponse.json({ error: "Convite expirado." }, { status: 410 })
    }

    const { data: supplier } = await supabaseAdmin
      .from("suppliers")
      .select("id, name, cnpj, status")
      .eq("id", invite.supplier_id)
      .eq("company_id", invite.company_id)
      .maybeSingle()

    if (!supplier || supplier.status !== "active") {
      return NextResponse.json({ error: "Fornecedor indisponível." }, { status: 400 })
    }

    const submittedCnpj = normalizeCnpj(body.cnpj)
    const supplierCnpj = normalizeCnpj(supplier.cnpj)
    if (submittedCnpj !== supplierCnpj) {
      return NextResponse.json(
        {
          error:
            "O CNPJ informado não confere com o cadastro do fornecedor no portal do comprador.",
        },
        { status: 400 },
      )
    }

    const { data: existingAdmin } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("company_id", invite.company_id)
      .eq("supplier_id", invite.supplier_id)
      .eq("profile_type", "supplier")
      .eq("is_supplier_admin", true)
      .eq("status", "active")
      .maybeSingle()

    if (existingAdmin) {
      return NextResponse.json(
        { error: "Este fornecedor já possui administrador cadastrado." },
        { status: 409 },
      )
    }

    const policy = await loadPasswordPolicy(supabaseAdmin, invite.company_id)
    const passwordCheck = validatePasswordAgainstPolicy(body.password, policy)
    if (!passwordCheck.ok) {
      return NextResponse.json({ error: passwordCheck.error }, { status: 400 })
    }

    const authAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: authData, error: authError } = await authAdmin.auth.admin.createUser({
      email: invite.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.fullName.trim(),
        company_id: invite.company_id,
      },
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message ?? "Erro ao criar usuário." },
        { status: 400 },
      )
    }

    await new Promise((resolve) => setTimeout(resolve, 500))

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        company_id: invite.company_id,
        full_name: body.fullName.trim(),
        role: "supplier",
        roles: ["supplier"],
        status: "active",
        is_superadmin: false,
        profile_type: "supplier",
        supplier_id: invite.supplier_id,
        is_supplier_admin: true,
        login_cnpj: supplierCnpj,
      })
      .eq("id", authData.user.id)

    if (profileError) {
      await authAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: "Erro ao vincular perfil." }, { status: 500 })
    }

    await applyPasswordChange(
      supabaseAdmin,
      authData.user.id,
      invite.company_id,
      body.password,
      policy,
    )

    await supabaseAdmin
      .from("supplier_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: authData.user.id,
      })
      .eq("id", invite.id)

    await logAuditServer({
      eventType: "supplier.invite_accepted",
      description: `Administrador do fornecedor ${supplier.name} concluiu cadastro no portal`,
      userId: authData.user.id,
      companyId: invite.company_id,
      entity: "supplier",
      entityId: supplier.id,
      metadata: { inviteId: invite.id, cnpj: supplierCnpj },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}
