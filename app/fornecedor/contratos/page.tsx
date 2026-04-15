"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  CheckCircle,
  ChevronRight,
  Clock,
  FileSignature,
  Search,
  XCircle,
} from "lucide-react"
import { useUser } from "@/lib/hooks/useUser"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Contract } from "@/types/contracts"
import { CONTRACT_KINDS } from "@/types/contracts"

function statusDisplay(c: Contract): { label: string; className: string } {
  if (c.status === "pending_acceptance") {
    return {
      label: "Aguardando Aceite",
      className:
        "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
    }
  }
  if (c.status === "active") {
    return {
      label: "Ativo",
      className:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    }
  }
  if (c.status === "draft" && (c.refusal_reason?.trim() ?? "")) {
    return {
      label: "Recusado",
      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    }
  }
  if (c.status === "draft") {
    return {
      label: "Rascunho",
      className: "bg-muted text-muted-foreground",
    }
  }
  if (c.status === "expired") {
    return {
      label: "Expirado",
      className: "bg-muted text-muted-foreground",
    }
  }
  if (c.status === "cancelled") {
    return {
      label: "Cancelado",
      className:
        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    }
  }
  return { label: c.status, className: "bg-muted text-muted-foreground" }
}

export default function FornecedorContratosPage() {
  const router = useRouter()
  const { loading: userLoading, supplierId } = useUser()

  const [contracts, setContracts] = React.useState<Contract[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")

  React.useEffect(() => {
    if (userLoading) return
    if (!supplierId) {
      setContracts([])
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/contracts/supplier")
        const data = (await res.json()) as { contracts?: Contract[]; error?: string }
        if (!cancelled && res.ok && Array.isArray(data.contracts)) {
          setContracts(data.contracts)
        } else if (!cancelled && !res.ok) {
          setContracts([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userLoading, supplierId])

  const metrics = React.useMemo(() => {
    const total = contracts.length
    const pending = contracts.filter((c) => c.status === "pending_acceptance")
      .length
    const active = contracts.filter((c) => c.status === "active").length
    const refused = contracts.filter(
      (c) => c.status === "draft" && Boolean(c.refusal_reason?.trim()),
    ).length
    return { total, pending, active, refused }
  }, [contracts])

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return contracts
    return contracts.filter((c) => {
      const title = (c.title ?? "").toLowerCase()
      const code = (c.code ?? "").toLowerCase()
      const company = (c.buyer_company_name ?? "").toLowerCase()
      return (
        title.includes(term) || code.includes(term) || company.includes(term)
      )
    })
  }, [contracts, search])

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Contratos
        </h1>
        <p className="text-muted-foreground">
          Contratos com seus clientes — aceite ou recuse quando solicitado
        </p>
      </div>

      {!userLoading && !supplierId ? (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Seu usuário não está vinculado a um fornecedor.
        </p>
      ) : null}

      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[100px] animate-pulse rounded-xl bg-muted"
            />
          ))
        ) : (
          <>
            <Card className="border-blue-100 dark:border-blue-900/40">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total</p>
                  <p className="mt-1 text-3xl font-bold text-blue-700 dark:text-blue-400">
                    {metrics.total}
                  </p>
                </div>
                <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-950/50">
                  <FileSignature className="h-6 w-6 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-100 dark:border-amber-900/40">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm font-medium text-amber-600">
                    Aguardando Aceite
                  </p>
                  <p className="mt-1 text-3xl font-bold text-amber-700 dark:text-amber-400">
                    {metrics.pending}
                  </p>
                </div>
                <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-950/50">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-green-100 dark:border-green-900/40">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm font-medium text-green-600">Ativos</p>
                  <p className="mt-1 text-3xl font-bold text-green-700 dark:text-green-400">
                    {metrics.active}
                  </p>
                </div>
                <div className="rounded-full bg-green-100 p-3 dark:bg-green-950/50">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-100 dark:border-red-900/40">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm font-medium text-red-600">Recusados</p>
                  <p className="mt-1 text-3xl font-bold text-red-700 dark:text-red-400">
                    {metrics.refused}
                  </p>
                </div>
                <div className="rounded-full bg-red-100 p-3 dark:bg-red-950/50">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por título, código ou empresa compradora"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {!loading && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <FileSignature className="h-14 w-14 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum contrato encontrado
          </p>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtered.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const sd = statusDisplay(c)
                const pending = c.status === "pending_acceptance"
                return (
                  <TableRow
                    key={c.id}
                    className={
                      pending ? "bg-amber-50/80 dark:bg-amber-950/20" : undefined
                    }
                  >
                    <TableCell className="font-mono text-xs">{c.code}</TableCell>
                    <TableCell className="max-w-[200px] truncate font-medium">
                      {c.title}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {c.buyer_company_name?.trim() ? c.buyer_company_name : "—"}
                    </TableCell>
                    <TableCell>
                      {CONTRACT_KINDS.find((k) => k.value === c.contract_kind)
                        ?.label ?? c.contract_kind}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(parseISO(c.start_date), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}{" "}
                      –{" "}
                      {format(parseISO(c.end_date), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge className={sd.className}>{sd.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        onClick={() =>
                          router.push(`/fornecedor/contratos/${c.id}`)
                        }
                      >
                        Ver
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  )
}
