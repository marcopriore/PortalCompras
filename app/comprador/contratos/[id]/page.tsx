"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format, parseISO, differenceInDays, startOfDay } from "date-fns"
import { ptBR } from "date-fns/locale"
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
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
  ArrowLeft,
  Edit,
  Save,
  X,
  Upload,
  FileText,
  Download,
  AlertTriangle,
} from "lucide-react"
import type { Contract } from "@/types/contracts"
import { CONTRACT_TYPES, CONTRACT_STATUSES } from "@/types/contracts"

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

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

function statusBadgeClass(status: Contract["status"]): string {
  switch (status) {
    case "draft":
      return "bg-muted text-muted-foreground"
    case "active":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    case "expired":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    case "cancelled":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
    default:
      return "bg-muted text-muted-foreground"
  }
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

function contractToForm(c: Contract): FormState {
  return {
    supplier_id: c.supplier_id,
    code: c.code,
    title: c.title,
    type: c.type,
    status: c.status,
    start_date: c.start_date.slice(0, 10),
    end_date: c.end_date.slice(0, 10),
    value:
      c.value != null
        ? new Intl.NumberFormat("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(c.value)
        : "",
    notes: c.notes ?? "",
  }
}

function parseValueToNumber(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const normalized = t.replace(/[^\d,]/g, "").replace(",", ".")
  const n = parseFloat(normalized)
  return Number.isNaN(n) ? null : n
}

function isExpiringSoon(c: Contract): boolean {
  if (c.status !== "active") return false
  const end = parseISO(c.end_date)
  const today = startOfDay(new Date())
  const days = differenceInDays(end, today)
  return days >= 0 && days <= 30
}

function daysUntilEnd(c: Contract): number {
  return differenceInDays(parseISO(c.end_date), startOfDay(new Date()))
}

export default function ContratoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = React.use(params)
  const router = useRouter()
  const { companyId, loading: userLoading, isSuperAdmin } = useUser()
  const { hasFeature, loading: permissionsLoading } = usePermissions()

  const [contract, setContract] = React.useState<Contract | null>(null)
  const [loadError, setLoadError] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState(false)
  const [form, setForm] = React.useState<FormState | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [suppliers, setSuppliers] = React.useState<
    Array<{ id: string; name: string; code: string }>
  >([])

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const canAccess = hasFeature("contracts") || isSuperAdmin

  React.useEffect(() => {
    if (userLoading || !companyId || !canAccess) {
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("suppliers")
          .select("id, name, code")
          .eq("company_id", companyId)
          .eq("status", "active")
          .order("name")
        if (!cancelled && !error) {
          setSuppliers(
            (data ?? []) as Array<{ id: string; name: string; code: string }>,
          )
        }
      } catch {
        /* ignore */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userLoading, companyId, canAccess])

  const loadContract = React.useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch(`/api/contracts/${id}`)
      const data = (await res.json()) as { contract?: Contract; error?: string }
      if (!res.ok || !data.contract) {
        setLoadError(true)
        setContract(null)
        setForm(null)
        return
      }
      const c = data.contract
      setContract(c)
      setForm(contractToForm(c))
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    if (userLoading || permissionsLoading || !canAccess) return
    void loadContract()
  }, [userLoading, permissionsLoading, canAccess, loadContract])

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`/api/contracts/${id}/upload`, {
        method: "POST",
        body: fd,
      })
      const data = (await res.json()) as { file_url?: string; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Falha no upload.")
        return
      }
      if (data.file_url) {
        setContract((c) => (c ? { ...c, file_url: data.file_url! } : null))
        toast.success("Arquivo enviado com sucesso.")
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleSaveEdit() {
    if (!form) return
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
    if (!start_date || !end_date) {
      toast.error("Informe as datas de vigência.")
      return
    }

    const valueNum = parseValueToNumber(value)
    if (value.trim() && valueNum === null) {
      toast.error("Valor inválido.")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
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
      const data = (await res.json()) as { contract?: Contract; error?: string }
      if (!res.ok || !data.contract) {
        toast.error(data.error ?? "Não foi possível salvar.")
        return
      }
      setContract(data.contract)
      setForm(contractToForm(data.contract))
      setEditing(false)
      toast.success("Contrato atualizado.")
    } finally {
      setSaving(false)
    }
  }

  function handleCancelEdit() {
    if (contract) setForm(contractToForm(contract))
    setEditing(false)
  }

  if (!userLoading && !permissionsLoading && !canAccess) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Contrato</CardTitle>
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

  if (loading && !contract) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <FileText className="h-5 w-5 animate-pulse" />
        <span className="text-sm">Carregando…</span>
      </div>
    )
  }

  if (loadError || !contract || !form) {
    return (
      <div className="p-6 space-y-4 max-w-lg">
        <Button type="button" variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Contrato não encontrado.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const expiring = isExpiringSoon(contract)
  const daysLeft = daysUntilEnd(contract)

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => void handleFileChange(e)}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            {!editing ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {contract.code}
                  </Badge>
                  <Badge className={statusBadgeClass(contract.status)}>
                    {STATUS_LABELS[contract.status]}
                  </Badge>
                </div>
                <h1 className="text-2xl font-semibold tracking-tight mt-1">
                  {contract.title}
                </h1>
              </>
            ) : (
              <h1 className="text-2xl font-semibold tracking-tight">Editar contrato</h1>
            )}
          </div>
        </div>
        {!editing ? (
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelEdit}
              disabled={saving}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSaveEdit()} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        )}
      </div>

      {expiring && (
        <div
          className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
          role="status"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p>
            Atenção: este contrato vence em{" "}
            <strong>{daysLeft}</strong>{" "}
            {daysLeft === 1 ? "dia" : "dias"}.
          </p>
        </div>
      )}

      {!editing ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Fornecedor</p>
                  <p className="text-sm font-medium">
                    {contract.supplier_name}{" "}
                    <span className="text-muted-foreground font-normal">
                      ({contract.supplier_code})
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <p className="text-sm font-medium">{TYPE_LABELS[contract.type]}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vigência</p>
                  <p className="text-sm font-medium">
                    {format(parseISO(contract.start_date), "dd/MM/yyyy", { locale: ptBR })}{" "}
                    –{" "}
                    {format(parseISO(contract.end_date), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="text-sm font-medium">
                    {contract.value != null ? money.format(contract.value) : "—"}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Observações</p>
                  <p className="text-sm whitespace-pre-wrap">
                    {contract.notes?.trim() ? contract.notes : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contract.file_url ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a
                      href={contract.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Visualizar PDF
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={openFilePicker}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? "Enviando…" : "Substituir"}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={openFilePicker}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Enviando…" : "Fazer Upload do PDF"}
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
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
                  onValueChange={(v) => setForm((f) => (f ? { ...f, supplier_id: v } : f))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Fornecedor" />
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
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, code: e.target.value } : f))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  Título <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, title: e.target.value } : f))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => (f ? { ...f, type: v } : f))}
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
                  onValueChange={(v) => setForm((f) => (f ? { ...f, status: v } : f))}
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
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, value: e.target.value } : f))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Data início</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, start_date: e.target.value } : f))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Data fim</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, end_date: e.target.value } : f))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                rows={4}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, notes: e.target.value } : f))
                }
              />
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium mb-2">Documento (PDF)</p>
              {contract.file_url ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a
                      href={contract.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Visualizar PDF
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={openFilePicker}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Substituir
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openFilePicker}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Enviar PDF
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
