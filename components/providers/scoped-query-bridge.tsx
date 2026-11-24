"use client"

import * as React from "react"
import { useTenant } from "@/contexts/tenant-context"
import { QueryProvider } from "@/components/providers/query-provider"

/**
 * Remonta o QueryClient quando o tenant muda no client (cookie/selector),
 * sem depender de reload do Server Component.
 */
export function ScopedQueryBridge({
  userId,
  children,
}: {
  userId: string
  children: React.ReactNode
}) {
  const { companyId } = useTenant()
  const scopeKey = `${userId}:${companyId ?? "none"}`
  return <QueryProvider scopeKey={scopeKey}>{children}</QueryProvider>
}
