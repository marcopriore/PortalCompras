"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AdminIntegracoesSubnav } from "@/components/admin/integracoes-subnav"
import { IntegrationsSettings } from "@/components/admin/integrations-settings"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

export function IntegracoesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tenants, setTenants] = React.useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = React.useState(true)

  const companyId = searchParams.get("company_id") ?? ""

  React.useEffect(() => {
    const run = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("companies").select("id, name").order("name")
      const list = (data as { id: string; name: string }[]) ?? []
      setTenants(list)
      if (!searchParams.get("company_id") && list.length > 0) {
        router.replace(`/admin/integracoes?company_id=${encodeURIComponent(list[0].id)}`)
      }
      setLoading(false)
    }
    void run()
  }, [router, searchParams])

  const onCompanyChange = (id: string) => {
    router.replace(`/admin/integracoes?company_id=${encodeURIComponent(id)}`)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
          <p className="text-sm text-muted-foreground">
            API keys (inbound) e endpoints HTTP para o ERP (outbound)
          </p>
        </div>
        <div className="w-full sm:w-72">
          <Label className="text-xs text-muted-foreground">Tenant</Label>
          <Select value={companyId || undefined} onValueChange={onCompanyChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tenant" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <AdminIntegracoesSubnav />

      {companyId ? (
        <IntegrationsSettings companyId={companyId} />
      ) : (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          Selecione um tenant para configurar integrações.
        </div>
      )}
    </div>
  )
}
