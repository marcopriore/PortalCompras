'use client'

import * as React from 'react'

type TenantContextValue = {
  companyId: string | null
  setCompanyId: (id: string) => void
}

const TenantContext = React.createContext<TenantContextValue>({
  companyId: null,
  setCompanyId: () => {},
})

export function TenantProvider({
  children,
  initialCompanyId,
}: {
  children: React.ReactNode
  initialCompanyId: string | null
}) {
  const [companyId, setCompanyIdState] = React.useState<string | null>(
    initialCompanyId
  )

  const setCompanyId = React.useCallback((id: string) => {
    document.cookie = `selected_company_id=${encodeURIComponent(id)}; path=/; SameSite=Lax`
    setCompanyIdState(id)
  }, [])

  return (
    <TenantContext.Provider value={{ companyId, setCompanyId }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  return React.useContext(TenantContext)
}
