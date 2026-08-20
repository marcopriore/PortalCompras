import { createClient } from "@supabase/supabase-js"
import { applyPasswordChange } from "@/lib/auth/password-policy-server"
import { loadPasswordPolicy } from "@/lib/settings/password-policy"
import { validatePasswordAgainstPolicy } from "@/lib/settings/password-policy-registry"
import { normalizeImportedEmail } from "@/lib/utils/excel-cell"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const MAX_SUPPLIER_PORTAL_USERS = 5

export type SupplierPortalUserRow = {
  id: string
  full_name: string | null
  email: string | null
  status: string
  is_supplier_admin: boolean
  login_cnpj: string | null
  created_at: string
}

function authAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function listSupplierPortalUsers(
  companyId: string,
  supplierId: string,
): Promise<SupplierPortalUserRow[]> {
  const supabase = createServiceRoleClient()
  const authAdmin = authAdminClient()

  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, status, is_supplier_admin, login_cnpj, created_at")
    .eq("company_id", companyId)
    .eq("supplier_id", supplierId)
    .eq("profile_type", "supplier")
    .order("created_at", { ascending: true })

  return Promise.all(
    (users ?? []).map(async (u) => {
      const { data: authUser } = await authAdmin.auth.admin.getUserById(u.id)
      return {
        ...u,
        email: authUser?.user?.email ?? null,
      } as SupplierPortalUserRow
    }),
  )
}

export async function countSupplierPortalUsers(
  companyId: string,
  supplierId: string,
): Promise<number> {
  const supabase = createServiceRoleClient()
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("supplier_id", supplierId)
    .eq("profile_type", "supplier")

  return count ?? 0
}

export async function createSupplierPortalUser(input: {
  companyId: string
  supplierId: string
  email: string
  fullName: string
  password: string
}): Promise<{ userId: string } | { error: string }> {
  const email = normalizeImportedEmail(input.email)
  if (!email) return { error: "E-mail inválido." }

  const count = await countSupplierPortalUsers(input.companyId, input.supplierId)
  if (count >= MAX_SUPPLIER_PORTAL_USERS) {
    return { error: `Limite de ${MAX_SUPPLIER_PORTAL_USERS} usuários por fornecedor atingido.` }
  }

  const supabase = createServiceRoleClient()
  const authAdmin = authAdminClient()

  const policy = await loadPasswordPolicy(supabase, input.companyId)
  const passwordCheck = validatePasswordAgainstPolicy(input.password, policy)
  if (!passwordCheck.ok) return { error: passwordCheck.error ?? "Senha inválida." }

  const { data: authData, error: authError } = await authAdmin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName.trim(),
      company_id: input.companyId,
    },
  })

  if (authError || !authData.user) {
    return { error: authError?.message ?? "Erro ao criar usuário." }
  }

  await new Promise((resolve) => setTimeout(resolve, 500))

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      company_id: input.companyId,
      full_name: input.fullName.trim(),
      role: "supplier",
      roles: ["supplier"],
      status: "active",
      is_superadmin: false,
      profile_type: "supplier",
      supplier_id: input.supplierId,
      is_supplier_admin: false,
      login_cnpj: null,
    })
    .eq("id", authData.user.id)

  if (profileError) {
    await authAdmin.auth.admin.deleteUser(authData.user.id)
    return { error: "Erro ao vincular perfil." }
  }

  await applyPasswordChange(
    supabase,
    authData.user.id,
    input.companyId,
    input.password,
    policy,
  )

  return { userId: authData.user.id }
}

export async function getSupplierPortalUser(
  companyId: string,
  supplierId: string,
  userId: string,
) {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, status, is_supplier_admin, supplier_id, profile_type")
    .eq("id", userId)
    .eq("company_id", companyId)
    .eq("supplier_id", supplierId)
    .eq("profile_type", "supplier")
    .maybeSingle()

  return data
}

export async function updateSupplierPortalUserEmail(
  userId: string,
  email: string,
): Promise<{ error?: string }> {
  const normalized = normalizeImportedEmail(email)
  if (!normalized) return { error: "E-mail inválido." }

  const authAdmin = authAdminClient()
  const { error } = await authAdmin.auth.admin.updateUserById(userId, {
    email: normalized,
    email_confirm: true,
  })
  if (error) return { error: error.message }
  return {}
}

export async function updateSupplierPortalUserProfile(
  userId: string,
  patch: { fullName?: string; status?: "active" | "inactive" },
): Promise<{ error?: string }> {
  const supabase = createServiceRoleClient()
  const payload: Record<string, string> = {}
  if (patch.fullName?.trim()) payload.full_name = patch.fullName.trim()
  if (patch.status) payload.status = patch.status

  if (Object.keys(payload).length === 0) return {}

  const { error } = await supabase.from("profiles").update(payload).eq("id", userId)
  if (error) return { error: error.message }
  return {}
}

export async function resetSupplierPortalUserPassword(
  userId: string,
  companyId: string,
  newPassword: string,
): Promise<{ error?: string }> {
  const supabase = createServiceRoleClient()
  const policy = await loadPasswordPolicy(supabase, companyId)
  const passwordCheck = validatePasswordAgainstPolicy(newPassword, policy)
  if (!passwordCheck.ok) return { error: passwordCheck.error ?? "Senha inválida." }

  const authAdmin = authAdminClient()
  const { error } = await authAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  })
  if (error) return { error: error.message }

  await applyPasswordChange(supabase, userId, companyId, newPassword, policy)
  return {}
}

export async function cancelSupplierPortalUser(userId: string): Promise<{ error?: string }> {
  const authAdmin = authAdminClient()
  const { error } = await authAdmin.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }
  return {}
}
