"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

type PasswordExpiryGuardProps = {
  portal: "comprador" | "fornecedor"
  children: React.ReactNode
}

const EXEMPT_SUFFIXES = ["/alterar-senha", "/login", "/cadastro"]

/** Evita refetch em Strict Mode / remounts na mesma aba. */
const passwordStatusCache = new Map<
  string,
  Promise<{ expired?: boolean } | null>
>()

function fetchPasswordStatus(portal: string): Promise<{ expired?: boolean } | null> {
  const cached = passwordStatusCache.get(portal)
  if (cached) return cached

  const promise = fetch("/api/auth/password-status")
    .then(async (res) => {
      if (!res.ok) return null
      return (await res.json()) as { expired?: boolean }
    })
    .catch(() => null)

  passwordStatusCache.set(portal, promise)
  return promise
}

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
    void fetchPasswordStatus(portal).then((data) => {
      if (cancelled) return
      if (data?.expired) {
        router.replace(`${base}/alterar-senha`)
        return
      }
      setChecked(true)
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
