import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"

export type NotificationRow = {
  id: string
  type: string
  title: string
  body: string | null
  entity: string | null
  entity_id: string | null
  read: boolean
  created_at: string
}

export async function fetchNotifications(
  supabase: SupabaseClient,
  companyId: string | null | undefined,
  userId: string,
): Promise<NotificationRow[]> {
  let query = supabase
    .from("notifications")
    .select("id, type, title, body, entity, entity_id, read, created_at")
    .order("created_at", { ascending: false })
    .limit(20)

  if (companyId) {
    query = query.eq("company_id", companyId)
  }

  const { data, error } = await query
  if (error) {
    throw error
  }
  return (data ?? []) as NotificationRow[]
}

export function notificationsQueryOptions(
  companyId: string | null | undefined,
  userId: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.notifications(companyId ?? "", userId),
    queryFn: () => fetchNotifications(supabaseFactory(), companyId, userId),
    enabled: Boolean(userId),
    refetchInterval: 60_000,
  })
}