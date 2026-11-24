import { createClient } from "@/lib/supabase/client"
import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  notificationsQueryOptions,
  type NotificationRow,
} from "@/lib/queries/notifications"
import { queryKeys } from "@/lib/queries/keys"
import { useUser } from "@/lib/hooks/useUser"

export type Notification = NotificationRow

export function useNotifications(activeCompanyId?: string | null) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { userId } = useUser()

  const notificationsQuery = useQuery({
    ...notificationsQueryOptions(activeCompanyId, userId ?? "", () => supabase),
    enabled: Boolean(userId),
  })

  const notifications = notificationsQuery.data ?? []
  const loading = notificationsQuery.isLoading

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    await queryClient.invalidateQueries({
      queryKey: queryKeys.notifications(activeCompanyId ?? "", userId),
    })
  }, [activeCompanyId, queryClient, userId])

  const markAsRead = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id)
      if (error) return
      if (!userId) return
      queryClient.setQueryData<NotificationRow[]>(
        queryKeys.notifications(activeCompanyId ?? "", userId),
        (prev) => prev?.map((n) => (n.id === id ? { ...n, read: true } : n)) ?? [],
      )
    },
    [activeCompanyId, queryClient, supabase, userId],
  )

  const markAllAsRead = useCallback(async () => {
    let query = supabase.from("notifications").update({ read: true }).eq("read", false)
    if (activeCompanyId) {
      query = query.eq("company_id", activeCompanyId)
    }
    const { error } = await query
    if (error) return
    if (!userId) return
    queryClient.setQueryData<NotificationRow[]>(
      queryKeys.notifications(activeCompanyId ?? "", userId),
      (prev) => prev?.map((n) => ({ ...n, read: true })) ?? [],
    )
  }, [activeCompanyId, queryClient, supabase, userId])

  const unreadCount = notifications.filter((n) => !n.read).length

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    fetchNotifications,
  }
}