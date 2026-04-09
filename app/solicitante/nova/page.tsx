"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft, Plus, Trash2 } from "lucide-react"

type ItemForm = {
  material_code: string
  material_description: string
  quantity: string
  unit_of_measure: string
  commodity_group: string
  observations: string
}

const emptyItem = (): ItemForm => ({
  material_code: "",
  material_description: "",
  quantity: "",
  unit_of_measure: "",
  commodity_group: "",
  observations: "",
})

export default function SolicitanteNovaPage() {
  const router = useRouter()
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [title, setTitle] = React.useState("")
  const [costCenter, setCostCenter] = React.useState("")
  const [neededBy, setNeededBy] = React.useState("")
  const [priority, setPriority] = React.useState("normal")
  const [description, setDescription] = React.useState("")
  const [itens, setItens] = React.useState<ItemForm[]>([emptyItem()])

  function addItem() {
    setItens((prev) => [...prev, emptyItem()])
  }

  function removeItem(index: number) {
    setItens((prev) => prev.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: keyof ItemForm, value: string) {
    setItens((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    )
  }

  async function handleSubmit() {
    setError(null)

    if (!title.trim()) {
      setError("Título é obrigatório.")
      return
    }
    if (itens.length === 0 || itens.every((i) => !i.material_description.trim())) {
      setError("Adicione ao menos um item com descrição.")
      return
    }

    setSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = "/solicitante/login"
      return
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, full_name")
      .eq("id", user.id)
      .single()

    if (!profile) {
      setError("Perfil não encontrado.")
      setSaving(false)
      return
    }

    // Gerar código sequencial
    const { count } = await supabase
      .from("requisitions")
      .select("*", { count: "exact", head: true })
      .eq("company_id", profile.company_id)

    const code = `REQ-${String((count ?? 0) + 1).padStart(4, "0")}`

    const { data: reqData, error: reqError } = await supabase
      .from("requisitions")
      .insert({
        company_id: profile.company_id,
        code,
        title: title.trim(),
        cost_center: costCenter.trim() || null,
        needed_by: neededBy || null,
        priority,
        description: description.trim() || null,
        status: "pending",
        origin: "manual",
        requester_id: user.id,
        requester_name: profile.full_name,
      })
      .select("id")
      .single()

    if (reqError || !reqData) {
      setError("Erro ao criar requisição. Tente novamente.")
      setSaving(false)
      return
    }

    // Inserir itens
    const validItems = itens.filter((i) => i.material_description.trim())
    if (validItems.length > 0) {
      await supabase.from("requisition_items").insert(
        validItems.map((item) => ({
          requisition_id: reqData.id,
          material_code: item.material_code.trim() || null,
          material_description: item.material_description.trim(),
          quantity: parseFloat(item.quantity) || 1,
          unit_of_measure: item.unit_of_measure.trim() || null,
          commodity_group: item.commodity_group.trim() || null,
          observations: item.observations.trim() || null,
        })),
      )
    }

    router.push(`/solicitante/${reqData.id}`)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/solicitante")}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div>
            <p className="text-sm font-semibold">Nova Requisição</p>
            <p className="text-xs text-muted-foreground">
              Preencha os dados da solicitação
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Dados gerais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                placeholder="Descreva brevemente a solicitação"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Centro de Custo</Label>
                <Input
                  placeholder="Ex: CC-001"
                  value={costCenter}
                  onChange={(e) => setCostCenter(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Necessidade</Label>
                <Input
                  type="date"
                  value={neededBy}
                  onChange={(e) => setNeededBy(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgente</option>
                <option value="critical">Crítico</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Observações gerais</Label>
              <Textarea
                placeholder="Informações adicionais sobre a solicitação..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Itens */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Itens</CardTitle>
            <Button variant="outline" size="sm" type="button" onClick={addItem}>
              <Plus className="w-4 h-4 mr-1" />
              Adicionar Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {itens.map((item, index) => (
              <div key={index} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    Item {index + 1}
                  </p>
                  {itens.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      onClick={() => removeItem(index)}
                      className="h-7 w-7 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Código do Material</Label>
                    <Input
                      placeholder="Ex: MAT-001"
                      value={item.material_code}
                      onChange={(e) => updateItem(index, "material_code", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Descrição *</Label>
                    <Input
                      placeholder="Descrição do item"
                      value={item.material_description}
                      onChange={(e) =>
                        updateItem(index, "material_description", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Quantidade</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unidade</Label>
                    <Input
                      placeholder="UN, KG, M..."
                      value={item.unit_of_measure}
                      onChange={(e) => updateItem(index, "unit_of_measure", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Grupo de Mercadoria</Label>
                    <Input
                      placeholder="Ex: Mecânica"
                      value={item.commodity_group}
                      onChange={(e) => updateItem(index, "commodity_group", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Observações</Label>
                    <Input
                      placeholder="Observações do item"
                      value={item.observations}
                      onChange={(e) => updateItem(index, "observations", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push("/solicitante")}
          >
            Cancelar
          </Button>
          <Button className="flex-1" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "Enviando..." : "Enviar Requisição"}
          </Button>
        </div>
      </main>
    </div>
  )
}
