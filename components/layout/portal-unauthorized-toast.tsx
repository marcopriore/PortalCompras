"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

export function PortalUnauthorizedToast({ message }: { message: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const unauthorizedToastShown = React.useRef(false)

  React.useEffect(() => {
    if (searchParams.get("error") !== "unauthorized_portal" || unauthorizedToastShown.current) {
      return
    }
    unauthorizedToastShown.current = true
    toast.error(message)
    const params = new URLSearchParams(searchParams.toString())
    params.delete("error")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [message, pathname, router, searchParams])

  return null
}
