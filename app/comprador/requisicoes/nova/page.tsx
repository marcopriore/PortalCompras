"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { logAudit } from "@/lib/audit"

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

import { Trash2, Plus, ChevronLeft } from "lucide-react"

type Priority = "normal" | "urgent" | "critical"

type PurchaseRequisitionItemForm = {
  id: string
  materialCode: string
  materialDescription: string
  quantity: number
  unitOfMeasure: string
  estimatedPrice: number | null
  commodityGroup: string
  observations: string
}

type RequisitionDraftForm = {
  title: string
  description: string
  costCenter: string
  neededBy: string
  priority: Priority
}

const createEmptyItem = (): PurchaseRequisitionItemForm => ({
  id: crypto.randomUUID(),
  materialCode: "",
  materialDescription: "",
  quantity: 1,
  unitOfMeasure: "",
  estimatedPrice: null,
  commodityGroup: "",
  observations: "",
})

export default function NovaRequisicaoPage() {
  const router = useRouter()
  const { companyId, userId } = useUser()
  const { hasPermission } = usePermissions()

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [form, setForm] = React.useState<RequisitionDraftForm>({
    title: "",
    description: "",
    costCenter: "",
    neededBy: "",
    priority: "normal",
  })

  const [items, setItems] = React.useState<PurchaseRequisitionItemForm[]>([
    createEmptyItem(),
  ])

  const canCreate = hasPermission("requisition.create")

  const updateItem = (itemId: string, patch: Partial<PurchaseRequisitionItemForm>) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)))
  }

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((i) => i.id !== itemId)
    })
  }

  const handleSubmit = async () => {
    setError(null)
    if (!companyId || !userId) return

    if (!form.title.trim()) {
      setError("Título é obrigatório.")
      return
    }

    const validItems = items.filter((it) => it.materialDescription.trim())
    if (validItems.length === 0) {
      setError("Informe ao menos um item com descrição.")
      return
    }

    const supabase = createClient()
    setLoading(true)
    try {
      const { data: profileRes } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single()

      const requesterName = (profileRes as any)?.full_name ?? ""

      const { data: requisitionRes, error: requisitionErr } = await supabase
        .from("requisitions")
        .insert({
          company_id: companyId,
          status: "pending",
          origin: "manual",
          requester_id: userId,
          requester_name: requesterName,
          title: form.title.trim(),
          description: form.description.trim() || null,
          cost_center: form.costCenter.trim() || null,
          needed_by: form.neededBy ? new Date(`${form.neededBy}T00:00:00`).toISOString() : null,
          priority: form.priority,
        })
        .select("id, code")
        .single()

      if (requisitionErr || !requisitionRes) {
        setError("Não foi possível criar a requisição.")
        return
      }

      const requisitionId = (requisitionRes as any).id as string

      if (validItems.length > 0) {
        const payloadItems = validItems.map((it) => ({
          requisition_id: requisitionId,
          company_id: companyId,
          material_code: it.materialCode.trim() || null,
          material_description: it.materialDescription.trim(),
          quantity: Number(it.quantity) || 1,
          unit_of_measure: it.unitOfMeasure.trim() || null,
          estimated_price: it.estimatedPrice,
          commodity_group: it.commodityGroup.trim() || null,
          observations: it.observations.trim() || null,
        }))

        await supabase.from("requisition_items").insert(payloadItems)
      }

      await logAudit({
        eventType: "quotation.created",
        description: `Requisição ${(requisitionRes as any).code} criada`,
        companyId,
        userId,
        entity: "requisitions",
        entityId: requisitionId,
      })

      router.push(`/comprador/requisicoes/${requisitionId}`)
    } finally {
      setLoading(false)
    }
  }

  if (!canCreate) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/comprador/requisicoes")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Nova Requisição</h1>
            <p className="text-muted-foreground">—</p>
          </div>
        </div>

        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Sem permissão para criar requisições.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/comprador/requisicoes")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Nova Requisição</h1>
          <p className="text-muted-foreground">Criação manual</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dados Gerais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Materiais para manutenção"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="costCenter">Centro de Custo</Label>
              <Input
                id="costCenter"
                value={form.costCenter}
                onChange={(e) => setForm((f) => ({ ...f, costCenter: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="neededBy">Data de Necessidade</Label>
              <Input
                id="neededBy"
                type="date"
                value={form.neededBy}
                onChange={(e) => setForm((f) => ({ ...f, neededBy: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="priority">Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}>
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

            <div className="flex flex-col gap-2">
              <Label>Origem</Label>
              <Input value="manual" readOnly />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Itens Solicitados</CardTitle>
          <Button
            type="button"
            variant="outline"
            onClick={() => setItems((prev) => [...prev, createEmptyItem()])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Item
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((it) => (
            <div key={it.id} className="rounded-xl border border-border p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Código do Material (opcional)</Label>
                  <Input
                    value={it.materialCode}
                    onChange={(e) => updateItem(it.id, { materialCode: e.target.value })}
                    placeholder="Ex: MAT-123"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Unidade de Medida</Label>
                  <Input
                    value={it.unitOfMeasure}
                    onChange={(e) => updateItem(it.id, { unitOfMeasure: e.target.value })}
                    placeholder="Ex: UN, KG, MT"
                  />
                </div>

                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label>Descrição (obrigatório)</Label>
                  <Textarea
                    rows={2}
                    value={it.materialDescription}
                    onChange={(e) => updateItem(it.id, { materialDescription: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    value={it.quantity}
                    min={0}
                    onChange={(e) => updateItem(it.id, { quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Preço Estimado (opcional)</Label>
                  <Input
                    type="number"
                    value={it.estimatedPrice ?? ""}
                    onChange={(e) =>
                      updateItem(it.id, {
                        estimatedPrice:
                          e.target.value.trim() === ""
                            ? null
                            : Number(e.target.value),
                      })
                    }
                    placeholder="0"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Grupo de Mercadoria (opcional)</Label>
                  <Input
                    value={it.commodityGroup}
                    onChange={(e) => updateItem(it.id, { commodityGroup: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Observações (opcional)</Label>
                  <Input
                    value={it.observations}
                    onChange={(e) => updateItem(it.id, { observations: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleRemoveItem(it.id)}
                  disabled={items.length <= 1}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/comprador/requisicoes")}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={loading}>
          {loading ? "Salvando..." : "Criar Requisição"}
        </Button>
      </div>
    </div>
  )
}

