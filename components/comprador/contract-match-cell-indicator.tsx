"use client"

import { FileSignature } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ContractMatchCandidate } from "@/lib/contracts/match-contract-items"

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

function formatCurrency(value: number) {
  return money.format(value)
}

function matchReasonLabel(reason: ContractMatchCandidate["matchReason"]) {
  if (reason === "quotation_item_id") return "Vínculo direto ao item"
  return "Por código do material"
}

type ContractMatchCellIndicatorProps = {
  match: ContractMatchCandidate | null | undefined
}

export function ContractMatchCellIndicator({
  match,
}: ContractMatchCellIndicatorProps) {
  if (!match) return null

  const balanceLabel =
    match.contractKind === "por_quantidade"
      ? `Saldo disponível: ${match.availableQuantity.toLocaleString("pt-BR")} un.`
      : `Saldo disponível: ${formatCurrency(match.availableValue)}`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex shrink-0 text-primary"
          aria-label={`Contrato compatível: ${match.contractCode}`}
        >
          <FileSignature className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs space-y-1">
        <p className="font-medium">
          {match.contractCode}
          {match.lineNumber > 0 ? ` · Item ${match.lineNumber}` : ""}
        </p>
        <p>Preço contrato: {formatCurrency(match.unitPrice)}</p>
        <p>{balanceLabel}</p>
        <p className="text-background/80">{matchReasonLabel(match.matchReason)}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export function contractMatchCellKey(
  quotationItemId: string,
  supplierId: string,
): string {
  return `${quotationItemId}:${supplierId}`
}
