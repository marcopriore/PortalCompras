"use client"

import * as React from "react"
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Search, ShoppingCart, X } from "lucide-react"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { hasCatalogViewAccess } from "@/lib/permissions/catalog-access"
import type { CatalogCart, CatalogOffer } from "@/lib/catalog/types"
import {
  mergeCartItem,
  removeLocalCartItem,
  updateLocalCartQuantity,
} from "@/lib/catalog/cart-service"
import { CatalogCartSheet } from "@/components/catalog/catalog-cart-sheet"
import { CatalogOfferCard } from "@/components/catalog/catalog-offer-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import MultiSelectFilter from "@/components/ui/multi-select-filter"
import {
  CostCenterSelect,
  loadUserDefaultCostCenterCode,
} from "@/components/ui/cost-center-select"
import {
  catalogOffersInfiniteQueryOptions,
  type CatalogOffersFilters,
} from "@/lib/queries/catalog-offers"
import { catalogCartQueryOptions } from "@/lib/queries/catalog-cart"
import { queryKeys } from "@/lib/queries/keys"

type PurchaseCatalogPageProps = {
  portal: "comprador" | "solicitante"
  requisitionDetailBasePath: string
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

const emptyCatalogCart = (): CatalogCart => ({
  id: "",
  items: [],
  itemCount: 0,
  totalAmount: 0,
})

export function PurchaseCatalogPage({
  portal,
  requisitionDetailBasePath,
}: PurchaseCatalogPageProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { companyId, userId, loading: userLoading } = useUser()
  const {
    hasFeature,
    hasPermission,
    canWrite,
    loading: permissionsLoading,
  } = usePermissions()

  const [cartOverlay, setCartOverlay] = React.useState<CatalogCart | null>(null)
  const serverCartRef = React.useRef<CatalogCart>(emptyCatalogCart())
  const qtyTimersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  )
  const pendingQtyRef = React.useRef<Map<string, number>>(new Map())

  const loadMoreRef = React.useRef<HTMLDivElement>(null)
  const [search, setSearch] = React.useState("")
  const debouncedSearch = useDebouncedValue(search, 350)
  const [contractSearch, setContractSearch] = React.useState("")
  const debouncedContractSearch = useDebouncedValue(contractSearch, 350)
  const [groupFilter, setGroupFilter] = React.useState<string[]>([])
  const [supplierFilter, setSupplierFilter] = React.useState<string[]>([])
  const [cartOpen, setCartOpen] = React.useState(false)
  const [checkoutOpen, setCheckoutOpen] = React.useState(false)
  const [checkingOut, setCheckingOut] = React.useState(false)
  const [addingOfferId, setAddingOfferId] = React.useState<string | null>(null)
  const [syncingItemIds, setSyncingItemIds] = React.useState<Set<string>>(
    () => new Set(),
  )

  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [costCenter, setCostCenter] = React.useState("")
  const [neededBy, setNeededBy] = React.useState("")
  const [priority, setPriority] = React.useState<"normal" | "urgent" | "critical">(
    "normal",
  )

  const moduleEnabled = hasFeature("purchase_catalog")
  const canBrowse = moduleEnabled && hasCatalogViewAccess(hasPermission)
  const clientCanOrder = canWrite("catalog.order")

  const offerFilters = React.useMemo<CatalogOffersFilters>(
    () => ({
      search: debouncedSearch,
      contractSearch: debouncedContractSearch,
      commodityGroups: groupFilter,
      supplierIds: supplierFilter,
    }),
    [debouncedSearch, debouncedContractSearch, groupFilter, supplierFilter],
  )

  const offersQuery = useInfiniteQuery({
    ...catalogOffersInfiniteQueryOptions(companyId ?? "", offerFilters),
    enabled:
      !userLoading && !permissionsLoading && Boolean(companyId) && canBrowse,
  })

  React.useEffect(() => {
    if (offersQuery.isError) {
      toast.error(
        offersQuery.error instanceof Error
          ? offersQuery.error.message
          : "Erro ao carregar catálogo",
      )
    }
  }, [offersQuery.isError, offersQuery.error])

  const firstOffersPage = offersQuery.data?.pages[0]
  const offers = React.useMemo(
    () => offersQuery.data?.pages.flatMap((page) => page.offers) ?? [],
    [offersQuery.data],
  )
  const commodityGroups = firstOffersPage?.commodityGroups ?? []
  const suppliers = firstOffersPage?.suppliers ?? []
  const totalOffers = firstOffersPage?.total ?? 0
  const hasMoreOffers = offersQuery.hasNextPage ?? false
  const loadingOffers = offersQuery.isLoading
  const loadingMore = offersQuery.isFetchingNextPage

  const serverCanOrder = firstOffersPage?.can_order
  const canOrder =
    typeof serverCanOrder === "boolean" ? serverCanOrder : clientCanOrder

  const cartQuery = useQuery({
    ...catalogCartQueryOptions(companyId ?? ""),
    enabled:
      canOrder && !userLoading && !permissionsLoading && Boolean(companyId),
  })
  const initialCartLoaded = cartQuery.isFetched
  const cart = cartOverlay ?? cartQuery.data ?? emptyCatalogCart()

  const applyServerCart = React.useCallback(
    (next: CatalogCart) => {
      serverCartRef.current = next
      setCartOverlay(next)
      if (companyId) {
        queryClient.setQueryData(
          [...queryKeys.catalogOffers(companyId), "cart"],
          next,
        )
      }
    },
    [companyId, queryClient],
  )

  const setCart = React.useCallback(
    (updater: CatalogCart | ((prev: CatalogCart) => CatalogCart)) => {
      setCartOverlay((prevOverlay) => {
        const base = prevOverlay ?? cartQuery.data ?? emptyCatalogCart()
        const next =
          typeof updater === "function" ? updater(base) : updater
        serverCartRef.current = next
        return next
      })
    },
    [cartQuery.data],
  )

  const fetchNextOffersPage = offersQuery.fetchNextPage
  const hasNextOffersPage = offersQuery.hasNextPage

  React.useEffect(() => {
    if (!hasMoreOffers || loadingOffers || loadingMore) return

    const node = loadMoreRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextOffersPage) {
          void fetchNextOffersPage()
        }
      },
      { rootMargin: "240px" },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [
    hasMoreOffers,
    loadingOffers,
    loadingMore,
    hasNextOffersPage,
    fetchNextOffersPage,
  ])

  React.useEffect(() => {
    if (!companyId || !userId || !checkoutOpen) return
    void loadUserDefaultCostCenterCode(userId).then((code) => {
      if (code) setCostCenter(code)
    })
  }, [companyId, userId, checkoutOpen])

  React.useEffect(() => {
    return () => {
      for (const timer of qtyTimersRef.current.values()) {
        clearTimeout(timer)
      }
    }
  }, [])

  const supplierNameMap = React.useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of suppliers) map[s.id] = s.name
    for (const o of offers) {
      if (!map[o.supplierId]) map[o.supplierId] = o.supplierName
    }
    return map
  }, [suppliers, offers])

  const cartQtyByOffer = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const item of cart.items) {
      map.set(item.contractItemId, item.quantity)
    }
    return map
  }, [cart.items])

  async function addToCart(offer: CatalogOffer) {
    if (!canOrder) return

    const existingQty = cartQtyByOffer.get(offer.contractItemId) ?? 0
    const nextQty = existingQty + 1
    const optimisticItem = {
      id: `temp-${offer.contractItemId}`,
      contractId: offer.contractId,
      contractItemId: offer.contractItemId,
      supplierId: offer.supplierId,
      materialCode: offer.materialCode,
      materialDescription: offer.materialDescription,
      unitOfMeasure: offer.unitOfMeasure,
      unitPrice: offer.unitPrice,
      contractKind: offer.contractKind,
      quantity: nextQty,
      lineTotal: nextQty * offer.unitPrice,
    }

    const previousCart = cart
    setCart((prev) => mergeCartItem(prev, optimisticItem))
    setCartOpen(true)
    setAddingOfferId(offer.contractItemId)

    // Sync em background: UI já reflete o item; não bloqueia novos adds.
    void (async () => {
      try {
        const res = await fetch("/api/catalog/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contract_item_id: offer.contractItemId,
            quantity: 1,
          }),
        })
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
          cart?: CatalogCart
        }
        if (!res.ok) throw new Error(body.error ?? "Erro ao adicionar ao carrinho")
        if (body.cart) applyServerCart(body.cart)
      } catch (err) {
        try {
          const res = await fetch("/api/catalog/cart")
          if (res.ok) {
            const data = (await res.json()) as { cart?: CatalogCart }
            if (data.cart) applyServerCart(data.cart)
            else setCart(previousCart)
          } else {
            setCart(previousCart)
          }
        } catch {
          setCart(previousCart)
        }
        toast.error(err instanceof Error ? err.message : "Erro ao adicionar")
      } finally {
        setAddingOfferId((current) =>
          current === offer.contractItemId ? null : current,
        )
      }
    })()
  }

  function markSyncing(itemId: string, syncing: boolean) {
    setSyncingItemIds((prev) => {
      const next = new Set(prev)
      if (syncing) next.add(itemId)
      else next.delete(itemId)
      return next
    })
  }

  async function syncQuantity(itemId: string, quantity: number) {
    markSyncing(itemId, true)
    const previousCart = serverCartRef.current
    try {
      const res = await fetch("/api/catalog/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, quantity }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        cart?: CatalogCart
      }
      if (!res.ok) throw new Error(body.error ?? "Erro ao atualizar quantidade")
      if (body.cart) applyServerCart(body.cart)
    } catch (err) {
      setCart(previousCart)
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar")
    } finally {
      markSyncing(itemId, false)
      pendingQtyRef.current.delete(itemId)
    }
  }

  function handleQuantityChange(itemId: string, quantity: number) {
    if (!canOrder) return

    setCart((prev) => updateLocalCartQuantity(prev, itemId, quantity))
    pendingQtyRef.current.set(itemId, quantity)

    const existingTimer = qtyTimersRef.current.get(itemId)
    if (existingTimer) clearTimeout(existingTimer)

    qtyTimersRef.current.set(
      itemId,
      setTimeout(() => {
        qtyTimersRef.current.delete(itemId)
        const pendingQty = pendingQtyRef.current.get(itemId)
        if (pendingQty === undefined) return
        void syncQuantity(itemId, pendingQty)
      }, 450),
    )
  }

  async function removeCartItem(itemId: string) {
    if (!canOrder) return

    const existingTimer = qtyTimersRef.current.get(itemId)
    if (existingTimer) {
      clearTimeout(existingTimer)
      qtyTimersRef.current.delete(itemId)
    }
    pendingQtyRef.current.delete(itemId)

    const previousCart = cart
    setCart((prev) => removeLocalCartItem(prev, itemId))
    markSyncing(itemId, true)

    try {
      const res = await fetch(
        `/api/catalog/cart?item_id=${encodeURIComponent(itemId)}`,
        { method: "DELETE" },
      )
      const body = (await res.json().catch(() => ({}))) as {
        cart?: CatalogCart
        error?: string
      }
      if (!res.ok) throw new Error(body.error ?? "Erro ao remover item")
      if (body.cart) applyServerCart(body.cart)
    } catch (err) {
      setCart(previousCart)
      toast.error(err instanceof Error ? err.message : "Erro ao remover")
    } finally {
      markSyncing(itemId, false)
    }
  }

  async function handleCheckout() {
    if (!canOrder) return
    if (!title.trim()) {
      toast.error("Título é obrigatório")
      return
    }
    if (!costCenter.trim()) {
      toast.error("Centro de custo é obrigatório")
      return
    }
    if (cart.items.length === 0) {
      toast.error("Carrinho vazio")
      return
    }

    for (const [itemId, timer] of qtyTimersRef.current.entries()) {
      clearTimeout(timer)
      qtyTimersRef.current.delete(itemId)
      const qty = pendingQtyRef.current.get(itemId)
      if (qty !== undefined) {
        await syncQuantity(itemId, qty)
      }
    }

    setCheckingOut(true)
    try {
      const res = await fetch("/api/catalog/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          cost_center: costCenter.trim(),
          needed_by: neededBy || null,
          priority,
        }),
      })
      const body = (await res.json()) as {
        error?: string
        purchase_orders?: Array<{
          id: string
          code: string
          requisitionId?: string
          requisitionCode?: string
        }>
      }
      if (!res.ok) throw new Error(body.error ?? "Erro no checkout")

      const orders = body.purchase_orders ?? []

      toast.success(
        orders.length === 1
          ? `Pedido ${orders[0].code} e requisição ${orders[0].requisitionCode ?? ""} criados`
          : `${orders.length} pedidos com requisições vinculadas criados`,
      )

      setCheckoutOpen(false)
      setCartOpen(false)
      setTitle("")
      setDescription("")
      applyServerCart({ id: "", items: [], itemCount: 0, totalAmount: 0 })

      if (orders.length === 1) {
        if (portal === "comprador") {
          router.push(`/comprador/pedidos/${orders[0].id}`)
        } else if (orders[0].requisitionId) {
          router.push(`/solicitante/${orders[0].requisitionId}`)
        } else {
          router.push("/solicitante")
        }
      } else if (portal === "comprador") {
        router.push("/comprador/pedidos")
      } else {
        router.push("/solicitante")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no checkout")
    } finally {
      setCheckingOut(false)
    }
  }

  if (userLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!canBrowse) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          O Catálogo de Compras não está habilitado para sua empresa.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo de Compras</h1>
          <p className="text-sm text-muted-foreground">
            Itens disponíveis em contratos ativos com saldo
          </p>
        </div>
        {canOrder && (
          <Button variant="outline" onClick={() => setCartOpen(true)}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Carrinho
            {cart.itemCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {cart.itemCount}
              </Badge>
            )}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar item ou fornecedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-48">
          <Input
            placeholder="Nº contrato (Valore/ERP)"
            value={contractSearch}
            onChange={(e) => setContractSearch(e.target.value)}
          />
        </div>
        <MultiSelectFilter
          label="Grupo"
          options={commodityGroups.map((g) => ({ value: g, label: g }))}
          selected={groupFilter}
          onChange={setGroupFilter}
          width="w-48"
        />
        <MultiSelectFilter
          label="Fornecedor"
          options={suppliers.map((s) => ({
            value: s.id,
            label: `${s.code} — ${s.name}`,
          }))}
          selected={supplierFilter}
          onChange={setSupplierFilter}
          width="w-48"
        />
      </div>

      {loadingOffers ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : offers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma oferta encontrada com os filtros atuais.
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Exibindo {offers.length} de {totalOffers} item(ns)
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {offers.map((offer) => {
              const inCartQty = cartQtyByOffer.get(offer.contractItemId)
              const isAdding = addingOfferId === offer.contractItemId
              return (
                <CatalogOfferCard
                  key={offer.contractItemId}
                  offer={offer}
                  inCartQty={inCartQty}
                  isAdding={isAdding}
                  canOrder={canOrder}
                  onAdd={() => void addToCart(offer)}
                />
              )
            })}
          </div>
          <div ref={loadMoreRef} className="flex justify-center py-6">
            {loadingMore ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : hasMoreOffers ? (
              <span className="text-xs text-muted-foreground">
                Role para carregar mais itens…
              </span>
            ) : offers.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                Todos os itens foram carregados.
              </span>
            ) : null}
          </div>
        </>
      )}

      {canOrder && initialCartLoaded && (
        <CatalogCartSheet
          open={cartOpen}
          onOpenChange={setCartOpen}
          cart={cart}
          supplierNames={supplierNameMap}
          syncingItemIds={syncingItemIds}
          onCheckout={() => setCheckoutOpen(true)}
          onRemove={(itemId) => void removeCartItem(itemId)}
          onQuantityChange={handleQuantityChange}
        />
      )}

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Finalizar pedido do catálogo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {cart.items.length} item(ns) · {formatMoney(cart.totalAmount)}
              {new Set(cart.items.map((i) => i.supplierId)).size > 1 && (
                <span>
                  {" "}
                  · Serão criados{" "}
                  {new Set(cart.items.map((i) => i.supplierId)).size} pedidos em
                  rascunho com requisições vinculadas (um por fornecedor)
                </span>
              )}
            </p>
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                placeholder="Descreva a solicitação"
                maxLength={100}
              />
            </div>
            <CostCenterSelect
              companyId={companyId}
              value={costCenter}
              onChange={setCostCenter}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de necessidade</Label>
                <Input
                  type="date"
                  value={neededBy}
                  onChange={(e) => setNeededBy(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select
                  value={priority}
                  onValueChange={(v) =>
                    setPriority(v as "normal" | "urgent" | "critical")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                    <SelectItem value="critical">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Informações adicionais (opcional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={() => void handleCheckout()} disabled={checkingOut}>
              {checkingOut ? "Processando..." : "Finalizar Pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
