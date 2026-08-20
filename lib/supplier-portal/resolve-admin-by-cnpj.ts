import { createClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { formatCnpj, normalizeCnpj } from "@/lib/utils/cnpj"

export type ResolveSupplierAdminByCnpjResult =
  | { email: string; userId: string; companyId: string; supplierId: string | null }
  | { error: string; status: number; multiple?: boolean; options?: Array<{ email: string; companyName: string }> }

function authAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function emailForUserId(userId: string): Promise<string | null> {
  const { data } = await authAdmin().auth.admin.getUserById(userId)
  return data.user?.email ?? null
}

/**
 * Resolve administrador do portal fornecedor pelo CNPJ.
 * Compara sempre com dígitos normalizados (aceita login_cnpj / suppliers.cnpj com ou sem máscara).
 * Se achar admin com login_cnpj inconsistente, corrige para só dígitos.
 */
export async function resolveSupplierAdminByCnpj(
  rawCnpj: string,
): Promise<ResolveSupplierAdminByCnpjResult> {
  const cnpjDigits = normalizeCnpj(rawCnpj)
  if (cnpjDigits.length !== 14) {
    return { error: "CNPJ inválido. Informe os 14 dígitos.", status: 400 }
  }

  const service = createServiceRoleClient()
  const formatted = formatCnpj(cnpjDigits)

  // 1) Tentativa rápida por valor exato (dígitos ou máscara)
  const exactMatches: Array<{
    id: string
    company_id: string
    supplier_id: string | null
    login_cnpj: string | null
  }> = []

  for (const value of [cnpjDigits, formatted]) {
    const { data } = await service
      .from("profiles")
      .select("id, company_id, supplier_id, login_cnpj")
      .eq("profile_type", "supplier")
      .eq("is_supplier_admin", true)
      .eq("status", "active")
      .eq("login_cnpj", value)
    for (const row of data ?? []) {
      if (!exactMatches.some((m) => m.id === row.id)) exactMatches.push(row)
    }
  }

  let admins = exactMatches

  // 2) Fallback: todos os admins com login_cnpj e compara normalizado
  if (admins.length === 0) {
    const { data: allAdmins, error } = await service
      .from("profiles")
      .select("id, company_id, supplier_id, login_cnpj")
      .eq("profile_type", "supplier")
      .eq("is_supplier_admin", true)
      .eq("status", "active")
      .not("login_cnpj", "is", null)

    if (error) {
      console.error("[resolveSupplierAdminByCnpj] profiles:", error.message)
    }

    admins = (allAdmins ?? []).filter(
      (p) => normalizeCnpj(p.login_cnpj) === cnpjDigits,
    )
  }

  // 3) Fallback: suppliers.cnpj → perfil admin do fornecedor
  if (admins.length === 0) {
    const { data: suppliers, error } = await service
      .from("suppliers")
      .select("id, company_id, cnpj, status")

    if (error) {
      console.error("[resolveSupplierAdminByCnpj] suppliers:", error.message)
    }

    const matchedSuppliers = (suppliers ?? []).filter(
      (s) =>
        (s.status == null || s.status === "active") &&
        normalizeCnpj(s.cnpj) === cnpjDigits,
    )

    if (matchedSuppliers.length === 0) {
      return {
        error: "CNPJ não encontrado ou administrador inativo.",
        status: 404,
      }
    }

    const fromSuppliers: typeof admins = []
    for (const s of matchedSuppliers) {
      const { data: admin } = await service
        .from("profiles")
        .select("id, company_id, supplier_id, login_cnpj")
        .eq("company_id", s.company_id)
        .eq("supplier_id", s.id)
        .eq("profile_type", "supplier")
        .eq("is_supplier_admin", true)
        .eq("status", "active")
        .maybeSingle()
      if (admin && !fromSuppliers.some((a) => a.id === admin.id)) {
        fromSuppliers.push(admin)
      }
    }

    if (fromSuppliers.length === 0) {
      return {
        error:
          "Fornecedor encontrado, mas sem administrador ativo no portal. Conclua o convite ou entre com e-mail.",
        status: 404,
      }
    }
    admins = fromSuppliers
  }

  if (admins.length > 1) {
    const options = await Promise.all(
      admins.map(async (p) => {
        const email = (await emailForUserId(p.id)) ?? ""
        const { data: company } = await service
          .from("companies")
          .select("name")
          .eq("id", p.company_id)
          .maybeSingle()
        return {
          email,
          companyName: company?.name ?? "Comprador",
        }
      }),
    )
    return {
      error: "CNPJ vinculado a vários compradores. Selecione a conta ou use o e-mail.",
      status: 400,
      multiple: true,
      options: options.filter((o) => o.email),
    }
  }

  const admin = admins[0]!
  const email = await emailForUserId(admin.id)
  if (!email) {
    return {
      error: "Administrador sem e-mail de autenticação. Contate o suporte.",
      status: 404,
    }
  }

  // Corrige login_cnpj para dígitos (garante login/reset futuros)
  if (normalizeCnpj(admin.login_cnpj) !== cnpjDigits || admin.login_cnpj !== cnpjDigits) {
    await service
      .from("profiles")
      .update({ login_cnpj: cnpjDigits })
      .eq("id", admin.id)
  }

  return {
    email,
    userId: admin.id,
    companyId: admin.company_id,
    supplierId: admin.supplier_id,
  }
}
