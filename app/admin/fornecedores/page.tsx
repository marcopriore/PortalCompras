"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { formatDateTimeBR } from "@/lib/formato-data"
import { adminGlobalSuppliersQueryOptions } from "@/lib/queries/admin-global-suppliers"
import { Building2, Eye, List, RefreshCw, Search, Users } from "lucide-react"
import { toast } from "sonner"
import type {
  GlobalSupplierRow,
  GlobalSupplierTenant,
} from "@/lib/admin/global-suppliers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TABLE_PAGE_SIZE, TablePagination } from "@/components/ui/table-pagination"
import { TableRowActions } from "@/components/ui/table-row-actions"

function formatCnpj(cnpj: string | null): string {
  if (!cnpj) return "—"
  const d = cnpj.replace(/\D/g, "")
  if (d.length !== 14) return cnpj
  return d.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5",
  )
}

function formatLogin(iso: string | null): string {
  if (!iso) return "—"
  return formatDateTimeBR(iso, true)
}

export default function AdminFornecedoresPage() {
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [searchDraft, setSearchDraft] = React.useState("")
  const [detail, setDetail] = React.useState<GlobalSupplierRow | null>(null)
  const [tenantsDialog, setTenantsDialog] = React.useState<{
    supplierName: string
    tenants: GlobalSupplierTenant[]
  } | null>(null)

  const suppliersQuery = useQuery({
    ...adminGlobalSuppliersQueryOptions(page, TABLE_PAGE_SIZE, search),
  })

  const rows = suppliersQuery.data?.suppliers ?? []
  const total = suppliersQuery.data?.total ?? 0
  const loading = suppliersQuery.isLoading

  React.useEffect(() => {
    if (suppliersQuery.isError) {
      toast.error("Erro inesperado ao carregar fornecedores.")
    }
  }, [suppliersQuery.isError])

  const applySearch = () => {
    setPage(1)
    setSearch(searchDraft)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex items-center gap-4 rounded-xl border border-blue-100 bg-blue-50 p-5">
          <div className="flex items-center justify-center rounded-full bg-blue-100 p-3">
            <Building2 className="h-7 w-7 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-blue-600">Fornecedores (únicos)</p>
            <p className="text-3xl font-bold text-blue-700">{total}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-violet-100 bg-violet-50 p-5">
          <div className="flex items-center justify-center rounded-full bg-violet-100 p-3">
            <Users className="h-7 w-7 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-violet-600">Agregação</p>
            <p className="text-sm text-violet-800">
              Mesmo CNPJ em vários tenants = uma linha
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Fornecedores globais
          </h2>
          <p className="text-sm text-muted-foreground">
            Visão cross-tenant: clientes atendidos, cotações, pedidos e último login
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Nome, CNPJ ou tenant…"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch()
              }}
            />
          </div>
          <Button type="button" variant="outline" onClick={applySearch}>
            Buscar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void suppliersQuery.refetch()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Fornecedor</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Tenants / clientes</TableHead>
              <TableHead className="text-center">Cotações</TableHead>
              <TableHead className="text-center">Pedidos</TableHead>
              <TableHead className="text-center">Usuários</TableHead>
              <TableHead>Último login</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Nenhum fornecedor encontrado.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>
                    <div className="font-medium text-foreground">{row.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.email ?? "—"}
                      {row.city ? ` · ${row.city}/${row.state ?? "—"}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatCnpj(row.cnpj)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {row.tenants.length}{" "}
                        {row.tenants.length === 1 ? "tenant" : "tenants"}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        disabled={row.tenants.length === 0}
                        onClick={() =>
                          setTenantsDialog({
                            supplierName: row.name,
                            tenants: row.tenants,
                          })
                        }
                      >
                        <List className="h-3.5 w-3.5" />
                        Listar
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {row.quotations_count}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {row.orders_count}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {row.users_count}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatLogin(row.last_login_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <TableRowActions
                      actions={[
                        {
                          label: "Ver Detalhes",
                          icon: Eye,
                          onClick: () => setDetail(row),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={page}
        total={total}
        pageSize={TABLE_PAGE_SIZE}
        onPageChange={setPage}
        disabled={loading}
      />

      <Dialog open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">CNPJ</p>
                  <p className="font-mono">{formatCnpj(detail.cnpj)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p>{detail.status === "active" ? "Ativo" : detail.status ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">E-mail</p>
                  <p>{detail.email ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Telefone</p>
                  <p>{detail.phone ?? "—"}</p>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Tenants / clientes ({detail.tenants.length})
                </p>
                <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-3">
                  {detail.tenants.map((t) => (
                    <li
                      key={t.supplier_id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="font-medium">{t.company_name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {t.code}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-lg font-semibold">{detail.quotations_count}</p>
                  <p className="text-xs text-muted-foreground">Cotações</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-lg font-semibold">{detail.orders_count}</p>
                  <p className="text-xs text-muted-foreground">Pedidos</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-lg font-semibold">{detail.users_count}</p>
                  <p className="text-xs text-muted-foreground">Usuários</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Último login: {formatLogin(detail.last_login_at)}
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(tenantsDialog)}
        onOpenChange={(o) => !o && setTenantsDialog(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tenants / clientes</DialogTitle>
          </DialogHeader>
          {tenantsDialog ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {tenantsDialog.supplierName} · {tenantsDialog.tenants.length}{" "}
                {tenantsDialog.tenants.length === 1 ? "tenant" : "tenants"}
              </p>
              <ul className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-border p-3">
                {tenantsDialog.tenants.map((t) => (
                  <li
                    key={t.supplier_id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="font-medium text-foreground">
                      {t.company_name}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {t.code}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
