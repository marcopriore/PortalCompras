"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { ChevronLeft, Loader2, Package, Search } from "lucide-react"

type RequisitionItem = {
  id: string
  material_code: string | null
  material_description: string
  quantity: number
  unit_of_measure: string | null
}

type Requisition = {
  id: string
  code: string
  title: string
  status: string
}

type Supplier = {
  id: string
  name: string
  cnpj: string | null
  code: string
}

type PaymentCondition = {
  id: string
  code: string
  description: string
}

type LineForm = {
  id: string
  material_code: string | null
  material_description: string
  quantity: number
  unit_of_measure: string | null
  unit_price: string
  delivery_days: string
}

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debouncedValue
}

function NovoPedidoContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requisitionId = searchParams.get("requisitionId")

  const { companyId, userId, loading: userLoading } = useUser()
  const { hasPermission, loading: permissionsLoading } = usePermissions()

  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [requisition, setRequisition] = React.useState<Requisition | null>(null)
  const [lines, setLines] = React.useState<LineForm[]>([])
  const [paymentConditions, setPaymentConditions] = React.useState<PaymentCondition[]>([])

  const [supplierSearch, setSupplierSearch] = React.useState("")
  const [supplierResults, setSupplierResults] = React.useState<Supplier[]>([])
  const [supplierSearchLoading, setSupplierSearchLoading] = React.useState(false)
  const [selectedSupplier, setSelectedSupplier] = React.useState<Supplier | null>(null)

  const [paymentConditionId, setPaymentConditionId] = React.useState("")
  const [deliveryAddress, setDeliveryAddress] = React.useState("")
  const [headerDeliveryDays, setHeaderDeliveryDays] = React.useState("")
  const [observations, setObservations] = React.useState("")

  const debouncedSupplierSearch = useDebounce(supplierSearch, 300)

  const canCreate = hasPermission("order.create")

  React.useEffect(() => {
    if (!companyId || !requisitionId) {
      setLoading(false)
      return
    }

    let alive = true
    const run = async () => {
      setLoading(true)
      const supabase = createClient()
      const [reqRes, itemsRes, pcRes] = await Promise.all([
        supabase
          .from("requisitions")
          .select("id, code, title, status")
          .eq("id", requisitionId)
          .eq("company_id", companyId)
          .single(),
        supabase
          .from("requisition_items")
          .select("id, material_code, material_description, quantity, unit_of_measure")
          .eq("requisition_id", requisitionId)
          .order("created_at"),
        supabase
          .from("payment_conditions")
          .select("id, code, description")
          .eq("company_id", companyId)
          .eq("active", true)
          .order("code"),
      ])

      if (!alive) return

      if (reqRes.error || !reqRes.data) {
        setRequisition(null)
        setLines([])
        setLoading(false)
        return
      }

      const req = reqRes.data as Requisition
      if (!["approved", "in_quotation"].includes(req.status)) {
        toast.error("A requisição precisa estar aprovada para gerar pedido.")
        router.replace(`/comprador/requisicoes/${requisitionId}`)
        return
      }

      setRequisition(req)
      setPaymentConditions((pcRes.data as PaymentCondition[]) ?? [])
      setLines(
        ((itemsRes.data as RequisitionItem[]) ?? []).map((item) => ({
          id: item.id,
          material_code: item.material_code,
          material_description: item.material_description,
          quantity: item.quantity,
          unit_of_measure: item.unit_of_measure,
          unit_price: "",
          delivery_days: "",
        })),
      )
      setLoading(false)
    }

    void run()
    return () => {
      alive = false
    }
  }, [companyId, requisitionId, router])

  React.useEffect(() => {
    if (!companyId || debouncedSupplierSearch.trim().length < 2) {
      setSupplierResults([])
      return
    }

    let alive = true
    const run = async () => {
      setSupplierSearchLoading(true)
      const supabase = createClient()
      const term = `%${debouncedSupplierSearch.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`
      const { data } = await supabase
        .from("suppliers")
        .select("id, name, cnpj, code")
        .eq("company_id", companyId)
        .eq("status", "active")
        .or(`name.ilike.${term},code.ilike.${term},cnpj.ilike.${term}`)
        .limit(20)

      if (!alive) return
      setSupplierResults((data as Supplier[]) ?? [])
      setSupplierSearchLoading(false)
    }

    void run()
    return () => {
      alive = false
    }
  }, [companyId, debouncedSupplierSearch])

  const totalPrice = React.useMemo(() => {
    return lines.reduce((sum, line) => {
      const price = parseFloat(line.unit_price.replace(",", "."))
      if (!Number.isFinite(price) || price <= 0) return sum
      return sum + price * line.quantity
    }, 0)
  }, [lines])

  const updateLine = (lineId: string, patch: Partial<LineForm>) => {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)))
  }

  const handleSubmit = async () => {
    if (!companyId || !userId || !requisition) return

    if (!selectedSupplier) {
      toast.error("Selecione um fornecedor.")
      return
    }

    if (!paymentConditionId) {
      toast.error("Selecione a condição de pagamento.")
      return
    }

    if (!deliveryAddress.trim()) {
      toast.error("Informe o endereço de entrega.")
      return
    }

    const paymentCond = paymentConditions.find((p) => p.id === paymentConditionId)
    if (!paymentCond) {
      toast.error("Condição de pagamento inválida.")
      return
    }

    const parsedLines = lines.map((line) => {
      const unitPrice = parseFloat(line.unit_price.replace(",", "."))
      const deliveryDaysRaw = line.delivery_days.trim()
      const deliveryDays = deliveryDaysRaw
        ? parseInt(deliveryDaysRaw, 10)
        : null
      return { ...line, unitPrice, deliveryDays }
    })

    for (const line of parsedLines) {
      if (!Number.isFinite(line.unitPrice) || line.unitPrice <= 0) {
        toast.error(`Informe preço unitário válido para ${line.material_code ?? line.material_description}.`)
        return
      }
      if (line.deliveryDays != null && (!Number.isFinite(line.deliveryDays) || line.deliveryDays < 0)) {
        toast.error(`Prazo de entrega inválido para ${line.material_code ?? line.material_description}.`)
        return
      }
    }

    const headerDaysRaw = headerDeliveryDays.trim()
    const headerDays = headerDaysRaw ? parseInt(headerDaysRaw, 10) : null
    if (headerDaysRaw && (!Number.isFinite(headerDays) || headerDays! < 0)) {
      toast.error("Prazo de entrega do cabeçalho inválido.")
      return
    }

    const maxLineDelivery = parsedLines.reduce((max, line) => {
      if (line.deliveryDays != null && line.deliveryDays > max) return line.deliveryDays
      return max
    }, 0)

    const poDeliveryDays =
      maxLineDelivery > 0
        ? maxLineDelivery
        : headerDays != null && headerDays > 0
          ? headerDays
          : null

    const paymentLabel = [paymentCond.code, paymentCond.description]
      .filter(Boolean)
      .join(" — ")

    setSubmitting(true)
    const supabase = createClient()

    try {
      const { data: poData, error: poError } = await supabase
        .from("purchase_orders")
        .insert({
          company_id: companyId,
          quotation_id: null,
          supplier_id: selectedSupplier.id,
          supplier_name: selectedSupplier.name,
          supplier_cnpj: selectedSupplier.cnpj,
          payment_condition: paymentLabel,
          delivery_days: poDeliveryDays,
          delivery_address: deliveryAddress.trim(),
          quotation_code: null,
          requisition_code: requisition.code,
          total_price: Math.round(totalPrice * 100) / 100,
          observations: observations.trim() || null,
          created_by: userId,
          status: "draft",
        })
        .select("id, code")
        .single()

      if (poError || !poData) {
        toast.error(poError?.message ?? "Não foi possível criar o pedido.")
        return
      }

      const poItemsPayload = parsedLines.map((line) => ({
        purchase_order_id: poData.id,
        company_id: companyId,
        material_code: line.material_code ?? "",
        material_description: line.material_description,
        quantity: line.quantity,
        unit_of_measure: line.unit_of_measure,
        unit_price: line.unitPrice,
        tax_percent: null,
        delivery_days: line.deliveryDays,
      }))

      const { error: itemsError } = await supabase
        .from("purchase_order_items")
        .insert(poItemsPayload)

      if (itemsError) {
        await supabase.from("purchase_orders").delete().eq("id", poData.id)
        toast.error(itemsError.message ?? "Não foi possível salvar os itens do pedido.")
        return
      }

      const { error: reqUpdateError } = await supabase
        .from("requisitions")
        .update({ status: "completed" })
        .eq("id", requisition.id)
        .eq("company_id", companyId)

      if (reqUpdateError) {
        toast.error("Pedido criado, mas não foi possível atualizar o status da requisição.")
      } else {
        toast.success(`Pedido ${poData.code as string} criado com sucesso.`)
      }

      router.push(`/comprador/pedidos/${poData.id}`)
    } catch {
      toast.error("Erro ao criar pedido.")
    } finally {
      setSubmitting(false)
    }
  }

  if (userLoading || permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Carregando...
      </div>
    )
  }

  if (!canCreate) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Você não tem permissão para criar pedidos.
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!requisitionId || !requisition) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/comprador/requisicoes")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Requisição não encontrada ou inválida.
          </CardContent>
        </Card>
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/comprador/requisicoes/${requisitionId}`)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            A requisição não possui itens para gerar pedido.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/comprador/requisicoes/${requisitionId}`)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Novo Pedido
          </h1>
          <p className="text-muted-foreground text-sm">
            Requisição {requisition.code} — {requisition.title}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Pedido</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 space-y-2">
            <Label>Fornecedor *</Label>
            {selectedSupplier ? (
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{selectedSupplier.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedSupplier.code}
                    {selectedSupplier.cnpj ? ` · ${selectedSupplier.cnpj}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSupplier(null)}
                >
                  Alterar
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar fornecedor por nome, código ou CNPJ..."
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                  />
                </div>
                {supplierSearch.trim().length >= 2 && (
                  <div className="rounded-lg border border-border max-h-48 overflow-y-auto">
                    {supplierSearchLoading ? (
                      <p className="p-3 text-sm text-muted-foreground">Buscando...</p>
                    ) : supplierResults.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">Nenhum fornecedor encontrado.</p>
                    ) : (
                      supplierResults.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b border-border last:border-b-0"
                          onClick={() => {
                            setSelectedSupplier(s)
                            setSupplierSearch("")
                            setSupplierResults([])
                          }}
                        >
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.code}
                            {s.cnpj ? ` · ${s.cnpj}` : ""}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Condição de Pagamento *</Label>
            <Select value={paymentConditionId} onValueChange={setPaymentConditionId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {paymentConditions.map((pc) => (
                  <SelectItem key={pc.id} value={pc.id}>
                    {pc.code} — {pc.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Prazo de Entrega (dias)</Label>
            <Input
              type="number"
              min={0}
              placeholder="Ex: 15"
              value={headerDeliveryDays}
              onChange={(e) => setHeaderDeliveryDays(e.target.value)}
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Endereço de Entrega *</Label>
            <Input
              placeholder="Informe o endereço completo de entrega"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações opcionais para o pedido"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Itens</CardTitle>
          <p className="text-sm font-semibold text-foreground">
            Total: {money.format(totalPrice)}
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right w-32">Preço Unit. *</TableHead>
                  <TableHead className="text-right w-28">Prazo (dias)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-mono">{line.material_code ?? "—"}</TableCell>
                    <TableCell>{line.material_description}</TableCell>
                    <TableCell className="text-right">{line.quantity}</TableCell>
                    <TableCell>{line.unit_of_measure ?? "—"}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="text-right"
                        value={line.unit_price}
                        onChange={(e) => updateLine(line.id, { unit_price: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        className="text-right"
                        placeholder="—"
                        value={line.delivery_days}
                        onChange={(e) => updateLine(line.id, { delivery_days: e.target.value })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/comprador/requisicoes/${requisitionId}`)}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Criando...
            </>
          ) : (
            "Criar Pedido"
          )}
        </Button>
      </div>
    </div>
  )
}

export default function NovoPedidoPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          Carregando...
        </div>
      }
    >
      <NovoPedidoContent />
    </React.Suspense>
  )
}
