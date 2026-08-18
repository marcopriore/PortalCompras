"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AdminIntegracoesSubnav } from "@/components/admin/integracoes-subnav"
import { IntegrationMonitor } from "@/components/integrations/integration-monitor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

export default function AdminIntegracoesMonitorPage() {
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
        router.replace(`/admin/integracoes/monitor?company_id=${encodeURIComponent(list[0].id)}`)
      }
      setLoading(false)
    }
    void run()
  }, [router, searchParams])

  const onCompanyChange = (id: string) => {
    router.replace(`/admin/integracoes/monitor?company_id=${encodeURIComponent(id)}`)
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
          <h1 className="text-2xl font-bold text-foreground">Monitor de Integração</h1>
          <p className="text-sm text-muted-foreground">
            Logs inbound (API) e outbound (webhooks para o ERP)
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

      <IntegrationMonitor
        mode="admin"
        tenants={tenants}
        fixedCompanyId={companyId || undefined}
        hideTitle
      />
    </div>
  )
}
