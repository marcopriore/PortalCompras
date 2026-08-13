"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

type PasswordExpiryGuardProps = {
  portal: "comprador" | "fornecedor"
  children: React.ReactNode
}

const EXEMPT_SUFFIXES = ["/alterar-senha", "/login", "/cadastro"]

export function PasswordExpiryGuard({ portal, children }: PasswordExpiryGuardProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = React.useState(false)

  React.useEffect(() => {
    const base = `/${portal}`
    const isExempt = EXEMPT_SUFFIXES.some((suffix) => pathname.endsWith(suffix))
    if (isExempt) {
      setChecked(true)
      return
    }

    let cancelled = false
    void fetch("/api/auth/password-status")
      .then(async (res) => {
        if (!res.ok) return null
        return (await res.json()) as { expired?: boolean }
      })
      .then((data) => {
        if (cancelled) return
        if (data?.expired) {
          router.replace(`${base}/alterar-senha`)
          return
        }
        setChecked(true)
      })
      .catch(() => {
        if (!cancelled) setChecked(true)
      })

    return () => {
      cancelled = true
    }
  }, [pathname, portal, router])

  if (!checked) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Verificando segurança…
      </div>
    )
  }

  return <>{children}</>
}
