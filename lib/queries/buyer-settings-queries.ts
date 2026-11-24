import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"

export type BuyerSettingsInitialDto = {
  authEmail: string | null
  profileForm: {
    full_name: string
    job_title: string
    department: string
    phone: string
    avatar_url: string | null
  }
  companyForm: {
    name: string
    trade_name: string
    cnpj: string
    state_reg: string
    address: string
    city: string
    state: string
    zip_code: string
    logo_url: string | null
  }
  notifExists: boolean
  notifRow: Record<string, unknown> | null
  mfaEnabled: boolean
  mfaFactorId: string | null
}

export async function fetchBuyerSettingsInitial(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
): Promise<BuyerSettingsInitialDto> {
  const { data: authUser } = await supabase.auth.getUser()

  const [profileRes, companyRes, notifRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("companies").select("*").eq("id", companyId).single(),
    supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .maybeSingle(),
  ])

  const profile = profileRes.data as Record<string, unknown> | null
  const company = companyRes.data as Record<string, unknown> | null
  const notif = notifRes.data as Record<string, unknown> | null

  const { data: factorsData } = await supabase.auth.mfa.listFactors()
  const fd = factorsData as {
    totp?: { id: string; factor_type?: string; status?: string }[]
    all?: { id: string; factor_type?: string; status?: string }[]
  } | null
  const factorList =
    fd?.totp && fd.totp.length > 0 ? fd.totp : (fd?.all ?? [])
  const totpFactor = factorList.find(
    (f) =>
      String(f.factor_type ?? "").toLowerCase() === "totp" &&
      f.status === "verified",
  )

  return {
    authEmail: authUser?.user?.email ?? null,
    profileForm: {
      full_name: (profile?.full_name as string) ?? "",
      job_title: (profile?.job_title as string) ?? "",
      department: (profile?.department as string) ?? "",
      phone: (profile?.phone as string) ?? "",
      avatar_url: (profile?.avatar_url as string | null) ?? null,
    },
    companyForm: {
      name: (company?.name as string) ?? "",
      trade_name: (company?.trade_name as string) ?? "",
      cnpj: company?.cnpj ? String(company.cnpj) : "",
      state_reg: (company?.state_reg as string) ?? "",
      address: (company?.address as string) ?? "",
      city: (company?.city as string) ?? "",
      state: (company?.state as string) ?? "",
      zip_code: (company?.zip_code as string) ?? "",
      logo_url: (company?.logo_url as string | null) ?? null,
    },
    notifExists: Boolean(notif),
    notifRow: notif,
    mfaEnabled: Boolean(totpFactor),
    mfaFactorId: totpFactor?.id ?? null,
  }
}

export function buyerSettingsInitialQueryOptions(
  companyId: string,
  userId: string,
  supabaseFactory: SupabaseClientFactory,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: queryKeys.buyerSettingsInitial(companyId, userId),
    queryFn: () => fetchBuyerSettingsInitial(supabaseFactory(), companyId, userId),
    enabled: enabled && Boolean(companyId && userId),
  })
}

export type ApprovalRuleRow = {
  id: string
  flow: string
  cost_center: string | null
  category: string | null
  min_value: number | null
  max_value: number | null
  approver_id: string | null
  approver_name: string | null
}

export type BuyerApprovalsConfigDto = {
  approvalRequisitionEnabled: boolean
  approvalOrderEnabled: boolean
  approvalCatalogEnabled: boolean
  rules: ApprovalRuleRow[]
}

export async function fetchBuyerApprovalsConfig(
  supabase: SupabaseClient,
  companyId: string,
): Promise<BuyerApprovalsConfigDto> {
  const [tfRes, levelsRes] = await Promise.all([
    supabase
      .from("tenant_features")
      .select("feature_key, enabled")
      .eq("company_id", companyId)
      .in("feature_key", [
        "approval_requisition",
        "approval_order",
        "approval_catalog_order",
      ]),
    supabase
      .from("approval_levels")
      .select(
        "id, flow, cost_center, category, min_value, max_value, approver_id, approver_name",
      )
      .eq("company_id", companyId),
  ])

  let approvalRequisitionEnabled = false
  let approvalOrderEnabled = false
  let approvalCatalogEnabled = false

  const tfData = (tfRes.data ?? []) as { feature_key: string; enabled: boolean }[]
  for (const row of tfData) {
    if (row.feature_key === "approval_requisition") {
      approvalRequisitionEnabled = Boolean(row.enabled)
    }
    if (row.feature_key === "approval_order") {
      approvalOrderEnabled = Boolean(row.enabled)
    }
    if (row.feature_key === "approval_catalog_order") {
      approvalCatalogEnabled = Boolean(row.enabled)
    }
  }

  const levels = ((levelsRes.data ?? []) as ApprovalRuleRow[]).map((r) => ({
    ...r,
    flow: (r.flow ?? "requisition") as string,
  }))

  return {
    approvalRequisitionEnabled,
    approvalOrderEnabled,
    approvalCatalogEnabled,
    rules: levels,
  }
}

export function buyerApprovalsConfigQueryOptions(
  companyId: string,
  supabaseFactory: SupabaseClientFactory,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: queryKeys.buyerApprovalsConfig(companyId),
    queryFn: () => fetchBuyerApprovalsConfig(supabaseFactory(), companyId),
    enabled: enabled && Boolean(companyId),
  })
}

export type ApproverProfile = {
  id: string
  full_name: string | null
  role: string | null
  roles: string[] | null
}

export type BuyerApproversDto = {
  requisition: ApproverProfile[]
  order: ApproverProfile[]
}

export async function fetchBuyerApprovers(
  supabase: SupabaseClient,
  companyId: string,
): Promise<BuyerApproversDto> {
  const [reqRes, orderRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, roles")
      .eq("company_id", companyId)
      .overlaps("roles", ["approver_requisition", "admin", "manager"]),
    supabase
      .from("profiles")
      .select("id, full_name, role, roles")
      .eq("company_id", companyId)
      .overlaps("roles", ["approver_order", "admin", "manager"]),
  ])

  return {
    requisition: ((reqRes.data ?? []) as ApproverProfile[]) ?? [],
    order: ((orderRes.data ?? []) as ApproverProfile[]) ?? [],
  }
}

export function buyerApproversQueryOptions(
  companyId: string,
  supabaseFactory: SupabaseClientFactory,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: queryKeys.buyerApprovers(companyId),
    queryFn: () => fetchBuyerApprovers(supabaseFactory(), companyId),
    enabled: enabled && Boolean(companyId),
  })
}

export type PaymentConditionAdminRow = {
  id: string
  code: string
  description: string
  active: boolean
  [key: string]: unknown
}

export async function fetchBuyerPaymentConditionsAll(
  supabase: SupabaseClient,
  companyId: string,
): Promise<PaymentConditionAdminRow[]> {
  const { data, error } = await supabase
    .from("payment_conditions")
    .select("*")
    .eq("company_id", companyId)
    .order("code", { ascending: true })

  if (error) {
    throw error
  }
  return (data ?? []) as PaymentConditionAdminRow[]
}

export function buyerPaymentConditionsAllQueryOptions(
  companyId: string,
  supabaseFactory: SupabaseClientFactory,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: queryKeys.buyerPaymentConditionsAll(companyId),
    queryFn: () => fetchBuyerPaymentConditionsAll(supabaseFactory(), companyId),
    enabled: enabled && Boolean(companyId),
  })
}

export type SupplierTermActive = {
  id: string
  title: string
  content: string
  version: string
  version_date: string
}

export async function fetchSupplierTermsActive(
  companyId: string,
): Promise<SupplierTermActive | null> {
  const res = await fetch(`/api/supplier-terms?company_id=${companyId}`)
  const json = (await res.json()) as { term: SupplierTermActive | null }
  return json.term ?? null
}

export function supplierTermsActiveQueryOptions(
  companyId: string,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: queryKeys.supplierTermsActive(companyId),
    queryFn: () => fetchSupplierTermsActive(companyId),
    enabled: enabled && Boolean(companyId),
  })
}