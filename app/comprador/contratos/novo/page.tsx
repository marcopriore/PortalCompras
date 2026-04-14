"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { ArrowLeft, FileText, Save } from "lucide-react"
import type { Contract } from "@/types/contracts"
import { CONTRACT_TYPES, CONTRACT_STATUSES } from "@/types/contracts"

const TYPE_LABELS: Record<Contract["type"], string> = {
  fornecimento: "Fornecimento",
  servico: "Serviço",
  sla: "SLA",
  nda: "NDA",
  outro: "Outro",
}

const STATUS_LABELS: Record<Contract["status"], string> = {
  draft: "Rascunho",
  active: "Ativo",
  expired: "Expirado",
  cancelled: "Cancelado",
}

type FormState = {
  supplier_id: string
  code: string
  title: string
  type: string
  status: string
  start_date: string
  end_date: string
  value: string
  notes: string
}

const emptyForm = (): FormState => ({
  supplier_id: "",
  code: "",
  title: "",
  type: "fornecimento",
  status: "draft",
  start_date: "",
  end_date: "",
  value: "",
  notes: "",
})

function parseValueToNumber(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const normalized = t.replace(/[^\d,]/g, "").replace(",", ".")
  const n = parseFloat(normalized)
  return Number.isNaN(n) ? null : n
}

export default function NovoContratoPage() {
  const router = useRouter()
  const { companyId, loading: userLoading, isSuperAdmin } = useUser()
  const { hasFeature, loading: permissionsLoading } = usePermissions()

  const [form, setForm] = React.useState<FormState>(emptyForm)
  const [suppliers, setSuppliers] = React.useState<
    Array<{ id: string; name: string; code: string }>
  >([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const canAccess = hasFeature("contracts") || isSuperAdmin

  React.useEffect(() => {
    if (userLoading || !companyId || !canAccess) {
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("suppliers")
          .select("id, name, code")
          .eq("company_id", companyId)
          .eq("status", "active")
          .order("name")
        if (error || cancelled) return
        setSuppliers(
          (data ?? []) as Array<{ id: string; name: string; code: string }>,
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userLoading, companyId, canAccess])

  async function handleSubmit() {
    const {
      supplier_id,
      code,
      title,
      type,
      status,
      start_date,
      end_date,
      value,
      notes,
    } = form

    if (!supplier_id) {
      toast.error("Selecione o fornecedor.")
      return
    }
    if (!code.trim()) {
      toast.error("Informe o código do contrato.")
      return
    }
    if (!title.trim()) {
      toast.error("Informe o título do contrato.")
      return
    }
    if (!type) {
      toast.error("Selecione o tipo.")
      return
    }
    if (!start_date) {
      toast.error("Informe a data de início.")
      return
    }
    if (!end_date) {
      toast.error("Informe a data de fim.")
      return
    }

    const valueNum = parseValueToNumber(value)
    if (value.trim() && valueNum === null) {
      toast.error("Valor inválido.")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id,
          code: code.trim(),
          title: title.trim(),
          type,
          status,
          start_date,
          end_date,
          value: valueNum,
          notes: notes.trim() || null,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível salvar o contrato.")
        return
      }
      toast.success("Contrato criado!")
      router.push("/comprador/contratos")
    } finally {
      setSaving(false)
    }
  }

  if (!userLoading && !permissionsLoading && !canAccess) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Novo contrato</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              O módulo de contratos não está habilitado para a sua empresa.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Novo Contrato</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do contrato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Fornecedor <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.supplier_id}
                onValueChange={(v) => setForm((f) => ({ ...f, supplier_id: v }))}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Código <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="CTR-2026-001"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Nome do contrato"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Tipo <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input
                type="text"
                placeholder="R$ 0,00"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Data início <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>
                Data fim <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, end_date: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              rows={4}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notas internas sobre o contrato…"
            />
          </div>

          <div className="flex flex-wrap gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando…" : "Salvar Contrato"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
