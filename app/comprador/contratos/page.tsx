"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, differenceInDays, parseISO, startOfDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { useTenant } from "@/contexts/tenant-context"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Plus,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  Eye,
  Pencil,
} from "lucide-react"
import type { Contract } from "@/types/contracts"
import { CONTRACT_KINDS } from "@/types/contracts"

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

const STATUS_LABELS: Record<Contract["status"], string> = {
  draft: "Rascunho",
  pending_acceptance: "Aguardando Aceite",
  active: "Ativo",
  expired: "Expirado",
  cancelled: "Cancelado",
}

function statusBadgeClass(status: Contract["status"]): string {
  switch (status) {
    case "draft":
      return "bg-muted text-muted-foreground"
    case "pending_acceptance":
      return "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
    case "active":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    case "expired":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    case "cancelled":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function isExpiringSoon(c: Contract): boolean {
  if (c.status !== "active") return false
  if (!c.end_date) return false
  const end = parseISO(c.end_date)
  const today = startOfDay(new Date())
  const days = differenceInDays(end, today)
  return days >= 0 && days <= 30
}

export default function ContratosPage() {
  const router = useRouter()
  const { loading: userLoading, isSuperAdmin } = useUser()
  const { hasFeature, loading: permissionsLoading, features } = usePermissions()
  const { companyId } = useTenant()

  const [contracts, setContracts] = React.useState<Contract[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [filterStatus, setFilterStatus] = React.useState<string>("all")
  const [filterContractKind, setFilterContractKind] =
    React.useState<string>("all")

  const canAccess = hasFeature("contracts") || isSuperAdmin

  React.useEffect(() => {
    if (userLoading || permissionsLoading) return
    if (!companyId) return
    if (!canAccess) {
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/contracts")
        const data = (await res.json()) as { contracts?: Contract[] }
        if (!cancelled && res.ok && Array.isArray(data.contracts)) {
          setContracts(data.contracts)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userLoading, permissionsLoading, canAccess, companyId, features.contracts])

  const total = contracts.length
  const ativos = contracts.filter((c) => c.status === "active").length
  const vencendo = contracts.filter(isExpiringSoon).length
  const expirados = contracts.filter((c) => c.status === "expired").length

  const filtered = React.useMemo(() => {
    return contracts
      .filter((c) => filterStatus === "all" || c.status === filterStatus)
      .filter(
        (c) =>
          filterContractKind === "all" ||
          c.contract_kind === filterContractKind,
      )
      .filter((c) => {
        if (!search.trim()) return true
        const s = search.toLowerCase()
        return (
          c.title.toLowerCase().includes(s) ||
          c.code.toLowerCase().includes(s) ||
          c.supplier_name.toLowerCase().includes(s)
        )
      })
  }, [contracts, filterStatus, filterContractKind, search])

  if (!userLoading && !permissionsLoading && !canAccess) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Contratos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              O módulo de contratos não está habilitado para a sua empresa.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contratos</h1>
        <p className="text-sm text-muted-foreground">
          Contratos com fornecedores, vigência e documentos
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Contratos
            </CardTitle>
            <FileText className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ativos
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{ativos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vencendo em 30 dias
            </CardTitle>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{vencendo}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Expirados
            </CardTitle>
            <XCircle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{expirados}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, código ou fornecedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="pending_acceptance">Aguardando Aceite</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="expired">Expirado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterContractKind} onValueChange={setFilterContractKind}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Tipo de contrato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos de contrato</SelectItem>
            {CONTRACT_KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          className="gap-2 shrink-0"
          onClick={() => router.push("/comprador/contratos/novo")}
        >
          <Plus className="h-4 w-4" />
          Novo Contrato
        </Button>
      </div>

      <Separator />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Clock className="h-5 w-5 animate-pulse" />
          <span className="text-sm">Carregando contratos…</span>
        </div>
      ) : contracts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <p className="text-lg font-medium text-foreground">
            Nenhum contrato cadastrado
          </p>
          <p className="text-sm text-muted-foreground mt-1 w-full">
            Clique em Novo Contrato para começar
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Tipo de Contrato</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {c.code}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {c.title}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {c.supplier_name}
                  </TableCell>
                  <TableCell>
                    {CONTRACT_KINDS.find((k) => k.value === c.contract_kind)
                      ?.label ?? c.contract_kind}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {c.start_date
                      ? format(parseISO(c.start_date), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}{" "}
                    –{" "}
                    {c.end_date
                      ? format(parseISO(c.end_date), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.total_value != null
                      ? money.format(c.total_value)
                      : c.value != null
                        ? money.format(c.value)
                        : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className={statusBadgeClass(c.status)}>
                        {STATUS_LABELS[c.status]}
                      </Badge>
                      {isExpiringSoon(c) && (
                        <AlertTriangle
                          className="h-4 w-4 text-amber-500 shrink-0"
                          aria-label="Vence em até 30 dias"
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" asChild title="Visualizar">
                        <Link href={`/comprador/contratos/${c.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild title="Editar">
                        <Link href={`/comprador/contratos/${c.id}?edit=true`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8 px-4">
              Nenhum contrato corresponde aos filtros.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
