"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Link2, Loader2 } from "lucide-react"
import { equalizacaoContractMatchesDialogQueryOptions } from "@/lib/queries/equalizacao-contract-matches-dialog"
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
  const [rows, setRows] = React.useState<MatchRow[]>([])

  const selectionInput = React.useMemo(
    () =>
      selections.map((s) => ({
        quotationItemId: s.quotationItemId,
        supplierId: s.supplierId,
        materialCode: s.materialCode,
        quantity: s.quantity,
      })),
    [selections],
  )

  const matchesQuery = useQuery({
    ...equalizacaoContractMatchesDialogQueryOptions(
      quotationId,
      selectionInput,
      open,
    ),
  })

  const loading = matchesQuery.isLoading

  React.useEffect(() => {
    if (matchesQuery.isError) {
      toast.error(
        matchesQuery.error instanceof Error
          ? matchesQuery.error.message
          : "Erro ao buscar contratos compatíveis",
      )
    }
  }, [matchesQuery.isError, matchesQuery.error])

  React.useEffect(() => {
    if (!open || !matchesQuery.data) {
// eslint-disable-next-line react-hooks/set-state-in-effect -- ver docs/PADRAO-CARGA-DADOS.md
      if (!open) setRows([])
      return
    }

    const nextRows: MatchRow[] = selections.map((sel) => {
      const apiRow = matchesQuery.data.find(
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
  }, [open, matchesQuery.data, selections])

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
