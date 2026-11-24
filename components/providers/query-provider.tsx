"use client"

import * as React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { makeQueryClient } from "@/lib/query/make-query-client"

function ScopedQueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => makeQueryClient())
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

/**
 * Remonta o QueryClient quando muda user ou tenant — descarta cache inteiro
 * em login/logout/troca de empresa.
 */
export function QueryProvider({
  children,
  scopeKey,
}: {
  children: React.ReactNode
  /** Tipicamente `${userId}:${companyId}` */
  scopeKey: string
}) {
  return <ScopedQueryProvider key={scopeKey}>{children}</ScopedQueryProvider>
}
