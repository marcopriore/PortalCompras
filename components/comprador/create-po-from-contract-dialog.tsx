"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Package, Loader2 } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Contract, ContractItem } from "@/types/contracts"
import {
  contractAvailableValue,
  contractItemAvailableQuantity,
  validatePoLineQuantity,
} from "@/lib/contracts/contract-balance-helpers"

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

type LineState = {
  selected: boolean
  quantity: string
}

type Props = {
  contract: Contract
  open: boolean
  onOpenChange: (open: boolean) => void
}

function activeItems(contract: Contract): ContractItem[] {
  return (contract.items ?? []).filter((i) => !i.eliminated)
}

export function CreatePoFromContractDialog({ contract, open, onOpenChange }: Props) {
  const router = useRouter()
  const [observations, setObservations] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [lines, setLines] = React.useState<Record<string, LineState>>({})

  const items = React.useMemo(() => activeItems(contract), [contract])

  React.useEffect(() => {
    if (!open) return
    const initial: Record<string, LineState> = {}
    for (const item of items) {
      const available = contractItemAvailableQuantity(item)
      initial[item.id] = {
        selected: false,
        quantity: available > 0 ? String(available) : "0",
      }
    }
    setLines(initial)
    setObservations("")
  }, [open, items])

  const selectedTotal = React.useMemo(() => {
    let total = 0
    for (const item of items) {
      const line = lines[item.id]
      if (!line?.selected) continue
      const qty = parseFloat(line.quantity.replace(",", "."))
      if (!Number.isFinite(qty) || qty <= 0) continue
      total += qty * item.unit_price
    }
    return total
  }, [items, lines])

  const headerAvailable =
    contract.contract_kind === "por_valor" ? contractAvailableValue(contract) : null

  const handleToggle = (itemId: string, checked: boolean) => {
    setLines((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], selected: checked },
    }))
  }

  const handleQuantity = (itemId: string, value: string) => {
    setLines((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantity: value },
    }))
  }

  const handleSubmit = async () => {
    const payload: { contract_item_id: string; quantity: number }[] = []
    for (const item of items) {
      const line = lines[item.id]
      if (!line?.selected) continue
      const qty = parseFloat(line.quantity.replace(",", "."))
      const err = validatePoLineQuantity(contract.contract_kind, item, qty)
      if (err) {
        toast.error(`${item.material_code}: ${err}`)
        return
      }
      payload.push({ contract_item_id: item.id, quantity: qty })
    }

    if (payload.length === 0) {
      toast.error("Selecione ao menos um item")
      return
    }

    if (
      contract.contract_kind === "por_valor" &&
      headerAvailable != null &&
      selectedTotal > headerAvailable
    ) {
      toast.error(
        `Valor do pedido (${money.format(selectedTotal)}) excede o saldo do contrato (${money.format(headerAvailable)})`,
      )
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/contracts/${contract.id}/create-purchase-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: payload,
          observations: observations.trim() || undefined,
        }),
      })
      const data = (await res.json()) as {
        purchase_order?: { id: string; code: string }
        purchase_orders?: { id: string; code: string }[]
        error?: string
      }
      if (!res.ok || !data.purchase_order) {
        toast.error(data.error ?? "Não foi possível criar o pedido")
        return
      }
      const orders = data.purchase_orders ?? [data.purchase_order]
      if (orders.length === 1) {
        toast.success(`Pedido ${data.purchase_order.code} criado com sucesso`)
      } else {
        toast.success(
          `${orders.length} pedidos criados: ${orders.map((o) => o.code).join(", ")}`,
        )
      }
      onOpenChange(false)
      router.push(`/comprador/pedidos/${data.purchase_order.id}`)
    } catch {
      toast.error("Erro ao criar pedido")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Criar Pedido do Contrato
          </DialogTitle>
          <DialogDescription>
            Selecione os itens e quantidades. Será criado um pedido em rascunho por centro /
            filial, com endereço de entrega do cadastro. O saldo será reservado no contrato{" "}
            {contract.code}.
          </DialogDescription>
        </DialogHeader>

        {contract.contract_kind === "por_valor" && headerAvailable != null ? (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Saldo disponível do contrato: </span>
            <span className="font-semibold text-green-700 dark:text-green-400">
              {money.format(headerAvailable)}
            </span>
          </div>
        ) : null}

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Disp.</TableHead>
                <TableHead className="text-right w-28">Qtd</TableHead>
                <TableHead className="text-right">Preço</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const line = lines[item.id]
                const available = contractItemAvailableQuantity(item)
                const disabled = available <= 0
                return (
                  <TableRow key={item.id} className={disabled ? "opacity-50" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={line?.selected ?? false}
                        disabled={disabled}
                        onCheckedChange={(v) => handleToggle(item.id, v === true)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.material_code}</TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {item.material_description}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{available}</TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        inputMode="decimal"
                        className="text-right h-8"
                        disabled={!line?.selected || disabled}
                        value={line?.quantity ?? ""}
                        onChange={(e) => handleQuantity(item.id, e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {money.format(item.unit_price)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end text-sm">
          <span className="text-muted-foreground mr-2">Total do pedido:</span>
          <span className="font-semibold">{money.format(selectedTotal)}</span>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="po-observations">Observações</Label>
          <Textarea
            id="po-observations"
            rows={2}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Opcional"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              "Criar Pedido"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
