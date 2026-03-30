"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { FornecedorPortalShell } from "@/components/layout/fornecedor-portal-shell"

export default function FornecedorLayout({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname()

  const isPublicArea =
    pathname === "/fornecedor/login" ||
    pathname === "/fornecedor/cadastro" ||
    pathname?.startsWith("/fornecedor/login/") ||
    pathname?.startsWith("/fornecedor/cadastro/")

  if (isPublicArea) {
    return <>{children}</>
  }

  return <FornecedorPortalShell>{children}</FornecedorPortalShell>
}
