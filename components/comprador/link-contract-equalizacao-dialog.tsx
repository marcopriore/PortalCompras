"use client"

import * as React from "react"
import { Link2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  EqualizacaoContractLink,
  ContractMatchCandidate,
} from "@/lib/contracts/match-contract-items"
import { contractLinkFromMatch } from "@/lib/contracts/match-contract-items"

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

export type EqualizacaoSelectionRow = {
  quotationItemId: string
  supplierId: string
  supplierName: string
  materialCode: string
  materialDescription: string
  quantity: number
}

type MatchRow = {
  quotationItemId: string
  candidates: ContractMatchCandidate[]
  linked: boolean
  selectedContractItemId: string | null
}

type Props = {
  quotationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  selections: EqualizacaoSelectionRow[]
  onConfirm: (
    links: Record<string, EqualizacaoContractLink | null>,
  ) => void | Promise<void>
  submitting?: boolean
}

export function LinkContractEqualizacaoDialog({
  quotationId,
  open,
  onOpenChange,
  selections,
  onConfirm,
  submitting = false,
}: Props) {
  const [loading, setLoading] = React.useState(false)
  const [rows, setRows] = React.useState<MatchRow[]>([])

  React.useEffect(() => {
    if (!open || selections.length === 0) return

    let cancelled = false
    setLoading(true)

    void (async () => {
      try {
        const res = await fetch(`/api/quotations/${quotationId}/contract-matches`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selections: selections.map((s) => ({
              quotationItemId: s.quotationItemId,
              supplierId: s.supplierId,
              materialCode: s.materialCode,
              quantity: s.quantity,
            })),
          }),
        })
        const data = (await res.json()) as {
          items?: Array<{
            quotationItemId: string
            candidates: ContractMatchCandidate[]
            suggested: EqualizacaoContractLink | null
          }>
          error?: string
        }

        if (!res.ok) {
          toast.error(data.error ?? "Não foi possível buscar contratos")
          return
        }

        if (cancelled) return

        const nextRows: MatchRow[] = selections.map((sel) => {
          const apiRow = data.items?.find(
            (i) => i.quotationItemId === sel.quotationItemId,
          )
          const candidates = apiRow?.candidates ?? []
          const selectedContractItemId =
            apiRow?.suggested?.contractItemId ??
            candidates[0]?.contractItemId ??
            null

          return {
            quotationItemId: sel.quotationItemId,
            candidates,
            linked: Boolean(apiRow?.suggested ?? candidates[0]),
            selectedContractItemId,
          }
        })

        setRows(nextRows)
      } catch {
        toast.error("Erro ao buscar contratos compatíveis")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, quotationId, selections])

  const handleToggle = (quotationItemId: string, linked: boolean) => {
    setRows((prev) =>
      prev.map((row) =>
        row.quotationItemId === quotationItemId ? { ...row, linked } : row,
      ),
    )
  }

  const handleSelectCandidate = (
    quotationItemId: string,
    contractItemId: string,
  ) => {
    setRows((prev) =>
      prev.map((row) =>
        row.quotationItemId === quotationItemId
          ? { ...row, selectedContractItemId: contractItemId, linked: true }
          : row,
      ),
    )
  }

  const handleConfirm = async () => {
    const links: Record<string, EqualizacaoContractLink | null> = {}

    for (const row of rows) {
      if (!row.linked || !row.selectedContractItemId) {
        links[row.quotationItemId] = null
        continue
      }
      const candidate = row.candidates.find(
        (c) => c.contractItemId === row.selectedContractItemId,
      )
      if (!candidate) {
        toast.error("Selecione um item de contrato válido para cada linha vinculada")
        return
      }
      links[row.quotationItemId] = contractLinkFromMatch(candidate)
    }

    try {
      await onConfirm(links)
      onOpenChange(false)
    } catch {
      // Erros exibidos em handleFinalize
    }
  }

  const linkedCount = rows.filter((r) => r.linked && r.candidates.length > 0).length
  const matchableCount = rows.filter((r) => r.candidates.length > 0).length
  const canConfirm = !loading && !submitting && matchableCount > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Contratos encontrados
          </DialogTitle>
          <DialogDescription>
            Identificamos contratos ativos compatíveis com os itens selecionados.
            Confirme o vínculo para usar o preço do contrato e reservar saldo. Itens
            não marcados seguem com o preço da proposta no mesmo pedido.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Analisando contratos compatíveis...
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {`${linkedCount} de ${matchableCount} itens com contrato serão vinculados ao pedido.`}
            </p>

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Item</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Contrato / Item</TableHead>
                    <TableHead className="text-right">Preço contrato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selections.map((sel) => {
                    const row = rows.find(
                      (r) => r.quotationItemId === sel.quotationItemId,
                    )
                    const candidates = row?.candidates ?? []
                    const selectedId = row?.selectedContractItemId
                    const selected = candidates.find(
                      (c) => c.contractItemId === selectedId,
                    )

                    return (
                      <TableRow key={sel.quotationItemId}>
                        <TableCell>
                          <Checkbox
                            checked={Boolean(row?.linked && candidates.length > 0)}
                            disabled={candidates.length === 0 || submitting}
                            onCheckedChange={(v) =>
                              handleToggle(sel.quotationItemId, v === true)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <p className="font-mono text-xs">{sel.materialCode}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                            {sel.materialDescription}
                          </p>
                        </TableCell>
                        <TableCell className="text-xs">{sel.supplierName}</TableCell>
                        <TableCell>
                          {candidates.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              Sem contrato — preço da proposta
                            </span>
                          ) : (
                            <Select
                              value={selectedId ?? undefined}
                              disabled={submitting}
                              onValueChange={(v) =>
                                handleSelectCandidate(sel.quotationItemId, v)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {candidates.map((c) => (
                                  <SelectItem
                                    key={c.contractItemId}
                                    value={c.contractItemId}
                                  >
                                    {c.contractCode} · item {c.lineNumber} —{" "}
                                    {c.materialCode}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {selected ? money.format(selected.unitPrice) : "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading || submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!canConfirm}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando pedido...
              </>
            ) : (
              "Confirmar e criar pedido"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
