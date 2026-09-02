import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { applyPasswordChange } from "@/lib/auth/password-policy-server"
import { loadPasswordPolicy } from "@/lib/settings/password-policy"
import { validatePasswordAgainstPolicy } from "@/lib/settings/password-policy-registry"
import { logAuditServer } from "@/lib/audit-server"
import {
  activateSupplierTenant,
  findActiveSupplierAdminUserId,
  findAuthUserByEmail,
  getSupplierMembership,
  upsertSupplierMembership,
  userCnpjMatchesSupplierAdmin,
} from "@/lib/supplier-portal/memberships"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isValidCnpjLength, normalizeCnpj } from "@/lib/utils/cnpj"

function authAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

type AcceptBody = {
  token?: string
  mode?: "register" | "link"
  fullName?: string
  cnpj?: string
  password?: string
}

/** POST — conclui cadastro ou vincula fornecedor existente via convite */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AcceptBody
    const mode = body.mode ?? "register"

    if (!body.token?.trim() || !body.password || !body.cnpj) {
      return NextResponse.json({ error: "Preencha todos os campos obrigatórios." }, { status: 400 })
    }

    if (mode === "register" && !body.fullName?.trim()) {
      return NextResponse.json({ error: "Informe o nome completo." }, { status: 400 })
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

    const authAdmin = authAdminClient()

    if (mode === "link") {
      return handleLinkAccept({
        body,
        invite,
        supplier,
        supplierCnpj,
        supabaseAdmin,
      })
    }

    return handleRegisterAccept({
      body,
      invite,
      supplier,
      supplierCnpj,
      supabaseAdmin,
      authAdmin,
    })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}

async function handleLinkAccept(ctx: {
  body: AcceptBody
  invite: {
    id: string
    email: string
    company_id: string
    supplier_id: string
  }
  supplier: { id: string; name: string }
  supplierCnpj: string
  supabaseAdmin: ReturnType<typeof createServiceRoleClient>
}) {
  const { body, invite, supplier, supplierCnpj, supabaseAdmin } = ctx

  const authUser = await findAuthUserByEmail(invite.email)
  if (!authUser) {
    return NextResponse.json(
      { error: "Conta não encontrada. Use o fluxo de cadastro completo." },
      { status: 400 },
    )
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("profile_type, status")
    .eq("id", authUser.id)
    .maybeSingle()

  if (profile?.profile_type !== "supplier" || profile.status !== "active") {
    return NextResponse.json(
      { error: "Esta conta não é de fornecedor no Valore." },
      { status: 403 },
    )
  }

  const cnpjOk = await userCnpjMatchesSupplierAdmin(authUser.id, supplierCnpj)
  if (!cnpjOk) {
    return NextResponse.json(
      { error: "O CNPJ informado não confere com o cadastro da sua conta." },
      { status: 400 },
    )
  }

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { error: signInError } = await anonClient.auth.signInWithPassword({
    email: invite.email,
    password: body.password!,
  })
  if (signInError) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 })
  }
  await anonClient.auth.signOut()

  const existingMembership = await getSupplierMembership(
    authUser.id,
    invite.company_id,
    invite.supplier_id,
  )
  if (existingMembership?.status === "active") {
    await markInviteAccepted(supabaseAdmin, invite.id, authUser.id)
    await activateSupplierTenant(authUser.id, invite.company_id, invite.supplier_id)
    return NextResponse.json({ success: true, linked: true, alreadyLinked: true })
  }

  const otherAdminId = await findActiveSupplierAdminUserId(
    invite.company_id,
    invite.supplier_id,
  )
  if (otherAdminId && otherAdminId !== authUser.id) {
    return NextResponse.json(
      { error: "Este fornecedor já possui outro administrador neste comprador." },
      { status: 409 },
    )
  }

  const membershipResult = await upsertSupplierMembership({
    userId: authUser.id,
    companyId: invite.company_id,
    supplierId: invite.supplier_id,
    isSupplierAdmin: true,
    loginCnpj: supplierCnpj,
  })
  if (membershipResult.error) {
    return NextResponse.json({ error: membershipResult.error }, { status: 500 })
  }

  const activateResult = await activateSupplierTenant(
    authUser.id,
    invite.company_id,
    invite.supplier_id,
  )
  if (activateResult.error) {
    return NextResponse.json({ error: activateResult.error }, { status: 500 })
  }

  await markInviteAccepted(supabaseAdmin, invite.id, authUser.id)

  await logAuditServer({
    eventType: "supplier.invite_linked",
    description: `Fornecedor ${supplier.name} vinculou-se a novo comprador no portal`,
    userId: authUser.id,
    companyId: invite.company_id,
    entity: "supplier",
    entityId: supplier.id,
    metadata: { inviteId: invite.id, cnpj: supplierCnpj },
  })

  return NextResponse.json({ success: true, linked: true })
}

async function handleRegisterAccept(ctx: {
  body: AcceptBody
  invite: {
    id: string
    email: string
    company_id: string
    supplier_id: string
  }
  supplier: { id: string; name: string }
  supplierCnpj: string
  supabaseAdmin: ReturnType<typeof createServiceRoleClient>
  authAdmin: ReturnType<typeof authAdminClient>
}) {
  const { body, invite, supplier, supplierCnpj, supabaseAdmin, authAdmin } = ctx

  const existingAuth = await findAuthUserByEmail(invite.email)
  if (existingAuth) {
    return NextResponse.json(
      {
        error:
          "Já existe uma conta com este e-mail. Use o fluxo de vínculo com sua senha atual.",
        code: "EMAIL_ALREADY_REGISTERED",
      },
      { status: 409 },
    )
  }

  const otherAdminId = await findActiveSupplierAdminUserId(
    invite.company_id,
    invite.supplier_id,
  )
  if (otherAdminId) {
    return NextResponse.json(
      { error: "Este fornecedor já possui administrador cadastrado." },
      { status: 409 },
    )
  }

  const policy = await loadPasswordPolicy(supabaseAdmin, invite.company_id)
  const passwordCheck = validatePasswordAgainstPolicy(body.password!, policy)
  if (!passwordCheck.ok) {
    return NextResponse.json({ error: passwordCheck.error }, { status: 400 })
  }

  const { data: authData, error: authError } = await authAdmin.auth.admin.createUser({
    email: invite.email,
    password: body.password!,
    email_confirm: true,
    user_metadata: {
      full_name: body.fullName!.trim(),
      company_id: invite.company_id,
    },
  })

  if (authError || !authData.user) {
    const msg = authError?.message ?? "Erro ao criar usuário."
    if (msg.toLowerCase().includes("already been registered")) {
      return NextResponse.json(
        {
          error:
            "Já existe uma conta com este e-mail. Recarregue a página para vincular-se ao comprador.",
          code: "EMAIL_ALREADY_REGISTERED",
        },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  await new Promise((resolve) => setTimeout(resolve, 500))

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      company_id: invite.company_id,
      full_name: body.fullName!.trim(),
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

  await upsertSupplierMembership({
    userId: authData.user.id,
    companyId: invite.company_id,
    supplierId: invite.supplier_id,
    isSupplierAdmin: true,
    loginCnpj: supplierCnpj,
  })

  await applyPasswordChange(
    supabaseAdmin,
    authData.user.id,
    invite.company_id,
    body.password!,
    policy,
  )

  await markInviteAccepted(supabaseAdmin, invite.id, authData.user.id)

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
}

async function markInviteAccepted(
  supabaseAdmin: ReturnType<typeof createServiceRoleClient>,
  inviteId: string,
  userId: string,
) {
  await supabaseAdmin
    .from("supplier_invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
    })
    .eq("id", inviteId)
}
