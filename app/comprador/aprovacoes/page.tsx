"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import MultiSelectFilter from "@/components/ui/multi-select-filter"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
  ShieldCheck,
  ShieldOff,
  Check,
  X,
  Eye,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

type ApprovalStatus = "pending" | "approved" | "rejected"
type Priority = "normal" | "urgent" | "critical"

type ApprovalRequest = {
  id: string
  company_id: string
  flow: "requisition" | "order"
  entity_id: string
  approver_id: string | null
  approver_name: string | null
  status: ApprovalStatus
  rejection_reason: string | null
  decided_at: string | null
  created_at: string
}

type Requisition = {
  id: string
  code: string
  title: string
  cost_center: string | null
  status: string
  requester_name: string | null
  created_at: string
  priority: Priority
}

type PurchaseOrder = {
  id: string
  code: string
  total_price: number | null
  supplier_name: string
  status: string
  created_at: string
}

type ApprovalRequisitionRow = {
  request: ApprovalRequest
  requisition: Requisition | null
}

type ApprovalOrderRow = {
  request: ApprovalRequest
  order: PurchaseOrder | null
}

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

function formatDateBR(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return format(d, "dd/MM/yyyy", { locale: ptBR })
}

function getApprovalStatusMeta(status: ApprovalStatus): { label: string; className: string } {
  switch (status) {
    case "pending":
      return { label: "Pendente", className: "bg-yellow-100 text-yellow-700 border-yellow-200" }
    case "approved":
      return { label: "Aprovado", className: "bg-green-100 text-green-700 border-green-200" }
    case "rejected":
      return { label: "Reprovado", className: "bg-red-100 text-red-700 border-red-200" }
  }
}

function getPriorityMeta(priority: Priority): { label: string; className: string } {
  switch (priority) {
    case "normal":
      return { label: "Normal", className: "bg-muted text-muted-foreground" }
    case "urgent":
      return { label: "Urgente", className: "bg-orange-100 text-orange-800" }
    case "critical":
      return { label: "Crítica", className: "bg-red-100 text-red-800" }
  }
}

export default function AprovacoesPage() {
  const router = useRouter()
  const { companyId, userId } = useUser()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const [userRole, setUserRole] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  const [requisitionRows, setRequisitionRows] = React.useState<ApprovalRequisitionRow[]>([])
  const [orderRows, setOrderRows] = React.useState<ApprovalOrderRow[]>([])

  const [activeTab, setActiveTab] = React.useState("requisitions")

  const [reqStatus, setReqStatus] = React.useState<string[]>([])
  const [reqSearch, setReqSearch] = React.useState("")
  const [reqPage, setReqPage] = React.useState(1)

  const [orderStatus, setOrderStatus] = React.useState<string[]>([])
  const [orderSearch, setOrderSearch] = React.useState("")
  const [orderPage, setOrderPage] = React.useState(1)

  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false)
  const [rejectTarget, setRejectTarget] = React.useState<{
    flow: "requisition" | "order"
    requestId: string
    entityId: string
  } | null>(null)
  const [rejectReason, setRejectReason] = React.useState("")
  const [rejectSaving, setRejectSaving] = React.useState(false)

  const [actionLoading, setActionLoading] = React.useState<string | null>(null)

  const loadData = React.useCallback(async () => {
    if (!companyId || !userId) return
    const supabase = createClient()

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single()
    const role = (profile as { role?: string } | null)?.role ?? null
    setUserRole(role)
    const isAdmin = role === "admin"

    let reqQuery = supabase
      .from("approval_requests")
      .select("*")
      .eq("company_id", companyId)
      .eq("flow", "requisition")
    if (!isAdmin) {
      reqQuery = reqQuery.eq("approver_id", userId)
    }
    const { data: reqData } = await reqQuery.order("created_at", { ascending: false })

    let orderQuery = supabase
      .from("approval_requests")
      .select("*")
      .eq("company_id", companyId)
      .eq("flow", "order")
    if (!isAdmin) {
      orderQuery = orderQuery.eq("approver_id", userId)
    }
    const { data: orderData } = await orderQuery.order("created_at", { ascending: false })

    const reqRequests = (reqData ?? []) as ApprovalRequest[]
    const orderRequests = (orderData ?? []) as ApprovalRequest[]

    const reqEntityIds = [...new Set(reqRequests.map((r) => r.entity_id))]
    const orderEntityIds = [...new Set(orderRequests.map((r) => r.entity_id))]

    let requisitions: Requisition[] = []
    let orders: PurchaseOrder[] = []

    if (reqEntityIds.length > 0) {
      const { data: reqs } = await supabase
        .from("requisitions")
        .select("id, code, title, cost_center, status, requester_name, created_at, priority")
        .in("id", reqEntityIds)
      requisitions = (reqs ?? []) as Requisition[]
    }
    if (orderEntityIds.length > 0) {
      const { data: ords } = await supabase
        .from("purchase_orders")
        .select("id, code, total_price, supplier_name, status, created_at")
        .in("id", orderEntityIds)
      orders = (ords ?? []) as PurchaseOrder[]
    }

    const reqMap = new Map(requisitions.map((r) => [r.id, r]))
    const orderMap = new Map(orders.map((o) => [o.id, o]))

    setRequisitionRows(
      reqRequests.map((request) => ({
        request,
        requisition: reqMap.get(request.entity_id) ?? null,
      })),
    )
    setOrderRows(
      orderRequests.map((request) => ({
        request,
        order: orderMap.get(request.entity_id) ?? null,
      })),
    )
    setLoading(false)
  }, [companyId, userId])

  React.useEffect(() => {
    if (!companyId || !userId) return
    setLoading(true)
    loadData()
  }, [companyId, userId, loadData])

  const pendingTotal = React.useMemo(
    () =>
      requisitionRows.filter((r) => r.request.status === "pending").length +
      orderRows.filter((r) => r.request.status === "pending").length,
    [requisitionRows, orderRows],
  )

  const pendingRequisitions = requisitionRows.filter((r) => r.request.status === "pending").length
  const pendingOrders = orderRows.filter((r) => r.request.status === "pending").length

  const filteredRequisitions = React.useMemo(() => {
    const q = reqSearch.trim().toLowerCase()
    return requisitionRows.filter((row) => {
      const matchStatus = reqStatus.length === 0 || reqStatus.includes(row.request.status)
      const r = row.requisition
      const matchSearch =
        !q ||
        (r?.code?.toLowerCase().includes(q) ?? false) ||
        (r?.requester_name?.toLowerCase().includes(q) ?? false)
      return matchStatus && matchSearch
    })
  }, [requisitionRows, reqStatus, reqSearch])

  const filteredOrders = React.useMemo(() => {
    const q = orderSearch.trim().toLowerCase()
    return orderRows.filter((row) => {
      const matchStatus = orderStatus.length === 0 || orderStatus.includes(row.request.status)
      const o = row.order
      const matchSearch =
        !q ||
        (o?.code?.toLowerCase().includes(q) ?? false) ||
        (o?.supplier_name?.toLowerCase().includes(q) ?? false)
      return matchStatus && matchSearch
    })
  }, [orderRows, orderStatus, orderSearch])

  const PAGE_SIZE = 20
  const reqTotalPages = Math.max(1, Math.ceil(filteredRequisitions.length / PAGE_SIZE))
  const reqPaginated = filteredRequisitions.slice(
    (reqPage - 1) * PAGE_SIZE,
    reqPage * PAGE_SIZE,
  )
  const reqFrom = filteredRequisitions.length === 0 ? 0 : (reqPage - 1) * PAGE_SIZE + 1
  const reqTo = Math.min(reqPage * PAGE_SIZE, filteredRequisitions.length)

  const orderTotalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE))
  const orderPaginated = filteredOrders.slice(
    (orderPage - 1) * PAGE_SIZE,
    orderPage * PAGE_SIZE,
  )
  const orderFrom = filteredOrders.length === 0 ? 0 : (orderPage - 1) * PAGE_SIZE + 1
  const orderTo = Math.min(orderPage * PAGE_SIZE, filteredOrders.length)

  const hasReqFilters = reqStatus.length > 0 || reqSearch.trim() !== ""
  const hasOrderFilters = orderStatus.length > 0 || orderSearch.trim() !== ""

  const handleApprove = async (
    flow: "requisition" | "order",
    requestId: string,
    entityId: string,
  ) => {
    if (!companyId || !userId) return
    setActionLoading(requestId)
    const supabase = createClient()

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single()
      const approverName = (profile as { full_name?: string } | null)?.full_name ?? ""

      await supabase
        .from("approval_requests")
        .update({
          status: "approved",
          decided_at: new Date().toISOString(),
        })
        .eq("id", requestId)

      const { data: approvalRows, error: fetchErr } = await supabase
        .from("approval_requests")
        .select("status")
        .eq("entity_id", entityId)
        .eq("flow", flow)
      if (fetchErr) {
        toast.error("Erro ao verificar aprovações. Tente novamente.")
        return
      }
      const rows = (approvalRows ?? []) as { status: string }[]
      const total = rows.filter((r) => r.status !== "rejected").length
      const approved = rows.filter((r) => r.status === "approved").length
      const isAllApproved = total > 0 && total === approved

      if (isAllApproved) {
        const table = flow === "requisition" ? "requisitions" : "purchase_orders"
        const { data: updatedRows, error: updateErr } = await supabase
          .from(table)
          .update({
            status: "approved",
            approved_at: new Date().toISOString(),
            approver_name: approverName,
          })
          .eq("id", entityId)
          .select("id")
        if (updateErr) {
          toast.error("Erro ao atualizar status. Tente novamente.")
          return
        }
        if (!updatedRows || updatedRows.length === 0) {
          toast.error("Não foi possível atualizar o status (possível bloqueio de permissão).")
          return
        }
      }

      toast.success(
        flow === "requisition"
          ? "Requisição aprovada com sucesso."
          : "Pedido aprovado com sucesso.",
      )
      await loadData()
      window.dispatchEvent(new Event("approval-updated"))
    } catch (e) {
      toast.error("Erro ao aprovar. Tente novamente.")
    } finally {
      setActionLoading(null)
    }
  }

  const openRejectDialog = (flow: "requisition" | "order", requestId: string, entityId: string) => {
    setRejectTarget({ flow, requestId, entityId })
    setRejectReason("")
    setRejectDialogOpen(true)
  }

  const handleRejectConfirm = async () => {
    if (!rejectTarget || !rejectReason.trim()) return
    setRejectSaving(true)
    const supabase = createClient()

    try {
      await supabase
        .from("approval_requests")
        .update({
          status: "rejected",
          rejection_reason: rejectReason.trim(),
          decided_at: new Date().toISOString(),
        })
        .eq("id", rejectTarget.requestId)

      const table =
        rejectTarget.flow === "requisition" ? "requisitions" : "purchase_orders"
      await supabase
        .from(table)
        .update({
          status: "rejected",
          rejection_reason: rejectReason.trim(),
        })
        .eq("id", rejectTarget.entityId)

      toast.success(
        rejectTarget.flow === "requisition"
          ? "Requisição reprovada."
          : "Pedido reprovado.",
      )
      setRejectDialogOpen(false)
      setRejectTarget(null)
      setRejectReason("")
      await loadData()
      window.dispatchEvent(new Event("approval-updated"))
    } catch (e) {
      toast.error("Erro ao reprovar. Tente novamente.")
    } finally {
      setRejectSaving(false)
    }
  }

  if (!companyId || !userId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const hasReqPermission = hasPermission("approval.requisition")
  const hasOrderPermission = hasPermission("approval.order")

  if (!hasReqPermission && !hasOrderPermission) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Aprovações</h1>
            <p className="text-muted-foreground">
              Gerencie as aprovações pendentes de requisições e pedidos de compra.
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShieldOff className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground">
              Você não tem permissão para acessar esta tela.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalRegistros = requisitionRows.length + orderRows.length
  const showEmptyState = totalRegistros === 0 && !loading
  const showTabs = hasReqPermission && hasOrderPermission

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-8 w-8 text-primary" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Aprovações</h1>
            {!loading && pendingTotal > 0 && (
              <Badge
                variant="secondary"
                className="bg-yellow-100 text-yellow-700 border border-yellow-200"
              >
                {pendingTotal}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Gerencie as aprovações pendentes de requisições e pedidos de compra.
          </p>
        </div>
      </div>

      {showEmptyState ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground">
              Nenhuma aprovação pendente. Tudo em dia!
            </p>
          </CardContent>
        </Card>
      ) : showTabs ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="requisitions">
              Requisições ({pendingRequisitions})
            </TabsTrigger>
            <TabsTrigger value="orders">
              Pedidos de Compra ({pendingOrders})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requisitions" className="space-y-4">
            <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <MultiSelectFilter
                    label="Status"
                    options={[
                      { value: "pending", label: "Pendente" },
                      { value: "approved", label: "Aprovado" },
                      { value: "rejected", label: "Reprovado" },
                    ]}
                    selected={reqStatus}
                    onChange={setReqStatus}
                    width="w-40"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Buscar</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por código ou solicitante..."
                      value={reqSearch}
                      onChange={(e) => setReqSearch(e.target.value)}
                      className="w-64 pl-9"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-auto">
                  <span className="text-sm text-muted-foreground">
                    {filteredRequisitions.length} resultado(s)
                  </span>
                  {hasReqFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setReqStatus([])
                        setReqSearch("")
                        setReqPage(1)
                      }}
                    >
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Carregando...
                  </div>
                ) : filteredRequisitions.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Nenhuma requisição encontrada.
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Título</TableHead>
                          <TableHead>Solicitante</TableHead>
                          <TableHead>Centro de Custo</TableHead>
                          <TableHead>Prioridade</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reqPaginated.map((row) => {
                          const s = getApprovalStatusMeta(row.request.status)
                          const r = row.requisition
                          const p = getPriorityMeta((r?.priority as Priority) ?? "normal")
                          return (
                            <TableRow key={row.request.id}>
                              <TableCell className="font-mono text-sm">
                                {r?.code ?? "—"}
                              </TableCell>
                              <TableCell>{r?.title ?? "—"}</TableCell>
                              <TableCell>{r?.requester_name ?? "—"}</TableCell>
                              <TableCell>{r?.cost_center ?? "—"}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className={p.className}>
                                  {p.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {formatDateBR(row.request.created_at)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={s.className}>
                                  {s.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => router.push(`/comprador/requisicoes/${row.request.entity_id}?from=aprovacoes`)}
                                    title="Ver detalhes"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {row.request.status === "pending" && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="bg-green-600 hover:bg-green-700"
                                        onClick={() =>
                                          handleApprove(
                                            "requisition",
                                            row.request.id,
                                            row.request.entity_id,
                                          )
                                        }
                                        disabled={actionLoading === row.request.id}
                                      >
                                        <Check className="h-4 w-4 mr-1" />
                                        Aprovar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() =>
                                          openRejectDialog(
                                            "requisition",
                                            row.request.id,
                                            row.request.entity_id,
                                          )
                                        }
                                        disabled={actionLoading === row.request.id}
                                      >
                                        <X className="h-4 w-4 mr-1" />
                                        Reprovar
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                    <div className="flex flex-col gap-3 px-4 py-4 border-t border-border sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Exibindo {reqFrom}–{reqTo} de {filteredRequisitions.length} resultado(s)
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReqPage((p) => Math.max(1, p - 1))}
                          disabled={reqPage <= 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Anterior
                        </Button>
                        <span className="text-sm text-muted-foreground px-2">
                          Página {reqPage} de {reqTotalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setReqPage((p) => Math.min(reqTotalPages, p + 1))
                          }
                          disabled={reqPage >= reqTotalPages}
                        >
                          Próximo
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <MultiSelectFilter
                    label="Status"
                    options={[
                      { value: "pending", label: "Pendente" },
                      { value: "approved", label: "Aprovado" },
                      { value: "rejected", label: "Reprovado" },
                    ]}
                    selected={orderStatus}
                    onChange={setOrderStatus}
                    width="w-40"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Buscar</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por código ou fornecedor..."
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className="w-64 pl-9"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-auto">
                  <span className="text-sm text-muted-foreground">
                    {filteredOrders.length} resultado(s)
                  </span>
                  {hasOrderFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setOrderStatus([])
                        setOrderSearch("")
                        setOrderPage(1)
                      }}
                    >
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Carregando...
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Nenhum pedido encontrado.
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Fornecedor</TableHead>
                          <TableHead>Valor Total</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderPaginated.map((row) => {
                          const s = getApprovalStatusMeta(row.request.status)
                          const o = row.order
                          return (
                            <TableRow key={row.request.id}>
                              <TableCell className="font-mono text-sm">
                                {o?.code ?? "—"}
                              </TableCell>
                              <TableCell>{o?.supplier_name ?? "—"}</TableCell>
                              <TableCell>
                                {o?.total_price != null
                                  ? money.format(o.total_price)
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                {formatDateBR(row.request.created_at)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={s.className}>
                                  {s.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => router.push(`/comprador/pedidos/${row.request.entity_id}`)}
                                    title="Ver detalhes"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {row.request.status === "pending" && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="bg-green-600 hover:bg-green-700"
                                        onClick={() =>
                                          handleApprove(
                                            "order",
                                            row.request.id,
                                            row.request.entity_id,
                                          )
                                        }
                                        disabled={actionLoading === row.request.id}
                                      >
                                        <Check className="h-4 w-4 mr-1" />
                                        Aprovar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() =>
                                          openRejectDialog(
                                            "order",
                                            row.request.id,
                                            row.request.entity_id,
                                          )
                                        }
                                        disabled={actionLoading === row.request.id}
                                      >
                                        <X className="h-4 w-4 mr-1" />
                                        Reprovar
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                    <div className="flex flex-col gap-3 px-4 py-4 border-t border-border sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Exibindo {orderFrom}–{orderTo} de {filteredOrders.length} resultado(s)
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setOrderPage((p) => Math.max(1, p - 1))
                          }
                          disabled={orderPage <= 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Anterior
                        </Button>
                        <span className="text-sm text-muted-foreground px-2">
                          Página {orderPage} de {orderTotalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setOrderPage((p) => Math.min(orderTotalPages, p + 1))
                          }
                          disabled={orderPage >= orderTotalPages}
                        >
                          Próximo
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <>
          {hasReqPermission && (
            <div className="space-y-4">
              <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Status</p>
                    <MultiSelectFilter
                      label="Status"
                      options={[
                        { value: "pending", label: "Pendente" },
                        { value: "approved", label: "Aprovado" },
                        { value: "rejected", label: "Reprovado" },
                      ]}
                      selected={reqStatus}
                      onChange={setReqStatus}
                      width="w-40"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Buscar</p>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por código ou solicitante..."
                        value={reqSearch}
                        onChange={(e) => setReqSearch(e.target.value)}
                        className="w-64 pl-9"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-auto">
                    <span className="text-sm text-muted-foreground">
                      {filteredRequisitions.length} resultado(s)
                    </span>
                    {hasReqFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setReqStatus([])
                          setReqSearch("")
                          setReqPage(1)
                        }}
                      >
                        Limpar filtros
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <Card>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      Carregando...
                    </div>
                  ) : filteredRequisitions.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      Nenhuma requisição encontrada.
                    </div>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Título</TableHead>
                            <TableHead>Solicitante</TableHead>
                            <TableHead>Centro de Custo</TableHead>
                            <TableHead>Prioridade</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reqPaginated.map((row) => {
                            const s = getApprovalStatusMeta(row.request.status)
                            const r = row.requisition
                            const p = getPriorityMeta((r?.priority as Priority) ?? "normal")
                            return (
                              <TableRow key={row.request.id}>
                                <TableCell className="font-mono text-sm">
                                  {r?.code ?? "—"}
                                </TableCell>
                                <TableCell>{r?.title ?? "—"}</TableCell>
                                <TableCell>{r?.requester_name ?? "—"}</TableCell>
                                <TableCell>{r?.cost_center ?? "—"}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className={p.className}>
                                    {p.label}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {formatDateBR(row.request.created_at)}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={s.className}>
                                    {s.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => router.push(`/comprador/requisicoes/${row.request.entity_id}?from=aprovacoes`)}
                                      title="Ver detalhes"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    {row.request.status === "pending" && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="default"
                                          className="bg-green-600 hover:bg-green-700"
                                          onClick={() =>
                                            handleApprove(
                                              "requisition",
                                              row.request.id,
                                              row.request.entity_id,
                                            )
                                          }
                                          disabled={actionLoading === row.request.id}
                                        >
                                          <Check className="h-4 w-4 mr-1" />
                                          Aprovar
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() =>
                                            openRejectDialog(
                                              "requisition",
                                              row.request.id,
                                              row.request.entity_id,
                                            )
                                          }
                                          disabled={actionLoading === row.request.id}
                                        >
                                          <X className="h-4 w-4 mr-1" />
                                          Reprovar
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                      <div className="flex flex-col gap-3 px-4 py-4 border-t border-border sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                          Exibindo {reqFrom}–{reqTo} de {filteredRequisitions.length} resultado(s)
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReqPage((p) => Math.max(1, p - 1))}
                            disabled={reqPage <= 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Anterior
                          </Button>
                          <span className="text-sm text-muted-foreground px-2">
                            Página {reqPage} de {reqTotalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setReqPage((p) => Math.min(reqTotalPages, p + 1))
                            }
                            disabled={reqPage >= reqTotalPages}
                          >
                            Próximo
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          {hasOrderPermission && (
            <div className="space-y-4">
              <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Status</p>
                    <MultiSelectFilter
                      label="Status"
                      options={[
                        { value: "pending", label: "Pendente" },
                        { value: "approved", label: "Aprovado" },
                        { value: "rejected", label: "Reprovado" },
                      ]}
                      selected={orderStatus}
                      onChange={setOrderStatus}
                      width="w-40"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Buscar</p>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por código ou fornecedor..."
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        className="w-64 pl-9"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-auto">
                    <span className="text-sm text-muted-foreground">
                      {filteredOrders.length} resultado(s)
                    </span>
                    {hasOrderFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setOrderStatus([])
                          setOrderSearch("")
                          setOrderPage(1)
                        }}
                      >
                        Limpar filtros
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <Card>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      Carregando...
                    </div>
                  ) : filteredOrders.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      Nenhum pedido encontrado.
                    </div>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Fornecedor</TableHead>
                            <TableHead>Valor Total</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orderPaginated.map((row) => {
                            const s = getApprovalStatusMeta(row.request.status)
                            const o = row.order
                            return (
                              <TableRow key={row.request.id}>
                                <TableCell className="font-mono text-sm">
                                  {o?.code ?? "—"}
                                </TableCell>
                                <TableCell>{o?.supplier_name ?? "—"}</TableCell>
                                <TableCell>
                                  {o?.total_price != null
                                    ? money.format(o.total_price)
                                    : "—"}
                                </TableCell>
                                <TableCell>
                                  {formatDateBR(row.request.created_at)}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={s.className}>
                                    {s.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => router.push(`/comprador/pedidos/${row.request.entity_id}`)}
                                      title="Ver detalhes"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    {row.request.status === "pending" && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="default"
                                          className="bg-green-600 hover:bg-green-700"
                                          onClick={() =>
                                            handleApprove(
                                              "order",
                                              row.request.id,
                                              row.request.entity_id,
                                            )
                                          }
                                          disabled={actionLoading === row.request.id}
                                        >
                                          <Check className="h-4 w-4 mr-1" />
                                          Aprovar
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() =>
                                            openRejectDialog(
                                              "order",
                                              row.request.id,
                                              row.request.entity_id,
                                            )
                                          }
                                          disabled={actionLoading === row.request.id}
                                        >
                                          <X className="h-4 w-4 mr-1" />
                                          Reprovar
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                      <div className="flex flex-col gap-3 px-4 py-4 border-t border-border sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                          Exibindo {orderFrom}–{orderTo} de {filteredOrders.length} resultado(s)
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setOrderPage((p) => Math.max(1, p - 1))
                            }
                            disabled={orderPage <= 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Anterior
                          </Button>
                          <span className="text-sm text-muted-foreground px-2">
                            Página {orderPage} de {orderTotalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setOrderPage((p) => Math.min(orderTotalPages, p + 1))
                            }
                            disabled={orderPage >= orderTotalPages}
                          >
                            Próximo
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo da reprovação</DialogTitle>
            <DialogDescription>
              Informe o motivo da reprovação. Este texto será registrado no histórico.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Descreva o motivo..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false)
                setRejectTarget(null)
                setRejectReason("")
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={!rejectReason.trim() || rejectSaving}
            >
              {rejectSaving ? "Reprovando..." : "Confirmar reprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
