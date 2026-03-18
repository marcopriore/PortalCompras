"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { logAudit } from "@/lib/audit"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import {
  ChevronLeft,
  FileText,
  Scale,
  ShoppingCart,
  ClipboardList,
  Building2,
  Package,
  BarChart2,
  Users,
  Settings,
  ScrollText,
} from "lucide-react"

type FeatureKey =
  | "quotations"
  | "equalization"
  | "orders"
  | "requisitions"
  | "suppliers"
  | "items"
  | "reports"
  | "users"
  | "settings"
  | "logs"

const FEATURES: Array<{
  key: FeatureKey
  label: string
  description: string
  icon: "FileText" | "Scale" | "ShoppingCart" | "ClipboardList" | "Building2" | "Package" | "BarChart2" | "Users" | "Settings" | "ScrollText"
}> = [
  {
    key: "quotations",
    label: "Cotações",
    description: "Criação e gestão de cotações de compra",
    icon: "FileText",
  },
  {
    key: "equalization",
    label: "Equalização de Propostas",
    description: "Comparativo e seleção de propostas dos fornecedores",
    icon: "Scale",
  },
  {
    key: "orders",
    label: "Pedidos de Compra",
    description: "Geração e acompanhamento de pedidos",
    icon: "ShoppingCart",
  },
  {
    key: "requisitions",
    label: "Requisições",
    description: "Criação e aprovação de requisições de compra",
    icon: "ClipboardList",
  },
  {
    key: "suppliers",
    label: "Fornecedores",
    description: "Base de fornecedores sincronizada via ERP",
    icon: "Building2",
  },
  {
    key: "items",
    label: "Itens / Materiais",
    description: "Catálogo de materiais sincronizado via ERP",
    icon: "Package",
  },
  {
    key: "reports",
    label: "Relatórios",
    description: "Análises e exportações de dados de compras",
    icon: "BarChart2",
  },
  {
    key: "users",
    label: "Gestão de Usuários",
    description: "Cadastro e controle de acesso de usuários",
    icon: "Users",
  },
  {
    key: "settings",
    label: "Configurações",
    description: "Configurações da empresa e preferências",
    icon: "Settings",
  },
  {
    key: "logs",
    label: "Logs de Auditoria",
    description: "Histórico de ações realizadas no sistema",
    icon: "ScrollText",
  },
]

function getFeatureIcon(iconName: (typeof FEATURES)[number]["icon"]) {
  const commonProps = { className: "h-4 w-4" }
  if (iconName === "FileText") return <FileText {...commonProps} />
  if (iconName === "Scale") return <Scale {...commonProps} />
  if (iconName === "ShoppingCart") return <ShoppingCart {...commonProps} />
  if (iconName === "ClipboardList") return <ClipboardList {...commonProps} />
  if (iconName === "Building2") return <Building2 {...commonProps} />
  if (iconName === "Package") return <Package {...commonProps} />
  if (iconName === "BarChart2") return <BarChart2 {...commonProps} />
  if (iconName === "Users") return <Users {...commonProps} />
  if (iconName === "Settings") return <Settings {...commonProps} />
  return <ScrollText {...commonProps} />
}

export default function TenantFeaturesPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { userId, isSuperAdmin, loading: userLoading } = useUser()
  const { id } = React.use(params)

  const [loading, setLoading] = React.useState(true)
  const [tenantName, setTenantName] = React.useState<string>("")
  const [featuresState, setFeaturesState] = React.useState<Record<string, boolean>>({})

  // Aguardar carregamento do useUser antes de verificar permissão
  React.useEffect(() => {
    if (!userLoading && !isSuperAdmin) {
      router.push("/admin/tenants")
    }
  }, [userLoading, isSuperAdmin, router])

  React.useEffect(() => {
    if (!id || !isSuperAdmin || userLoading) return

    const run = async () => {
      setLoading(true)
      const supabase = createClient()

      const [{ data: featuresRes }, { data: tenantRes }] = await Promise.all([
        supabase.from("tenant_features").select("*").eq("company_id", id),
        supabase.from("companies").select("id, name").eq("id", id).single(),
      ])

      const state: Record<string, boolean> = {}
      FEATURES.forEach((f) => {
        state[f.key] = true
      })

      ;(featuresRes ?? []).forEach((row: any) => {
        if (!row?.feature_key) return
        if (state[row.feature_key] == null) return
        state[row.feature_key] = Boolean(row.enabled)
      })

      setTenantName((tenantRes as any)?.name ?? "")
      setFeaturesState(state)
      setLoading(false)
    }

    run()
  }, [id, isSuperAdmin, userLoading])

  const activeCount = React.useMemo(() => {
    return FEATURES.reduce((sum, f) => sum + (featuresState[f.key] ? 1 : 0), 0)
  }, [featuresState])

  const handleToggle = async (key: FeatureKey, enabled: boolean) => {
    if (!id) return

    const feature = FEATURES.find((f) => f.key === key)
    if (!feature) return

    const prev = featuresState[key]
    setFeaturesState((s) => ({ ...s, [key]: enabled }))

    try {
      const supabase = createClient()
      await supabase
        .from("tenant_features")
        .upsert(
          { company_id: id, feature_key: key, enabled },
          { onConflict: "company_id,feature_key" },
        )

      await logAudit({
        eventType: "tenant.updated",
        description: `Módulo "${feature.label}" ${enabled ? "habilitado" : "desabilitado"} para ${tenantName}`,
        companyId: id,
        userId,
        entity: "tenant_features",
        entityId: id,
        metadata: { feature_key: key, enabled },
      })
    } catch {
      setFeaturesState((s) => ({ ...s, [key]: prev }))
    }
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Carregando...
      </div>
    )
  }

  if (!isSuperAdmin) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2 gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/admin/tenants/${id}`)}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Funcionalidades do Tenant</h1>
            <p className="text-sm text-muted-foreground">{tenantName || "Carregando..."}</p>
          </div>
        </div>
        <Badge variant="outline">
          {activeCount} de {FEATURES.length} módulos ativos
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FEATURES.map((feature) => {
          const enabled = featuresState[feature.key] ?? true

          return (
            <div
              key={feature.key}
              className={`bg-card border rounded-xl p-5 flex items-start justify-between gap-4
                ${enabled ? "border-border" : "border-border opacity-60"}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`rounded-lg p-2 ${
                    enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {getFeatureIcon(feature.icon)}
                </div>
                <div>
                  <p className="font-medium text-foreground">{feature.label}</p>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(val) => handleToggle(feature.key, val)}
                      disabled={loading}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>{enabled ? "Habilitado" : "Desabilitado"}</TooltipContent>
              </Tooltip>
            </div>
          )
        })}
      </div>
    </div>
  )
}

