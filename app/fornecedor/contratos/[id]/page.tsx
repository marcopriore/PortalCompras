"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  format,
  parseISO,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import {
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  FileText,
  XCircle,
} from "lucide-react"
import { useUser } from "@/lib/hooks/useUser"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  Contract,
  ContractAcceptance,
  ContractItem,
} from "@/types/contracts"
import { CONTRACT_KINDS } from "@/types/contracts"

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

function formatBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—"
  return money.format(value)
}

function statusBadgeClass(c: Contract): string {
  if (c.status === "pending_acceptance") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
  }
  if (c.status === "active") {
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
  }
  if (c.status === "draft" && (c.refusal_reason?.trim() ?? "")) {
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  }
  if (c.status === "draft") {
    return "bg-muted text-muted-foreground"
  }
  if (c.status === "expired") {
    return "bg-muted text-muted-foreground"
  }
  if (c.status === "cancelled") {
    return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
  }
  return "bg-muted text-muted-foreground"
}

function statusLabel(c: Contract): string {
  if (c.status === "pending_acceptance") return "Aguardando Aceite"
  if (c.status === "active") return "Ativo"
  if (c.status === "draft" && (c.refusal_reason?.trim() ?? "")) return "Recusado"
  if (c.status === "draft") return "Rascunho"
  if (c.status === "expired") return "Expirado"
  if (c.status === "cancelled") return "Cancelado"
  return c.status
}

type SupplierTerms = {
  title: string
  content: string
  version: string
  version_date: string
}

export default function FornecedorContratoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = React.use(params)
  const router = useRouter()
  const { loading: userLoading, supplierId } = useUser()

  const [contract, setContract] = React.useState<Contract | null>(null)
  const [acceptances, setAcceptances] = React.useState<ContractAcceptance[]>([])
  const [supplierTerms, setSupplierTerms] = React.useState<SupplierTerms | null>(
    null,
  )
  const [companyName, setCompanyName] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)
  const [acting, setActing] = React.useState(false)
  const [refuseReason, setRefuseReason] = React.useState("")
  const [showRefuseForm, setShowRefuseForm] = React.useState(false)
  const [termsAccepted, setTermsAccepted] = React.useState(false)
  const [termsDialogOpen, setTermsDialogOpen] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setNotFound(false)
    try {
      const res = await fetch(`/api/contracts/${id}/supplier-view`)
      const data = (await res.json()) as {
        contract?: Contract
        acceptances?: ContractAcceptance[]
        supplierTerms?: SupplierTerms | null
        companyName?: string
        error?: string
      }
      if (res.status === 404) {
        setContract(null)
        setNotFound(true)
        setAcceptances([])
        setSupplierTerms(null)
        setCompanyName("")
        return
      }
      if (!res.ok || !data.contract) {
        toast.error(data.error ?? "Não foi possível carregar o contrato.")
        setContract(null)
        setAcceptances([])
        setSupplierTerms(null)
        setCompanyName("")
        return
      }
      setContract(data.contract)
      setAcceptances(Array.isArray(data.acceptances) ? data.acceptances : [])
      setSupplierTerms(data.supplierTerms ?? null)
      setCompanyName(data.companyName?.trim() ?? "")
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    if (userLoading) return
    if (!supplierId) {
      setLoading(false)
      return
    }
    void load()
  }, [userLoading, supplierId, load])

  async function handleAccept() {
    setActing(true)
    try {
      const res = await fetch(`/api/contracts/${id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accepted" }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        toast.error(data.error ?? "Não foi possível aceitar o contrato.")
        return
      }
      toast.success("Contrato aceito!")
      setShowRefuseForm(false)
      setRefuseReason("")
      setTermsDialogOpen(false)
      setTermsAccepted(false)
      await load()
    } finally {
      setActing(false)
    }
  }

  async function handleRefuse() {
    const notes = refuseReason.trim()
    if (!notes) {
      toast.error("Informe o motivo da recusa.")
      return
    }
    setActing(true)
    try {
      const res = await fetch(`/api/contracts/${id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refused", notes }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        toast.error(data.error ?? "Não foi possível recusar o contrato.")
        return
      }
      toast.success("Contrato recusado")
      setShowRefuseForm(false)
      setRefuseReason("")
      await load()
    } finally {
      setActing(false)
    }
  }

  if (!userLoading && !supplierId) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Seu usuário não está vinculado a um fornecedor.
        </p>
      </div>
    )
  }

  if (loading && !contract) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <FileText className="h-5 w-5 animate-pulse" />
        <span className="text-sm">Carregando…</span>
      </div>
    )
  }

  if (notFound || !contract) {
    return (
      <div className="space-y-4 w-full">
        <Button type="button" variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <p className="text-sm text-muted-foreground">Contrato não encontrado.</p>
      </div>
    )
  }

  const displayCompany =
    companyName || contract.buyer_company_name?.trim() || "—"

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit"
            onClick={() => router.push("/fornecedor/contratos")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-mono text-xs">
              {contract.code}
            </Badge>
            <Badge className={statusBadgeClass(contract)}>{statusLabel(contract)}</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{contract.title}</h1>
        </div>
        {contract.status === "pending_acceptance" ? (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              type="button"
              variant="outline"
              className="text-destructive border-destructive"
              onClick={() => setShowRefuseForm(true)}
              disabled={acting}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Recusar
            </Button>
            <Button
              type="button"
              onClick={() => setTermsDialogOpen(true)}
              disabled={acting}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Aceitar Contrato
            </Button>
          </div>
        ) : null}
      </div>

      {contract.status === "pending_acceptance" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            Este contrato aguarda sua confirmação
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-300/90">
            Leia os termos e condições antes de aceitar ou recusar.
          </p>
        </div>
      ) : null}

      {contract.status === "pending_acceptance" && showRefuseForm ? (
        <Card className="border-destructive/50">
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-medium text-destructive">Motivo da recusa</p>
            <Textarea
              placeholder="Descreva o motivo da recusa (obrigatório)"
              value={refuseReason}
              onChange={(e) => setRefuseReason(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowRefuseForm(false)
                  setRefuseReason("")
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void handleRefuse()}
                disabled={!refuseReason.trim() || acting}
              >
                Confirmar Recusa
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Empresa Compradora</p>
              <p className="text-sm font-medium">{displayCompany}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tipo de Contrato</p>
              <p className="text-sm font-medium">
                {CONTRACT_KINDS.find((k) => k.value === contract.contract_kind)
                  ?.label ?? contract.contract_kind}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vigência</p>
              <p className="text-sm font-medium">
                {format(parseISO(contract.start_date), "dd/MM/yyyy", {
                  locale: ptBR,
                })}{" "}
                –{" "}
                {format(parseISO(contract.end_date), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Condição de Pagamento</p>
              <p className="text-sm font-medium">
                {contract.payment_condition_code
                  ? `${contract.payment_condition_code} — ${contract.payment_condition_description ?? ""}`
                  : "—"}
              </p>
            </div>
            {contract.contract_kind === "por_valor" ? (
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-sm font-medium">
                  {contract.value != null ? money.format(contract.value) : "—"}
                </p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {contract.items && contract.items.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="font-semibold">{formatBRL(contract.total_value)}</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-950/30">
              <p className="text-xs text-muted-foreground">Consumido</p>
              <p className="font-semibold text-blue-700 dark:text-blue-300">
                {formatBRL(contract.consumed_value)}
              </p>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center dark:bg-green-950/30">
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className="font-semibold text-green-700 dark:text-green-300">
                {formatBRL(
                  (contract.total_value ?? 0) - contract.consumed_value,
                )}
              </p>
            </div>
          </div>

          <div className="w-full overflow-hidden rounded-lg border border-border">
            <Table className="w-full text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="whitespace-nowrap">UN</TableHead>
                  <TableHead className="text-right whitespace-nowrap">
                    Qtd Contratada
                  </TableHead>
                  <TableHead className="text-right whitespace-nowrap">
                    Preço Unit.
                  </TableHead>
                  <TableHead className="text-right whitespace-nowrap">Prazo</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contract.items.map((item: ContractItem) => (
                  <TableRow key={item.id}>
                    <TableCell
                      className={`font-mono text-xs ${
                        item.eliminated ? "line-through opacity-50" : ""
                      }`}
                    >
                      {item.material_code}
                    </TableCell>
                    <TableCell
                      className={`max-w-[220px] ${
                        item.eliminated ? "line-through opacity-50" : ""
                      }`}
                    >
                      <span className="block">{item.material_description}</span>
                      {item.eliminated ? (
                        <Badge
                          variant="outline"
                          className="mt-1 text-destructive border-destructive text-xs"
                        >
                          Eliminado
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{item.unit_of_measure ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.quantity_contracted}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {money.format(item.unit_price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {item.delivery_days != null ? item.delivery_days : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {money.format(item.total_price)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}

      {contract.contract_terms?.trim() ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Termos Contratuais</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {contract.contract_terms}
          </p>
          <a
            href={`/termos/${contract.company_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Ver termos no portal
          </a>
        </div>
      ) : null}

      <Dialog
        open={termsDialogOpen}
        onOpenChange={(open) => {
          setTermsDialogOpen(open)
          if (!open) setTermsAccepted(false)
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Termos de Fornecimento</DialogTitle>
            {supplierTerms ? (
              <p className="text-xs text-muted-foreground">
                Versão {supplierTerms.version} ·{" "}
                {format(parseISO(supplierTerms.version_date), "dd/MM/yyyy")}
              </p>
            ) : null}
          </DialogHeader>

          {supplierTerms ? (
            <div className="space-y-4">
              <p className="text-sm whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto border rounded-md p-3 bg-muted/30">
                {supplierTerms.content}
              </p>
              <a
                href={`/termos/${contract.company_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Ver página completa dos termos
              </a>
              <div className="flex items-start gap-2 pt-2">
                <input
                  type="checkbox"
                  id="terms-accept"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5"
                />
                <label htmlFor="terms-accept" className="text-sm">
                  Declaro que li e concordo com os termos de fornecimento
                </label>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum termo de fornecimento cadastrado.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTermsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleAccept()}
              disabled={(!!supplierTerms && !termsAccepted) || acting}
            >
              {acting ? "Processando..." : "Confirmar Aceite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {contract.file_url ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" size="sm" asChild>
              <a
                href={contract.file_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Visualizar PDF
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {acceptances.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Histórico de Aceites</h3>
          <div className="space-y-2">
            {acceptances.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 text-sm border rounded-md px-3 py-2"
              >
                {a.action === "accepted" ? (
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="font-medium">
                    {a.action === "accepted" ? "Aceito" : "Recusado"}
                  </span>
                  {a.notes ? (
                    <span className="text-muted-foreground ml-2">— {a.notes}</span>
                  ) : null}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {format(parseISO(a.created_at), "dd/MM/yyyy HH:mm")}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
