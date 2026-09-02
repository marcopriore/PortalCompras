"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SupplierClientOption } from "@/lib/supplier-portal/memberships"

function clientKey(client: Pick<SupplierClientOption, "companyId" | "supplierId">): string {
  return `${client.companyId}:${client.supplierId}`
}

export function SupplierClientSelector({
  clients,
  activeCompanyId,
  activeSupplierId,
}: {
  clients: SupplierClientOption[]
  activeCompanyId: string | null
  activeSupplierId: string | null
}) {
  const [mounted, setMounted] = React.useState(false)
  const [switching, setSwitching] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const activeKey =
    activeCompanyId && activeSupplierId
      ? `${activeCompanyId}:${activeSupplierId}`
      : clients[0]
        ? clientKey(clients[0])
        : ""

  const handleChange = async (value: string) => {
    if (value === activeKey || switching) return

    const client = clients.find((c) => clientKey(c) === value)
    if (!client) return

    setSwitching(true)
    try {
      const res = await fetch("/api/supplier-auth/activate-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: client.companyId,
          supplierId: client.supplierId,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível trocar de cliente.")
        return
      }
      window.location.href = "/fornecedor"
    } catch {
      toast.error("Erro ao trocar de cliente. Tente novamente.")
    } finally {
      setSwitching(false)
    }
  }

  if (!clients.length) return null

  if (clients.length === 1) {
    return (
      <p className="min-w-0 truncate text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Cliente:</span>{" "}
        {clients[0]!.companyName}
      </p>
    )
  }

  if (!mounted) {
    return (
      <div
        className="flex min-w-0 items-center gap-2"
        aria-hidden="true"
      >
        <span className="shrink-0 text-sm font-medium text-foreground">Cliente:</span>
        <div className="h-9 w-[220px] rounded-md border border-input bg-muted/40 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="flex min-w-0 max-w-full items-center gap-2">
      <span className="shrink-0 text-sm font-medium text-foreground">Cliente:</span>
      <Select value={activeKey} onValueChange={handleChange} disabled={switching}>
        <SelectTrigger className="h-9 w-[min(100%,220px)]">
          <SelectValue placeholder="Selecionar cliente" />
        </SelectTrigger>
        <SelectContent>
          {clients.map((client) => (
            <SelectItem key={clientKey(client)} value={clientKey(client)}>
              {client.companyName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
