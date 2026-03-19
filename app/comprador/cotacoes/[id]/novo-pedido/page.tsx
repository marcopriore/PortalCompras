"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, ChevronLeft, Send } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { logAudit } from "@/lib/audit"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Quotation = {
  id: string
  code: string
  description: string | null
  status: string
}

type ProposalItem = {
  id: string
  proposal_id: string
  quotation_item_id: string
  unit_price: number
  tax_percent: number | null
  item_status: "accepted" | "rejected"
  observations: string | null
}

type Proposal = {
  id: string
  quotation_id: string
  supplier_name: string
  supplier_cnpj: string | null
  payment_condition: string | null
  delivery_days: number | null
  status: "submitted" | "selected" | "rejected"
  observations: string | null
  proposal_items: ProposalItem[]
}

type QuotationItem = {
  id: string
  quotation_id: string
  material_code: string
  material_description: string
  quantity: number
  unit_of_measure: string | null
}

type PurchaseOrderItemForm = {
  quotationItemId: string
  materialCode: string
  materialDescription: string
  quantity: number
  unitOfMeasure: string | null
  unitPrice: number
  taxPercent: number | null
}

type PurchaseOrderForm = {
  supplierId?: string | null
  supplierName: string
  supplierCnpj: string | null
  paymentCondition: string | null
  deliveryDays: number | null
  deliveryAddress: string
  quotationCode: string
  requisitionCode: string
  observations: string
  items: PurchaseOrderItemForm[]
}

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

export default function NovoPedidoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { userId, companyId } = useUser()
  const { id } = React.use(params)

  const [quotation, setQuotation] = React.useState<Quotation | null>(null)
  const [proposal, setProposal] = React.useState<Proposal | null>(null)
  const [quotationItems, setQuotationItems] = React.useState<QuotationItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [erpError, setErpError] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<{
    deliveryAddress: string
    requisitionCode: string
    observations: string
  }>({
    deliveryAddress: "",
    requisitionCode: "",
    observations: "",
  })
  const [items, setItems] = React.useState<PurchaseOrderItemForm[]>([])

  React.useEffect(() => {
    if (!companyId || !id) return

    const supabase = createClient()
    let alive = true

    const run = async () => {
      setLoading(true)

      const [qRes, pRes, qiRes] = await Promise.all([
        supabase
          .from("quotations")
          .select("id, code, description, status")
          .eq("id", id)
          .single(),
        supabase
          .from("quotation_proposals")
          .select("*, proposal_items(*)")
          .eq("quotation_id", id)
          .eq("status", "selected")
          .maybeSingle(),
        supabase.from("quotation_items").select("*").eq("quotation_id", id),
      ])

      if (!alive) return

      setQuotation((qRes.data as Quotation) ?? null)
      const selectedProposal = (pRes.data as Proposal) ?? null
      setProposal(selectedProposal)
      setQuotationItems(((qiRes.data as unknown) as QuotationItem[]) ?? [])

      if (qRes.data && selectedProposal) {
        const q = qRes.data as Quotation
        const allItems = (qiRes.data as QuotationItem[]) ?? []
        const acceptedItems = selectedProposal.proposal_items.filter(
          (pi) => pi.item_status === "accepted",
        )
        const mappedItems: PurchaseOrderItemForm[] = acceptedItems
          .map((pi) => {
            const qi = allItems.find((i) => i.id === pi.quotation_item_id)
            if (!qi) return null
            return {
              quotationItemId: qi.id,
              materialCode: qi.material_code,
              materialDescription: qi.material_description,
              quantity: qi.quantity,
              unitOfMeasure: qi.unit_of_measure,
              unitPrice: pi.unit_price,
              taxPercent: pi.tax_percent,
            }
          })
          .filter(Boolean) as PurchaseOrderItemForm[]

        setItems(mappedItems)
        setForm((prev) => ({
          ...prev,
          deliveryAddress: prev.deliveryAddress,
          requisitionCode: prev.requisitionCode,
          observations: prev.observations,
        }))
      }

      setLoading(false)
    }

    run()
    return () => {
      alive = false
    }
  }, [companyId, id])

  const totalPrice = React.useMemo(
    () => items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
    [items],
  )

  const handleChangeForm =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
    }

  const handleSubmit = async () => {
    if (!quotation || !proposal || !companyId || !userId) return

    if (!form.deliveryAddress.trim()) {
      // simples validação local, pode ser trocada por toast
      window.alert("Endereço de entrega é obrigatório.")
      return
    }

    setSubmitting(true)
    setErpError(null)

    try {
      const supabase = createClient()

      const { data: poData, error: poError } = await supabase
        .from("purchase_orders")
        .insert({
          company_id: companyId,
          quotation_id: quotation.id,
          proposal_id: proposal.id,
          supplier_name: proposal.supplier_name,
          supplier_cnpj: proposal.supplier_cnpj,
          payment_condition: proposal.payment_condition,
          delivery_days: proposal.delivery_days,
          delivery_address: form.deliveryAddress,
          quotation_code: quotation.code,
          requisition_code: form.requisitionCode || null,
          total_price: totalPrice,
          observations: form.observations || null,
          created_by: userId,
          status: "processing",
        })
        .select("id, code")
        .single()

      if (poError || !poData) {
        setErpError("Erro ao criar pedido de compra.")
        setSubmitting(false)
        return
      }

      const purchaseOrderId = poData.id as string

      if (items.length > 0) {
        const itemsPayload = items.map((i) => ({
          purchase_order_id: purchaseOrderId,
          company_id: companyId,
          quotation_item_id: i.quotationItemId,
          material_code: i.materialCode,
          material_description: i.materialDescription,
          quantity: i.quantity,
          unit_of_measure: i.unitOfMeasure,
          unit_price: i.unitPrice,
          tax_percent: i.taxPercent,
        }))

        await supabase.from("purchase_order_items").insert(itemsPayload)
      }

      await logAudit({
        eventType: "quotation.updated",
        description: `Pedido ${poData.code ?? ""} criado para cotação ${quotation.code}`,
        companyId,
        userId,
        entity: "quotation",
        entityId: quotation.id,
      })

      await supabase
        .from("quotations")
        .update({ status: "completed" })
        .eq("id", quotation.id)

      setErpError(null)
      router.push("/comprador/pedidos")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/comprador/cotacoes/${id}/equalizacao`)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Novo Pedido de Compra</h1>
            <p className="text-muted-foreground">Carregando dados da cotação...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!proposal || !quotation) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/comprador/cotacoes/${id}/equalizacao`)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Novo Pedido de Compra</h1>
            <p className="text-muted-foreground">
              {quotation ? quotation.code : `Cotação ${id}`}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-destructive">
              Nenhuma proposta foi selecionada. Volte à equalização e selecione um fornecedor.
            </p>
          </div>
        </div>

        <div>
          <Button
            variant="outline"
            onClick={() => router.push(`/comprador/cotacoes/${id}/equalizacao`)}
          >
            Voltar
          </Button>
        </div>
      </div>
    )
  }

  const filledForm: PurchaseOrderForm = {
    supplierId: undefined,
    supplierName: proposal.supplier_name,
    supplierCnpj: proposal.supplier_cnpj,
    paymentCondition: proposal.payment_condition,
    deliveryDays: proposal.delivery_days,
    quotationCode: quotation.code,
    deliveryAddress: form.deliveryAddress,
    requisitionCode: form.requisitionCode,
    observations: form.observations,
    items,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/comprador/cotacoes/${id}/equalizacao`)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Novo Pedido de Compra</h1>
          <p className="text-muted-foreground">{filledForm.quotationCode}</p>
        </div>
      </div>

      {erpError && (
        <div className="bg-destructive/10 border border-destructive/40 rounded-xl p-4 flex gap-3 items-start">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Erro ao integrar com o ERP</p>
            <p className="text-sm text-destructive/90">{erpError}</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Dados do Fornecedor</CardTitle>
            <p className="text-sm text-muted-foreground">
              Informações oriundas da proposta selecionada
            </p>
          </div>
          <Badge variant="default" className="bg-success text-success-foreground">
            Proposta Selecionada
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Fornecedor</Label>
              <p className="mt-1 font-medium">{filledForm.supplierName}</p>
            </div>
            <div>
              <Label>CNPJ</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                {filledForm.supplierCnpj ?? "—"}
              </p>
            </div>
            <div>
              <Label>Condição de Pagamento</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                {filledForm.paymentCondition ?? "—"}
              </p>
            </div>
            <div>
              <Label>Prazo de Entrega</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                {filledForm.deliveryDays != null ? `${filledForm.deliveryDays} dias` : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Código da Cotação</Label>
              <Input value={filledForm.quotationCode} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requisitionCode">Código da Requisição</Label>
              <Input
                id="requisitionCode"
                placeholder="REQ-XXXX (opcional)"
                value={form.requisitionCode}
                onChange={handleChangeForm("requisitionCode")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="deliveryAddress">Endereço de Entrega</Label>
            <Textarea
              id="deliveryAddress"
              rows={3}
              value={form.deliveryAddress}
              onChange={handleChangeForm("deliveryAddress")}
            />
            <p className="text-xs text-muted-foreground">
              Campo obrigatório para criação do pedido.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="observations">Observações</Label>
            <Textarea
              id="observations"
              rows={3}
              value={form.observations}
              onChange={handleChangeForm("observations")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Itens do Pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição Curta</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-center">Unidade</TableHead>
                  <TableHead className="text-right">Preço Unit.</TableHead>
                  <TableHead className="text-right">Impostos</TableHead>
                  <TableHead className="text-right">Total Item</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const totalItem = item.quantity * item.unitPrice
                  return (
                    <TableRow key={item.quotationItemId}>
                      <TableCell className="font-mono text-sm">
                        {item.materialCode}
                      </TableCell>
                      <TableCell>{item.materialDescription}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-center">
                        {item.unitOfMeasure ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {money.format(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.taxPercent == null ? "—" : `${item.taxPercent}%`}
                      </TableCell>
                      <TableCell className="text-right">
                        {money.format(totalItem)}
                      </TableCell>
                    </TableRow>
                  )
                })}
                <TableRow>
                  <TableCell colSpan={6} className="text-right font-bold">
                    Total do Pedido
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {money.format(totalPrice)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/comprador/cotacoes/${id}/equalizacao`)}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
        >
          <Send className="mr-2 h-4 w-4" />
          {submitting ? "Confirmando..." : "Confirmar Pedido"}
        </Button>
      </div>
    </div>
  )
}

