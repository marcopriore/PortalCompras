"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"

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
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!companyId) {
      setLogoUrl(null)
      return
    }

    let cancelled = false
    const supabase = createClient()

    void (async () => {
      const { data } = await supabase
        .from("companies")
        .select("logo_url")
        .eq("id", companyId)
        .maybeSingle()

      if (cancelled) return
      const url = typeof data?.logo_url === "string" ? data.logo_url.trim() : ""
      setLogoUrl(url.length > 0 ? url : null)
    })()

    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<CompanyLogoUpdatedDetail>).detail
      if (!detail || detail.companyId !== companyId) return
      const next = detail.logoUrl?.trim() ?? ""
      setLogoUrl(next.length > 0 ? next : null)
    }

    window.addEventListener(COMPANY_LOGO_UPDATED_EVENT, onUpdated)
    return () => {
      cancelled = true
      window.removeEventListener(COMPANY_LOGO_UPDATED_EVENT, onUpdated)
    }
  }, [companyId])

  return logoUrl
}
