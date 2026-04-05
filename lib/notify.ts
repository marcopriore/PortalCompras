import { createClient } from "@/lib/supabase/client"

export interface CreateNotificationParams {
  userId: string
  companyId: string
  type: string
  title: string
  body?: string
  entity?: string
  entityId?: string
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    const supabase = createClient()
    const { error } = await supabase.from("notifications").insert({
      user_id: params.userId,
      company_id: params.companyId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      entity: params.entity ?? null,
      entity_id: params.entityId ?? null,
    })
    if (error) console.error("createNotification error:", error)
  } catch (e) {
    console.error("createNotification error:", e)
  }
}
