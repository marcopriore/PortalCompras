"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

export function CompradorPermissionToast() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const shownRef = React.useRef(false)

  React.useEffect(() => {
    if (searchParams.get("error") !== "sem_permissao" || shownRef.current) {
      return
    }
    shownRef.current = true
    toast.error("Você não tem permissão para acessar esta área.")

    const params = new URLSearchParams(searchParams.toString())
    params.delete("error")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [pathname, router, searchParams])

  return null
}
