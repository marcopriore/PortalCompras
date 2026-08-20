"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { ChangePasswordForm } from "@/components/auth/change-password-form"
import { RecoveryPasswordForm } from "@/components/auth/recovery-password-form"

type Props = {
  portal: "comprador" | "fornecedor"
  loginHref: string
}

export function AlterarSenhaPageClient({ portal, loginHref }: Props) {
  const searchParams = useSearchParams()
  const isRecovery = searchParams.get("recovery") === "1"

  if (isRecovery) {
    return <RecoveryPasswordForm portal={portal} loginHref={loginHref} />
  }

  return <ChangePasswordForm portal={portal} forced />
}
