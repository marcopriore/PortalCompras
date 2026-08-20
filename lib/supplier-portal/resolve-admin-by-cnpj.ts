import { createClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { normalizeCnpj } from "@/lib/utils/cnpj"

export type ResolveSupplierAdminByCnpjResult =
  | { email: string; userId: string; companyId: string; supplierId: string | null }
  | {
      error: string
      status: number
      multiple?: boolean
      options?: Array<{ email: string; companyName: string }>
    }

type AdminRow = {
  id: string
  company_id: string
  supplier_id: string | null
  login_cnpj: string | null
}

function authAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function emailForUserId(userId: string): Promise<string | null> {
  const { data, error } = await authAdmin().auth.admin.getUserById(userId)
  if (error) {
    console.error("[resolveSupplierAdminByCnpj] getUserById:", error.message)
    return null
  }
  return data.user?.email ?? null
}

async function findAdminsViaRpc(
  service: ReturnType<typeof createServiceRoleClient>,
  cnpjDigits: string,
): Promise<AdminRow[]> {
  const { data, error } = await service.rpc("resolve_supplier_admin_ids_by_cnpj", {
    p_cnpj: cnpjDigits,
  })

  if (error) {
    console.error("[resolveSupplierAdminByCnpj] rpc:", error.message)
    return []
  }

  return (data as AdminRow[] | null) ?? []
}

/** Fallback sem RPC (caso migration ainda não aplicada). */
async function findAdminsViaClientFilter(
  service: ReturnType<typeof createServiceRoleClient>,
  cnpjDigits: string,
): Promise<AdminRow[]> {
  const { data: byLogin, error: e1 } = await service
    .from("profiles")
    .select("id, company_id, supplier_id, login_cnpj")
    .eq("profile_type", "supplier")
    .eq("is_supplier_admin", true)
    .eq("status", "active")
    .eq("login_cnpj", cnpjDigits)

  if (e1) console.error("[resolveSupplierAdminByCnpj] eq login_cnpj:", e1.message)
  if (byLogin?.length) return byLogin

  const { data: admins, error: e2 } = await service
    .from("profiles")
    .select("id, company_id, supplier_id, login_cnpj")
    .eq("profile_type", "supplier")
    .eq("is_supplier_admin", true)
    .eq("status", "active")

  if (e2) console.error("[resolveSupplierAdminByCnpj] list admins:", e2.message)

  const matched = (admins ?? []).filter(
    (p) => normalizeCnpj(p.login_cnpj) === cnpjDigits,
  )
  if (matched.length) return matched

  const { data: suppliers, error: e3 } = await service
    .from("suppliers")
    .select("id, company_id, cnpj, status")

  if (e3) console.error("[resolveSupplierAdminByCnpj] suppliers:", e3.message)

  const matchedSuppliers = (suppliers ?? []).filter(
    (s) =>
      (s.status == null || s.status === "active") &&
      normalizeCnpj(s.cnpj) === cnpjDigits,
  )

  const fromSuppliers: AdminRow[] = []
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
  return fromSuppliers
}

/**
 * Resolve administrador do portal fornecedor pelo CNPJ.
 * Preferência: RPC SQL (mesma lógica do SQL Editor). Fallback: queries JS.
 */
export async function resolveSupplierAdminByCnpj(
  rawCnpj: string,
): Promise<ResolveSupplierAdminByCnpjResult> {
  const cnpjDigits = normalizeCnpj(rawCnpj)
  if (cnpjDigits.length !== 14) {
    return { error: "CNPJ inválido. Informe os 14 dígitos.", status: 400 }
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[resolveSupplierAdminByCnpj] SUPABASE_SERVICE_ROLE_KEY ausente")
    return {
      error: "Configuração do servidor incompleta (service role). Contate o suporte.",
      status: 500,
    }
  }

  const service = createServiceRoleClient()

  let admins = await findAdminsViaRpc(service, cnpjDigits)
  if (admins.length === 0) {
    admins = await findAdminsViaClientFilter(service, cnpjDigits)
  }

  if (admins.length === 0) {
    return {
      error: "CNPJ não encontrado ou administrador inativo.",
      status: 404,
    }
  }

  // dedupe
  admins = admins.filter(
    (a, i, arr) => arr.findIndex((b) => b.id === a.id) === i,
  )

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
      status: 409,
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

  if (admin.login_cnpj !== cnpjDigits) {
    await service.from("profiles").update({ login_cnpj: cnpjDigits }).eq("id", admin.id)
  }

  return {
    email,
    userId: admin.id,
    companyId: admin.company_id,
    supplierId: admin.supplier_id,
  }
}
