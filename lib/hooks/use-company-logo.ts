"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { companyLogoQueryOptions } from "@/lib/queries/company-logo"
import { queryKeys } from "@/lib/queries/keys"

export const COMPANY_LOGO_UPDATED_EVENT = "valore:company-logo-updated"

type CompanyLogoUpdatedDetail = {
  companyId: string
  logoUrl: string | null
}

/** Dispara atualização do logo no header sem reload completo. */
export function notifyCompanyLogoUpdated(companyId: string, logoUrl: string | null) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<CompanyLogoUpdatedDetail>(COMPANY_LOGO_UPDATED_EVENT, {
      detail: { companyId, logoUrl },
    }),
  )
}

/**
 * Logo público do tenant ativo (`companies.logo_url`).
 * Retorna null se não houver logo — o header não deve exibir placeholder.
 */
export function useCompanyLogo(): string | null {
  const { companyId } = useUser()
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    ...companyLogoQueryOptions(companyId ?? "", () => supabase),
    enabled: Boolean(companyId),
  })

  React.useEffect(() => {
    if (!companyId) return

    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<CompanyLogoUpdatedDetail>).detail
      if (!detail || detail.companyId !== companyId) return
      const next = detail.logoUrl?.trim() ?? ""
      const logoUrl = next.length > 0 ? next : null
      queryClient.setQueryData(queryKeys.companyLogo(companyId), logoUrl)
    }

    window.addEventListener(COMPANY_LOGO_UPDATED_EVENT, onUpdated)
    return () => {
      window.removeEventListener(COMPANY_LOGO_UPDATED_EVENT, onUpdated)
    }
  }, [companyId, queryClient])

  return query.data ?? null
}