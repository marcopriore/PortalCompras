"use client"

import * as React from "react"
import {
  Building2,
  Loader2,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react"
import type { CatalogCart, CatalogCartItem } from "@/lib/catalog/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

type SupplierGroup = {
  supplierId: string
  items: CatalogCartItem[]
  subtotal: number
}

function groupBySupplier(items: CatalogCartItem[]): SupplierGroup[] {
  const map = new Map<string, CatalogCartItem[]>()
  for (const item of items) {
    const list = map.get(item.supplierId) ?? []
    list.push(item)
    map.set(item.supplierId, list)
  }
  return [...map.entries()].map(([supplierId, groupItems]) => ({
    supplierId,
    items: groupItems,
    subtotal: groupItems.reduce((s, i) => s + i.lineTotal, 0),
  }))
}

function CartQuantityInput({
  itemId,
  quantity,
  syncing,
  disabled,
  onQuantityChange,
}: {
  itemId: string
  quantity: number
  syncing: boolean
  disabled?: boolean
  onQuantityChange: (itemId: string, quantity: number) => void
}) {
  const [draft, setDraft] = React.useState(String(quantity))
  const [focused, setFocused] = React.useState(false)

  React.useEffect(() => {
    if (!focused) setDraft(String(quantity))
  }, [quantity, focused])

  const commitDraft = () => {
    const parsed = Number(draft.replace(",", "."))
    if (!Number.isFinite(parsed) || parsed < 1) {
      setDraft(String(Math.max(1, quantity)))
      if (quantity < 1) onQuantityChange(itemId, 1)
      return
    }
    const next = Math.floor(parsed)
    setDraft(String(next))
    if (next !== quantity) onQuantityChange(itemId, next)
  }

  return (
    <div className="relative flex items-center rounded-lg border border-border bg-background">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-none rounded-l-lg"
        onClick={() => onQuantityChange(itemId, Math.max(1, quantity - 1))}
        disabled={disabled || syncing || quantity <= 1}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <div className="relative flex h-8 w-14 items-center justify-center border-x border-border">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label="Quantidade"
          value={draft}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            commitDraft()
          }}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d]/g, "")
            setDraft(raw)
            if (raw === "") return
            const next = Number(raw)
            if (!Number.isFinite(next) || next < 1) return
            onQuantityChange(itemId, next)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
          }}
          disabled={disabled || syncing}
          className={cn(
            "h-full w-full bg-transparent px-1 text-center text-sm font-medium tabular-nums outline-none",
            "focus-visible:bg-muted/40",
            (disabled || syncing) && "text-muted-foreground",
            syncing && !focused && "opacity-0",
          )}
        />
        {syncing && !focused ? (
          <Loader2 className="pointer-events-none absolute h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-none rounded-r-lg"
        onClick={() => onQuantityChange(itemId, quantity + 1)}
        disabled={disabled || syncing}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

type CatalogCartSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cart: CatalogCart
  supplierNames?: Record<string, string>
  syncingItemIds: Set<string>
  addingOfferId: string | null
  onCheckout: () => void
  onRemove: (itemId: string) => void
  onQuantityChange: (itemId: string, quantity: number) => void
}

export function CatalogCartSheet({
  open,
  onOpenChange,
  cart,
  supplierNames = {},
  syncingItemIds,
  addingOfferId,
  onCheckout,
  onRemove,
  onQuantityChange,
}: CatalogCartSheetProps) {
  const supplierGroups = React.useMemo(
    () => groupBySupplier(cart.items),
    [cart.items],
  )
  const totalUnits = cart.items.reduce((s, i) => s + i.quantity, 0)
  const requisitionCount = supplierGroups.length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border bg-card px-6 py-5 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <ShoppingBag className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg">Seu carrinho</SheetTitle>
              <SheetDescription>
                {cart.itemCount === 0
                  ? "Nenhum item selecionado"
                  : `${cart.itemCount} produto(s) · ${totalUnits} unidade(s)`}
              </SheetDescription>
            </div>
            {cart.itemCount > 0 && (
              <Badge variant="secondary" className="shrink-0">
                {cart.itemCount}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Package className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Carrinho vazio</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Adicione itens do catálogo para montar seu pedido por contrato.
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {supplierGroups.map((group) => (
                <div
                  key={group.supplierId}
                  className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate text-sm font-medium">
                        {supplierNames[group.supplierId] ?? "Fornecedor"}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatMoney(group.subtotal)}
                    </span>
                  </div>

                  <div className="divide-y divide-border">
                    {group.items.map((item) => {
                      const syncing = syncingItemIds.has(item.id)
                      return (
                        <div key={item.id} className="px-4 py-3 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <p className="text-sm font-medium leading-snug">
                                {item.materialDescription}
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="text-[10px]">
                                  {item.materialCode}
                                </Badge>
                                {item.unitOfMeasure && (
                                  <span className="text-xs text-muted-foreground">
                                    {item.unitOfMeasure}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => onRemove(item.id)}
                              disabled={syncing}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <CartQuantityInput
                              itemId={item.id}
                              quantity={item.quantity}
                              syncing={syncing}
                              onQuantityChange={onQuantityChange}
                            />
                            <div className="text-right">
                              <p className="text-sm font-semibold tabular-nums">
                                {formatMoney(item.lineTotal)}
                              </p>
                              <p className="text-[11px] text-muted-foreground tabular-nums">
                                {formatMoney(item.unitPrice)} un.
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border bg-muted/30 px-4 py-4 space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Resumo do pedido
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium tabular-nums">
                      {formatMoney(cart.totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Fornecedores</span>
                    <span className="font-medium">{requisitionCount}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Pedidos a gerar</span>
                    <span className="font-medium">{requisitionCount}</span>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between gap-4 text-base font-semibold">
                  <span>Total</span>
                  <span className="text-primary tabular-nums">
                    {formatMoney(cart.totalAmount)}
                  </span>
                </div>
                {requisitionCount > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Serão criados {requisitionCount} pedidos em rascunho — um por fornecedor.
                  </p>
                )}
              </div>

              <Button className="w-full h-11" onClick={onCheckout}>
                Finalizar pedido
              </Button>
            </div>
          </>
        )}

        {addingOfferId && (
          <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs shadow-lg">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              Adicionando...
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
