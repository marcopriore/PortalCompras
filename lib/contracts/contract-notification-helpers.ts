import type { SupabaseClient } from "@supabase/supabase-js"
import { createNotification } from "@/lib/notify"
import { sendEmail } from "@/lib/email/send-email"
import {
  templateContractExpiringSoon,
  templateContractExpired,
} from "@/lib/email/templates"

export type ContractBuyerRecipient = {
  id: string
  full_name: string | null
}

export async function getContractBuyerRecipients(
  service: SupabaseClient,
  companyId: string,
  createdBy?: string | null,
  limit = 10,
): Promise<ContractBuyerRecipient[]> {
  const recipientMap = new Map<string, ContractBuyerRecipient>()

  const { data: tenantProfiles, error: tenantErr } = await service
    .from("profiles")
    .select("id, full_name, profile_type, roles")
    .eq("company_id", companyId)
    .eq("status", "active")

  if (tenantErr) {
    console.error("getContractBuyerRecipients:", tenantErr)
  }

  for (const profile of tenantProfiles ?? []) {
    const roles = Array.isArray(profile.roles) ? profile.roles : []
    const isBuyerSide =
      profile.profile_type === "buyer" || roles.includes("admin")
    if (isBuyerSide) {
      recipientMap.set(profile.id, {
        id: profile.id,
        full_name: profile.full_name,
      })
    }
  }

  if (createdBy) {
    const { data: creator } = await service
      .from("profiles")
      .select("id, full_name")
      .eq("id", createdBy)
      .maybeSingle()
    if (creator?.id) {
      recipientMap.set(creator.id, {
        id: creator.id,
        full_name: creator.full_name,
      })
    }
  }

  return Array.from(recipientMap.values()).slice(0, limit)
}

export async function getSupplierName(
  service: SupabaseClient,
  supplierId: string | null,
): Promise<string> {
  if (!supplierId) return "Fornecedor"
  const { data } = await service
    .from("suppliers")
    .select("name")
    .eq("id", supplierId)
    .maybeSingle()
  return data?.name ?? "Fornecedor"
}

async function sendBuyerEmailIfWanted(
  service: SupabaseClient,
  userId: string,
  companyId: string,
  prefKey: "order_approved_email" | "order_refused_email",
  subject: string,
  html: string,
) {
  const { data: prefs } = await service
    .from("notification_preferences")
    .select(prefKey)
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle()

  const wantsEmail =
    (prefs as Record<string, boolean> | null)?.[prefKey] ?? false
  if (!wantsEmail) return

  const { data: authData } = await service.auth.admin.getUserById(userId)
  const toEmail = authData.user?.email
  if (toEmail) {
    await sendEmail({ to: toEmail, subject, html })
  }
}

function daysBetween(from: Date, to: Date): number {
  const start = new Date(from)
  start.setHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

export async function shouldRunScheduledJob(
  service: SupabaseClient,
  jobKey: string,
  intervalHours: number,
): Promise<boolean> {
  const { data } = await service
    .from("scheduled_job_runs")
    .select("last_run_at")
    .eq("job_key", jobKey)
    .maybeSingle()

  if (!data?.last_run_at) return true

  const lastRun = new Date(data.last_run_at).getTime()
  const elapsedMs = Date.now() - lastRun
  return elapsedMs >= intervalHours * 60 * 60 * 1000
}

export async function markScheduledJobRun(
  service: SupabaseClient,
  jobKey: string,
) {
  await service.from("scheduled_job_runs").upsert(
    {
      job_key: jobKey,
      last_run_at: new Date().toISOString(),
    },
    { onConflict: "job_key" },
  )
}

export async function notifyExpiredContracts(
  service: SupabaseClient,
): Promise<number> {
  const { data: contracts, error } = await service
    .from("contracts")
    .select("id, company_id, code, title, end_date, supplier_id, created_by")
    .eq("status", "expired")
    .not("end_date", "is", null)

  if (error) {
    console.error("notifyExpiredContracts:", error)
    return 0
  }

  let notified = 0

  for (const contract of contracts ?? []) {
    const { data: existing } = await service
      .from("notifications")
      .select("id")
      .eq("entity_id", contract.id)
      .eq("type", "contract.expired")
      .limit(1)

    if (existing && existing.length > 0) continue

    const companyId = contract.company_id as string
    const supplierName = await getSupplierName(
      service,
      contract.supplier_id as string | null,
    )
    const endDate = String(contract.end_date).slice(0, 10)
    const recipients = await getContractBuyerRecipients(
      service,
      companyId,
      contract.created_by as string | null,
    )

    if (recipients.length === 0) {
      console.error("contract.expired notify: no recipients", contract.id)
      continue
    }

    for (const buyer of recipients) {
      const inserted = await createNotification(
        {
          userId: buyer.id,
          companyId,
          type: "contract.expired",
          title: "Contrato vencido",
          body: `${contract.code} venceu em ${endDate}`,
          entity: "contract",
          entityId: contract.id,
        },
        service,
      )

      if (!inserted) continue

      const { subject, html } = templateContractExpired({
        buyerName: buyer.full_name ?? "Comprador",
        supplierName,
        contractCode: contract.code ?? "",
        contractTitle: contract.title ?? "",
        endDate,
      })

      await sendBuyerEmailIfWanted(
        service,
        buyer.id,
        companyId,
        "order_approved_email",
        subject,
        html,
      )
      notified++
    }
  }

  return notified
}

export async function notifyExpiringSoonContracts(
  service: SupabaseClient,
): Promise<{ checked: number; notified: number }> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in30 = new Date(today)
  in30.setDate(in30.getDate() + 30)

  const todayStr = today.toISOString().slice(0, 10)
  const in30Str = in30.toISOString().slice(0, 10)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: contracts, error } = await service
    .from("contracts")
    .select(
      `
      id,
      company_id,
      code,
      title,
      end_date,
      created_by,
      supplier_id,
      suppliers(name)
    `,
    )
    .eq("status", "active")
    .not("end_date", "is", null)
    .gte("end_date", todayStr)
    .lte("end_date", in30Str)

  if (error) {
    console.error("notifyExpiringSoonContracts:", error)
    return { checked: 0, notified: 0 }
  }

  let notified = 0
  const checked = contracts?.length ?? 0

  for (const contract of contracts ?? []) {
    const { data: recent } = await service
      .from("notifications")
      .select("id")
      .eq("entity_id", contract.id)
      .eq("type", "contract.expiring_soon")
      .gt("created_at", sevenDaysAgo.toISOString())
      .limit(1)

    if (recent && recent.length > 0) continue

    const companyId = contract.company_id as string
    const supplierName =
      (contract.suppliers as { name?: string } | null)?.name ?? "Fornecedor"
    const endDate = String(contract.end_date).slice(0, 10)
    const daysRemaining = daysBetween(today, new Date(endDate))
    const recipients = await getContractBuyerRecipients(
      service,
      companyId,
      contract.created_by as string | null,
      5,
    )

    for (const buyer of recipients) {
      const inserted = await createNotification(
        {
          userId: buyer.id,
          companyId,
          type: "contract.expiring_soon",
          title: "Contrato próximo do vencimento",
          body: `${contract.code} vence em ${daysRemaining} dia(s) — ${endDate}`,
          entity: "contract",
          entityId: contract.id,
        },
        service,
      )

      if (!inserted) continue

      const { subject, html } = templateContractExpiringSoon({
        buyerName: buyer.full_name ?? "Comprador",
        supplierName,
        contractCode: contract.code ?? "",
        contractTitle: contract.title ?? "",
        endDate,
        daysRemaining,
      })

      await sendBuyerEmailIfWanted(
        service,
        buyer.id,
        companyId,
        "order_approved_email",
        subject,
        html,
      )
      notified++
    }
  }

  return { checked, notified }
}
