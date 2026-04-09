"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"
import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  ClipboardList,
  Plus,
  Search,
  LogOut,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  ShoppingCart,
} from "lucide-react"

type RequisitionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "in_quotation"
  | "completed"

type Requisition = {
  id: string
  code: string
  title: string
  status: RequisitionStatus
  priority: string
  created_at: string
  needed_by: string | null
  quotation_id: string | null
}

function getStatusMeta(status: RequisitionStatus) {
  switch (status) {
    case "pending":
      return {
        label: "Aguardando Aprovação",
        color: "bg-yellow-100 text-yellow-800",
        icon: Clock,
      }
    case "approved":
      return {
        label: "Aprovado",
        color: "bg-green-100 text-green-800",
        icon: CheckCircle2,
      }
    case "rejected":
      return {
        label: "Reprovado",
        color: "bg-red-100 text-red-800",
        icon: XCircle,
      }
    case "in_quotation":
      return {
        label: "Em Cotação",
        color: "bg-blue-100 text-blue-800",
        icon: FileText,
      }
    case "completed":
      return {
        label: "Concluído",
        color: "bg-gray-100 text-gray-700",
        icon: CheckCircle2,
      }
  }
}

export default function SolicitantePage() {
  const router = useRouter()
  const [requisitions, setRequisitions] = React.useState<Requisition[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [userId, setUserId] = React.useState<string | null>(null)
  const [userName, setUserName] = React.useState<string>("")

  // Métricas
  const total = requisitions.length
  const pending = requisitions.filter((r) => r.status === "pending").length
  const inProgress = requisitions.filter((r) =>
    ["approved", "in_quotation"].includes(r.status),
  ).length
  const completed = requisitions.filter((r) => r.status === "completed").length

  const filtered = requisitions.filter(
    (r) =>
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      r.title.toLowerCase().includes(search.toLowerCase()),
  )

  const loadRequisitions = React.useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = "/solicitante/login"
      return
    }

    setUserId(user.id)

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, profile_type")
      .eq("id", user.id)
      .single()

    if (!profile || profile.profile_type !== "requester") {
      window.location.href = "/solicitante/login"
      return
    }

    setUserName(profile.full_name ?? user.email ?? "")

    const { data } = await supabase
      .from("requisitions")
      .select(
        "id, code, title, status, priority, created_at, needed_by, quotation_id",
      )
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false })

    setRequisitions((data as Requisition[]) ?? [])
    setLoading(false)
  }, [])

  React.useEffect(() => {
    void loadRequisitions()
  }, [loadRequisitions])

  useAutoRefresh({
    intervalMs: 30000,
    onRefresh: () => {
      void loadRequisitions()
    },
    enabled: Boolean(userId),
  })

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/solicitante/login"
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Portal do Solicitante
              </p>
              <p className="text-xs text-muted-foreground">{userName}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void handleLogout()}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Cards de métricas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-foreground">{total}</p>
          </div>
          <div className="rounded-lg border border-yellow-100 bg-yellow-50 p-4">
            <p className="text-xs text-yellow-700">Aguardando</p>
            <p className="text-2xl font-bold text-yellow-800">{pending}</p>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs text-blue-700">Em Andamento</p>
            <p className="text-2xl font-bold text-blue-800">{inProgress}</p>
          </div>
          <div className="rounded-lg border border-green-100 bg-green-50 p-4">
            <p className="text-xs text-green-700">Concluídas</p>
            <p className="text-2xl font-bold text-green-800">{completed}</p>
          </div>
        </div>

        {/* Barra de ações */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou título..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => router.push("/solicitante/nova")}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Requisição
          </Button>
        </div>

        {/* Lista de requisições */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {search
                ? "Nenhuma requisição encontrada."
                : "Você ainda não criou requisições."}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => router.push("/solicitante/nova")}>
                Criar primeira requisição
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const meta = getStatusMeta(r.status)
              const Icon = meta.icon
              return (
                <Card
                  key={r.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/solicitante/${r.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="rounded-lg bg-muted p-2 flex-shrink-0 mt-0.5">
                          <ClipboardList className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground">{r.code}</p>
                            {r.quotation_id && (
                              <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                                <FileText className="w-3 h-3" />
                                Em cotação
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{r.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Criada em{" "}
                            {format(new Date(r.created_at), "dd/MM/yyyy", {
                              locale: ptBR,
                            })}
                            {r.needed_by &&
                              ` · Necessário até ${format(new Date(r.needed_by), "dd/MM/yyyy", { locale: ptBR })}`}
                          </p>
                        </div>
                      </div>
                      <Badge className={`${meta.color} flex-shrink-0 flex items-center gap-1`}>
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
