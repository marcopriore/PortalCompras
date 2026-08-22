"use client"

import * as React from "react"
import { PageLoading } from "@/components/ui/page-loading"

type AsyncActionOptions = {
  label?: string
}

/**
 * Executa ações assíncronas com overlay de carregamento (ex.: salvar formulário).
 */
export function useAsyncAction(options: AsyncActionOptions = {}) {
  const [busy, setBusy] = React.useState(false)
  const label = options.label ?? "Carregando..."

  const run = React.useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
      if (busy) return undefined
      setBusy(true)
      try {
        return await action()
      } finally {
        setBusy(false)
      }
    },
    [busy],
  )

  const overlay = busy ? <PageLoading overlay label={label} /> : null

  return { busy, run, overlay }
}
