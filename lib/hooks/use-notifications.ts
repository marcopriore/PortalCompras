import { createClient } from "@/lib/supabase/client"
import { useState, useEffect, useCallback } from "react"

export type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  entity: string | null
  entity_id: string | null
  read: boolean
  created_at: string
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, entity, entity_id, read, created_at")
      .order("created_at", { ascending: false })
      .limit(20)

    setNotifications(data ?? [])
    setLoading(false)
  }, [])

  const markAsRead = useCallback(async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id)
    if (error) console.error("markAsRead:", error)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
  }, [])

  const markAllAsRead = useCallback(async () => {
    const supabase = createClient()
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("read", false)
    if (error) console.error("markAllAsRead:", error)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  useEffect(() => {
    void fetchNotifications()
    const timer = setInterval(() => void fetchNotifications(), 60000)
    return () => clearInterval(timer)
  }, [fetchNotifications])

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
