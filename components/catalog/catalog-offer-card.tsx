"use client"

import { Loader2, Plus, ShoppingCart } from "lucide-react"
import type { CatalogOffer } from "@/lib/catalog/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

type CatalogOfferCardProps = {
  offer: CatalogOffer
  inCartQty?: number
  isAdding: boolean
  canOrder: boolean
  onAdd: () => void
}

export function CatalogOfferCard({
  offer,
  inCartQty,
  isAdding,
  canOrder,
  onAdd,
}: CatalogOfferCardProps) {
  const balanceLabel =
    offer.contractKind === "por_quantidade"
      ? `${offer.availableQuantity ?? 0} ${offer.unitOfMeasure ?? "un"}`
      : formatMoney(offer.availableValue)

  return (
    <article
      className={cn(
        "group flex flex-col rounded-lg border border-border bg-card p-3",
        "transition-shadow hover:shadow-sm",
        inCartQty && "ring-1 ring-primary/20",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <Badge
          variant="secondary"
          className="shrink-0 px-1.5 py-0 text-[10px] font-mono font-normal"
        >
          {offer.materialCode}
        </Badge>
        {inCartQty ? (
          <Badge variant="default" className="shrink-0 px-1.5 py-0 text-[10px]">
            {inCartQty} no carrinho
          </Badge>
        ) : null}
      </div>

      <h3 className="line-clamp-2 min-h-[2.25rem] text-sm font-medium leading-snug text-foreground">
        {offer.materialDescription}
      </h3>

      <p className="mt-1 truncate text-[11px] text-muted-foreground">
        {offer.supplierName} · {offer.contractCode}
      </p>

      <div className="mt-2.5 flex items-end justify-between gap-2 border-t border-border/60 pt-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold tabular-nums leading-none">
            {formatMoney(offer.unitPrice)}
            {offer.unitOfMeasure ? (
              <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">
                /{offer.unitOfMeasure}
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">Saldo {balanceLabel}</p>
        </div>
      </div>

      {canOrder ? (
        <Button
          size="sm"
          variant={inCartQty ? "secondary" : "default"}
          className="mt-2.5 h-8 w-full text-xs"
          disabled={isAdding}
          onClick={onAdd}
        >
          {isAdding ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : inCartQty ? (
            <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
          ) : (
            <Plus className="mr-1.5 h-3.5 w-3.5" />
          )}
          {inCartQty ? "Adicionar mais" : "Adicionar"}
        </Button>
      ) : (
        <p className="mt-2.5 text-center text-[10px] text-muted-foreground">
          Somente visualização
        </p>
      )}
    </article>
  )
}
