import { createClient } from "@supabase/supabase-js"
import type { User } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { normalizeCnpj } from "@/lib/utils/cnpj"

function authAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** Busca usuário Auth pelo e-mail (operação rara — convite / vínculo). */
export async function findAuthUserByEmail(email: string): Promise<User | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null

  const authAdmin = authAdminClient()
  let page = 1
  const perPage = 1000

  while (page <= 20) {
    const { data, error } = await authAdmin.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error("[findAuthUserByEmail] listUsers:", error.message)
      return null
    }

    const found = data.users.find((u) => u.email?.toLowerCase() === normalized)
    if (found) return found

    if (data.users.length < perPage) break
    page += 1
  }

  return null
}

export type SupplierMembershipRow = {
  user_id: string
  company_id: string
  supplier_id: string
  is_supplier_admin: boolean
  login_cnpj: string | null
  status: string
}

export async function getSupplierMembership(
  userId: string,
  companyId: string,
  supplierId: string,
): Promise<SupplierMembershipRow | null> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from("supplier_portal_memberships")
    .select("user_id, company_id, supplier_id, is_supplier_admin, login_cnpj, status")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("supplier_id", supplierId)
    .maybeSingle()

  return data
}

export async function upsertSupplierMembership(input: {
  userId: string
  companyId: string
  supplierId: string
  isSupplierAdmin: boolean
  loginCnpj: string
}): Promise<{ error?: string }> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from("supplier_portal_memberships").upsert(
    {
      user_id: input.userId,
      company_id: input.companyId,
      supplier_id: input.supplierId,
      is_supplier_admin: input.isSupplierAdmin,
      login_cnpj: input.loginCnpj,
      status: "active",
    },
    { onConflict: "user_id,company_id,supplier_id" },
  )

  if (error) {
    console.error("[upsertSupplierMembership]", error.message)
    return { error: "Erro ao vincular fornecedor ao comprador." }
  }
  return {}
}

/** Atualiza profile para o tenant ativo após login ou vínculo. */
export async function activateSupplierTenant(
  userId: string,
  companyId: string,
  supplierId: string,
): Promise<{ error?: string }> {
  const supabase = createServiceRoleClient()

  const membership = await getSupplierMembership(userId, companyId, supplierId)
  if (!membership || membership.status !== "active") {
    return { error: "Vínculo com este comprador não encontrado." }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      company_id: companyId,
      supplier_id: supplierId,
      profile_type: "supplier",
      role: "supplier",
      roles: ["supplier"],
      status: "active",
      is_supplier_admin: membership.is_supplier_admin,
      login_cnpj: membership.login_cnpj,
    })
    .eq("id", userId)

  if (error) {
    console.error("[activateSupplierTenant]", error.message)
    return { error: "Erro ao ativar acesso ao comprador." }
  }
  return {}
}

/** Admin ativo do fornecedor neste tenant (outro usuário bloqueia novo vínculo). */
export async function findActiveSupplierAdminUserId(
  companyId: string,
  supplierId: string,
): Promise<string | null> {
  const supabase = createServiceRoleClient()

  const { data: profileAdmin } = await supabase
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("supplier_id", supplierId)
    .eq("profile_type", "supplier")
    .eq("is_supplier_admin", true)
    .eq("status", "active")
    .maybeSingle()

  if (profileAdmin?.id) return profileAdmin.id

  const { data: membershipAdmin } = await supabase
    .from("supplier_portal_memberships")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("supplier_id", supplierId)
    .eq("is_supplier_admin", true)
    .eq("status", "active")
    .limit(1)
    .maybeSingle()

  return membershipAdmin?.user_id ?? null
}

/** Verifica se o CNPJ informado bate com o cadastro do usuário em algum tenant. */
export async function userCnpjMatchesSupplierAdmin(
  userId: string,
  cnpjDigits: string,
): Promise<boolean> {
  const supabase = createServiceRoleClient()

  const { data: profile } = await supabase
    .from("profiles")
    .select("login_cnpj, is_supplier_admin, profile_type")
    .eq("id", userId)
    .maybeSingle()

  if (
    profile?.profile_type === "supplier" &&
    profile.is_supplier_admin &&
    normalizeCnpj(profile.login_cnpj) === cnpjDigits
  ) {
    return true
  }

  const { data: memberships } = await supabase
    .from("supplier_portal_memberships")
    .select("login_cnpj, is_supplier_admin")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("is_supplier_admin", true)

  if (
    (memberships ?? []).some((m) => normalizeCnpj(m.login_cnpj) === cnpjDigits)
  ) {
    return true
  }

  const { data: membershipSuppliers } = await supabase
    .from("supplier_portal_memberships")
    .select("supplier_id, company_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("is_supplier_admin", true)

  if (!membershipSuppliers?.length) return false

  const supplierIds = [...new Set(membershipSuppliers.map((m) => m.supplier_id))]
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, cnpj")
    .in("id", supplierIds)

  return (suppliers ?? []).some((s) => normalizeCnpj(s.cnpj) === cnpjDigits)
}
