import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"

export type SolicitanteNotifForm = {
  new_requisition_bell: boolean
  new_requisition_email: boolean
  requisition_approval_bell: boolean
  requisition_approval_email: boolean
}

export type SolicitanteSettingsDto = {
  userId: string
  companyId: string | null
  authEmail: string
  profileForm: {
    full_name: string
    job_title: string
    department: string
    phone: string
    avatar_url: string | null
  }
  notifForm: SolicitanteNotifForm
  notifExists: boolean
  mfaEnabled: boolean
  mfaFactorId: string | null
}

export async function fetchSolicitanteSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<SolicitanteSettingsDto> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error("unauthenticated")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, full_name, company_id, profile_type, job_title, department, phone, avatar_url, is_superadmin, roles, role",
    )
    .eq("id", user.id)
    .single()

  if (!profile) {
    throw new Error("profile_not_found")
  }

  const roles = (profile.roles as string[] | null) ?? []
  const isAdmin =
    Boolean(profile.is_superadmin) ||
    profile.role === "admin" ||
    roles.includes("admin")
  if (profile.profile_type !== "requester" && !isAdmin) {
    throw new Error("forbidden")
  }

  let notifForm: SolicitanteNotifForm = {
    new_requisition_bell: true,
    new_requisition_email: false,
    requisition_approval_bell: true,
    requisition_approval_email: false,
  }
  let notifExists = false

  if (profile.company_id) {
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select(
        "new_requisition_bell, new_requisition_email, requisition_approval_bell, requisition_approval_email",
      )
      .eq("user_id", user.id)
      .eq("company_id", profile.company_id)
      .maybeSingle()

    if (prefs) {
      notifExists = true
      notifForm = {
        new_requisition_bell: Boolean(prefs.new_requisition_bell),
        new_requisition_email: Boolean(prefs.new_requisition_email),
        requisition_approval_bell: Boolean(prefs.requisition_approval_bell),
        requisition_approval_email: Boolean(prefs.requisition_approval_email),
      }
    }
  }

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
    userId: user.id,
    companyId: profile.company_id as string | null,
    authEmail: user.email ?? "",
    profileForm: {
      full_name: profile.full_name ?? "",
      job_title: profile.job_title ?? "",
      department: profile.department ?? "",
      phone: profile.phone ?? "",
      avatar_url: profile.avatar_url ?? null,
    },
    notifForm,
    notifExists,
    mfaEnabled: Boolean(totpFactor),
    mfaFactorId: totpFactor?.id ?? null,
  }
}

export function solicitanteSettingsQueryOptions(
  companyId: string | null,
  userId: string,
  supabaseFactory: SupabaseClientFactory,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: queryKeys.solicitanteSettings(companyId ?? "", userId),
    queryFn: () => fetchSolicitanteSettings(supabaseFactory(), userId),
    enabled: enabled && Boolean(userId),
  })
}