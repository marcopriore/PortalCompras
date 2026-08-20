"use client"

import * as React from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { logAudit } from "@/lib/audit"
import { notifyWithEmail } from "@/lib/notify-with-email"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { AlertTriangle, Check, Download, Upload } from "lucide-react"

type Priority = "normal" | "urgent" | "critical"

type HeaderByGroup = {
  groupKey: string
  requisitionTitle: string
  neededByYmd: string
  priority: Priority
  costCenter: string | null
}

type ImportPreviewRow = {
  rowNumber: number
  groupKey: string

  requisitionTitle: string
  neededByYmd: string
  priority: Priority
  costCenter: string | null

  materialCode: string
  materialDescription: string
  quantity: number
  unitOfMeasure: string | null
  commodityGroup: string | null
  observations: string | null
}

type CatalogItemRow = {
  code: string
  short_description: string
  unit_of_measure: string | null
  commodity_group: string | null
  status: string
}

const CATALOG_BATCH_SIZE = 100

async function loadCatalogByCodes(
  companyId: string,
  codes: string[],
): Promise<Map<string, CatalogItemRow>> {
  const catalogMap = new Map<string, CatalogItemRow>()
  if (codes.length === 0) return catalogMap

  const supabase = createClient()
  for (let i = 0; i < codes.length; i += CATALOG_BATCH_SIZE) {
    const chunk = codes.slice(i, i + CATALOG_BATCH_SIZE)
    const { data } = await supabase
      .from("items")
      .select("code, short_description, unit_of_measure, commodity_group, status")
      .eq("company_id", companyId)
      .in("code", chunk)

    for (const item of (data ?? []) as CatalogItemRow[]) {
      catalogMap.set(item.code, item)
    }
  }

  return catalogMap
}

function validateRowsAgainstCatalog(
  rows: ImportPreviewRow[],
  catalogMap: Map<string, CatalogItemRow>,
  errors: string[],
): ImportPreviewRow[] {
  return rows.map((row) => {
    const catalogItem = catalogMap.get(row.materialCode)
    if (!catalogItem) {
      errors.push(
        `Linha ${row.rowNumber}: codigo_item "${row.materialCode}" não encontrado no catálogo.`,
      )
      return row
    }
    if (catalogItem.status !== "active") {
      errors.push(
        `Linha ${row.rowNumber}: item "${row.materialCode}" está inativo no catálogo.`,
      )
      return row
    }

    return {
      ...row,
      materialDescription:
        row.materialDescription.trim() || catalogItem.short_description,
      unitOfMeasure: row.unitOfMeasure?.trim() || catalogItem.unit_of_measure || null,
      commodityGroup: row.commodityGroup?.trim() || catalogItem.commodity_group || null,
    }
  })
}

function parsePriority(raw: unknown): Priority | null {
  const s = raw == null ? "" : String(raw).trim().toLowerCase()
  if (!s) return null

  const normalized: Record<string, Priority> = {
    normal: "normal",
    urgente: "urgent",
    urgent: "urgent",
    critical: "critical",
    critica: "critical",
    "crítica": "critical",
  }

  return normalized[s] ?? null
}

function toYmdFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function parseNeededByYmd(raw: unknown): string | null {
  if (raw == null) return null

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return toYmdFromDate(raw)
  }

  const s = String(raw).trim()
  if (!s) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

function normalizeText(raw: unknown): string {
  if (raw == null) return ""
  return String(raw).trim()
}

export function RequisicoesImportExcelDialog({
  canImportExcel,
  onImported,
}: {
  canImportExcel: boolean
  onImported: () => Promise<void> | void
}) {
  const { companyId, userId, fullName, loading: userLoading } = useUser()

  const [open, setOpen] = React.useState(false)
  const [importStep, setImportStep] = React.useState<"upload" | "preview" | "done">("upload")

  const [importPreview, setImportPreview] = React.useState<ImportPreviewRow[]>([])
  const [importErrors, setImportErrors] = React.useState<string[]>([])
  const [importing, setImporting] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setImportStep("upload")
      setImportPreview([])
      setImportErrors([])
      setImporting(false)
    }
  }, [open])

  async function handleDownloadTemplate() {
    const ExcelJS = (await import("exceljs")).default

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet("Requisicoes")

    const columns = [
      { header: "codigo_requisicao", key: "codigo_requisicao", width: 18 },
      { header: "titulo_requisicao", key: "titulo_requisicao", width: 35 },
      { header: "data_necessidade (YYYY-MM-DD)", key: "data_necessidade", width: 22 },
      { header: "prioridade (normal|urgent|critical)", key: "prioridade", width: 22 },
      { header: "centro_custo", key: "centro_custo", width: 18 },
      { header: "codigo_item", key: "codigo_item", width: 18 },
      { header: "descricao_item", key: "descricao_item", width: 40 },
      { header: "quantidade", key: "quantidade", width: 12 },
      { header: "unidade", key: "unidade", width: 12 },
      { header: "grupo_commodity", key: "grupo_commodity", width: 20 },
      { header: "observacoes", key: "observacoes", width: 28 },
    ]
    ws.columns = columns

    const headerRow = ws.getRow(1)
    const borderStyle = {
      top: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
      bottom: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
      left: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
      right: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
    }

    for (let col = 1; col <= columns.length; col++) {
      const cell = headerRow.getCell(col)
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F3EF5" } }
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
      cell.alignment = { horizontal: "center", vertical: "middle" }
      cell.border = borderStyle
    }

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      for (let col = 1; col <= columns.length; col++) row.getCell(col).border = borderStyle
    })

    ws.addRows([
      {
        codigo_requisicao: "REQ-BATCH-001",
        titulo_requisicao: "Requisição de Materiais",
        data_necessidade: "2026-08-20",
        prioridade: "normal",
        centro_custo: "CC-01",
        codigo_item: "MAT-001",
        descricao_item: "Parafuso M8x30",
        quantidade: 10,
        unidade: "UN",
        grupo_commodity: "Mecânica",
        observacoes: "",
      },
      {
        codigo_requisicao: "REQ-BATCH-001",
        titulo_requisicao: "Requisição de Materiais",
        data_necessidade: "2026-08-20",
        prioridade: "normal",
        centro_custo: "CC-01",
        codigo_item: "MAT-002",
        descricao_item: "Porca M8",
        quantidade: 30,
        unidade: "UN",
        grupo_commodity: "Mecânica",
        observacoes: "",
      },
      {
        codigo_requisicao: "REQ-BATCH-002",
        titulo_requisicao: "Manutenção Preventiva",
        data_necessidade: "2026-08-22",
        prioridade: "urgent",
        centro_custo: "CC-02",
        codigo_item: "MAT-010",
        descricao_item: "Óleo hidráulico",
        quantidade: 5,
        unidade: "LT",
        grupo_commodity: "Lubrificantes",
        observacoes: "Entrega em 48h (se possível).",
      },
    ])

    ws.views = [{ showGridLines: false }]

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "template_requisicoes_valore.xlsx"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleFileChange(file: File) {
    if (!companyId) {
      toast.error("Empresa não identificada.")
      return
    }

    setImportErrors([])
    setImportPreview([])

    const ExcelJS = (await import("exceljs")).default
    const wb = new ExcelJS.Workbook()
    const buffer = await file.arrayBuffer()
    await wb.xlsx.load(buffer)

    const ws = wb.worksheets[0]
    if (!ws) {
      setImportErrors(["Planilha não encontrada no arquivo."])
      return
    }

    const rows: ImportPreviewRow[] = []
    const errors: string[] = []
    const headerByGroup = new Map<string, HeaderByGroup>()

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return

      const values = row.values as unknown[]

      const groupKeyRaw = normalizeText(values[1])
      const groupKey = groupKeyRaw || `__row_${rowNumber}`

      const requisitionTitleRaw = normalizeText(values[2])
      const neededByYmd = parseNeededByYmd(values[3])
      const priority = parsePriority(values[4])
      const costCenterRaw = normalizeText(values[5])

      const materialCode = normalizeText(values[6])
      const materialDescription = normalizeText(values[7])
      const quantity = Number(values[8])

      const unitOfMeasure = normalizeText(values[9]) || null
      const commodityGroup = normalizeText(values[10]) || null
      const observations = normalizeText(values[11]) || null

      const isEmptyRow =
        !groupKeyRaw &&
        !requisitionTitleRaw &&
        !neededByYmd &&
        !values[4] &&
        !costCenterRaw &&
        !materialCode &&
        !materialDescription &&
        !values[8] &&
        !unitOfMeasure &&
        !commodityGroup &&
        !observations

      if (isEmptyRow) return

      const headerTitleFallback = groupKeyRaw
        ? requisitionTitleRaw || `Requisição ${groupKey}`
        : requisitionTitleRaw || `Requisição Linha ${rowNumber}`

      const costCenter = costCenterRaw || null

      if (!neededByYmd) errors.push(`Linha ${rowNumber}: data_necessidade deve ser YYYY-MM-DD.`)
      if (!priority) errors.push(`Linha ${rowNumber}: prioridade deve ser normal|urgent|critical.`)
      if (!materialCode) errors.push(`Linha ${rowNumber}: codigo_item obrigatório.`)
      if (!Number.isFinite(quantity) || quantity <= 0)
        errors.push(`Linha ${rowNumber}: quantidade deve ser > 0.`)

      const desiredHeader: HeaderByGroup = {
        groupKey,
        requisitionTitle: headerTitleFallback,
        neededByYmd: neededByYmd ?? "",
        priority: priority ?? "normal",
        costCenter,
      }

      const headerExisting = headerByGroup.get(groupKey)
      if (!headerExisting) {
        headerByGroup.set(groupKey, desiredHeader)
      } else {
        const mismatch =
          headerExisting.neededByYmd !== desiredHeader.neededByYmd ||
          headerExisting.priority !== desiredHeader.priority ||
          (headerExisting.costCenter ?? null) !== (desiredHeader.costCenter ?? null)

        if (mismatch) {
          errors.push(
            `Linha ${rowNumber}: campos do cabeçalho precisam ser iguais para o codigo_requisicao="${groupKey}".`,
          )
        }
      }

      rows.push({
        rowNumber,
        groupKey,
        requisitionTitle: headerTitleFallback,
        neededByYmd: neededByYmd ?? "",
        priority: priority ?? "normal",
        costCenter,
        materialCode,
        materialDescription,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        unitOfMeasure,
        commodityGroup,
        observations,
      })
    })

    const uniqueCodes = [...new Set(rows.map((r) => r.materialCode).filter(Boolean))]
    const catalogMap = await loadCatalogByCodes(companyId, uniqueCodes)
    const validatedRows = validateRowsAgainstCatalog(rows, catalogMap, errors)

    setImportPreview(validatedRows)
    setImportErrors(errors)
    setImportStep("preview")
  }

  async function handleImport() {
    if (!companyId || !userId) return
    if (importPreview.length === 0) return
    if (importErrors.length > 0) {
      toast.error("Corrija os erros antes de importar.")
      return
    }

    setImporting(true)

    const supabase = createClient()

    const groups = new Map<string, ImportPreviewRow[]>()
    for (const line of importPreview) {
      if (!groups.has(line.groupKey)) groups.set(line.groupKey, [])
      groups.get(line.groupKey)?.push(line)
    }

    let successGroups = 0
    let errorGroups = 0
    const errorDetails: string[] = []

    try {
      for (const [groupKey, lines] of groups.entries()) {
        try {
          const header = lines[0]
          const payloadItems = lines.map((l) => ({
            requisition_id: "TEMP",
            company_id: companyId,
            material_code: l.materialCode.trim() || null,
            material_description: l.materialDescription.trim(),
            quantity: Math.max(1, Number(l.quantity) || 1),
            unit_of_measure: l.unitOfMeasure?.trim() || null,
            commodity_group: l.commodityGroup?.trim() || null,
            observations: l.observations?.trim() || null,
          }))

          const { data: profileRes } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", userId)
            .single()

          const requesterName =
            (profileRes as { full_name?: string } | null)?.full_name ?? fullName ?? ""

          const { data: requisitionRes, error: requisitionErr } = await supabase
            .from("requisitions")
            .insert({
              company_id: companyId,
              status: "pending",
              origin: "manual",
              requester_id: userId,
              requester_name: requesterName,
              title: header.requisitionTitle.trim(),
              description: null,
              cost_center: header.costCenter?.trim() || null,
              needed_by: header.neededByYmd
                ? new Date(`${header.neededByYmd}T00:00:00`).toISOString()
                : null,
              priority: header.priority,
            })
            .select("id, code")
            .single()

          if (requisitionErr || !requisitionRes) {
            errorGroups++
            errorDetails.push(`${groupKey}: erro ao criar requisição.`)
            continue
          }

          const requisitionId = (requisitionRes as { id: string }).id
          const requisitionCode = (requisitionRes as { code: string }).code
          const itemsPayload = payloadItems.map((p) => ({
            ...p,
            requisition_id: requisitionId,
          }))

          const { error: itemsErr } = await supabase
            .from("requisition_items")
            .insert(itemsPayload)

          if (itemsErr) {
            errorGroups++
            errorDetails.push(`${groupKey}: erro ao inserir itens.`)
            continue
          }

          void logAudit({
            eventType: "requisition.created",
            description: `Requisição ${String((requisitionRes as any).code ?? groupKey)} criada via importação Excel.`,
            companyId,
            userId,
            userName: requesterName || null,
            entity: "requisitions",
            entityId: requisitionId,
            metadata: {
              code: (requisitionRes as any).code ?? null,
              priority: header.priority,
              cost_center: header.costCenter ?? null,
            },
          })

          const { data: tfRow } = await supabase
            .from("tenant_features")
            .select("enabled")
            .eq("company_id", companyId)
            .eq("feature_key", "approval_requisition")
            .maybeSingle()

          const approvalEnabled = (tfRow as { enabled?: boolean } | null)?.enabled ?? false

          if (!approvalEnabled) {
            await supabase
              .from("requisitions")
              .update({
                status: "approved",
                approved_at: new Date().toISOString(),
                approver_name: "Aprovação automática (fluxo desabilitado)",
              })
              .eq("id", requisitionId)

            void notifyWithEmail({
              userId,
              companyId,
              type: "requisition.approved",
              title: "Requisição aprovada automaticamente",
              body: `Sua requisição ${requisitionCode} foi aprovada e está disponível para cotação.`,
              entity: "requisition",
              entityId: requisitionId,
              subject: `Requisição Aprovada — ${requisitionCode}`,
              html: `<p>Sua requisição <strong>${requisitionCode}</strong> foi aprovada automaticamente.</p>
         <p>Ela já está disponível para abertura de cotação.</p>`,
              emailPrefKey: "order_approved_email",
            })

            successGroups++
            continue
          }

          const costCenterForRpc = (header.costCenter ?? "").trim() || ""
          const { data: approverData } = await supabase.rpc(
            "get_approver_for_requisition",
            {
              p_company_id: companyId,
              p_cost_center: costCenterForRpc,
            },
          )

          const firstRow = Array.isArray(approverData) ? approverData[0] : approverData
          const approverId =
            (firstRow as { approver_id?: string | null } | null)?.approver_id ?? null
          const approverName =
            (firstRow as { approver_name?: string | null } | null)?.approver_name ?? null

          if (!approverId) {
            await supabase
              .from("requisitions")
              .update({
                status: "approved",
                approved_at: new Date().toISOString(),
                approver_name: "Aprovação automática (sem regra configurada para este CC)",
              })
              .eq("id", requisitionId)

            void notifyWithEmail({
              userId,
              companyId,
              type: "requisition.approved",
              title: "Requisição aprovada automaticamente",
              body: `Sua requisição ${requisitionCode} foi aprovada e está disponível para cotação.`,
              entity: "requisition",
              entityId: requisitionId,
              subject: `Requisição Aprovada — ${requisitionCode}`,
              html: `<p>Sua requisição <strong>${requisitionCode}</strong> foi aprovada automaticamente.</p>
         <p>Ela já está disponível para abertura de cotação.</p>`,
              emailPrefKey: "order_approved_email",
            })

            successGroups++
            continue
          }

          await supabase
            .from("requisitions")
            .update({
              approver_id: approverId,
              approver_name: approverName,
              status: "pending",
            })
            .eq("id", requisitionId)

          await supabase.from("approval_requests").insert({
            company_id: companyId,
            flow: "requisition",
            entity_id: requisitionId,
            approver_id: approverId,
            approver_name: approverName,
            status: "pending",
          })

          const { data: approvers } = await supabase
            .from("profiles")
            .select("id, full_name")
            .eq("company_id", companyId)
            .eq("status", "active")
            .contains("roles", ["approver_requisition"])

          for (const approver of approvers ?? []) {
            void notifyWithEmail({
              userId: approver.id,
              companyId,
              type: "requisition.created",
              title: "Nova requisição aguardando aprovação",
              body: `A requisição ${requisitionCode} foi criada por ${requesterName} e aguarda sua aprovação.`,
              entity: "requisition",
              entityId: requisitionId,
              subject: `Nova Requisição — ${requisitionCode}`,
              html: `<p>Olá, <strong>${approver.full_name ?? "Aprovador"}</strong>!</p>
           <p>A requisição <strong>${requisitionCode}</strong> foi criada por <strong>${requesterName}</strong> e aguarda sua aprovação.</p>`,
              emailPrefKey: "new_requisition_email",
            })
          }

          successGroups++
        } catch (err) {
          errorGroups++
          errorDetails.push(`${groupKey}: ${(err as Error).message ?? "erro desconhecido"}`)
        }
      }
    } finally {
      setImporting(false)
    }

    const { error: logErr } = await supabase.from("item_import_logs").insert({
      company_id: companyId,
      imported_by: userId,
      source: "excel",
      total_rows: groups.size,
      success: successGroups,
      errors: errorGroups,
      error_details: errorDetails,
    })

    if (logErr) {
      // eslint-disable-next-line no-console
      console.error("item_import_logs:", logErr)
    }

    if (errorGroups > 0) {
      toast.success(
        `Importação concluída: ${successGroups} requisição(ões) OK, ${errorGroups} com erro.`,
      )
    } else {
      toast.success(`Importação concluída: ${successGroups} requisição(ões) criada(s).`)
    }

    setImportStep("done")
    await onImported()
  }

  if (!canImportExcel) return null

  if (userLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Upload className="mr-2 h-4 w-4" />
        Importar Excel
      </Button>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setImportStep("upload")
          setImportPreview([])
          setImportErrors([])
          setImporting(false)
        }
      }}
    >
      <Button variant="outline" size="sm" type="button" onClick={() => setOpen(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Importar Excel
      </Button>

      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar Requisições via Excel</DialogTitle>
        </DialogHeader>

        {importStep === "upload" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => void handleDownloadTemplate()}
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar Template
              </Button>
              <Separator />
              <span className="text-xs text-muted-foreground">
                Use data no formato <code>YYYY-MM-DD</code>. O{" "}
                <code>codigo_item</code> deve existir e estar ativo no catálogo.
              </span>
            </div>

            <div
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file) void handleFileChange(file)
              }}
            >
              <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Arraste o arquivo Excel ou clique para selecionar
              </p>
              <label className="mt-2 cursor-pointer text-sm font-medium text-primary underline">
                clique para selecionar
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleFileChange(file)
                  }}
                />
              </label>
            </div>
          </div>
        )}

        {importStep === "preview" && (
          <div className="space-y-4">
            {importErrors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-red-700">
                      {importErrors.length} erro(s) encontrado(s)
                    </p>
                    <ul className="text-xs text-red-600 space-y-0.5">
                      {importErrors.slice(0, 6).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {importErrors.length > 6 && (
                        <li>...e mais {importErrors.length - 6} erro(s)</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              {importPreview.length} linha(s) encontradas no arquivo.
              {importErrors.length > 0 ? " Corrija os erros antes de importar." : null}
            </p>

            <div className="max-h-64 overflow-auto rounded border">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow>
                    <TableHead>Cód. Requisição</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Cód. Item</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importPreview.slice(0, 10).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.groupKey}</TableCell>
                      <TableCell className="max-w-60 truncate">{row.requisitionTitle}</TableCell>
                      <TableCell>{row.materialCode}</TableCell>
                      <TableCell className="max-w-48 truncate">{row.materialDescription}</TableCell>
                      <TableCell>{row.quantity}</TableCell>
                      <TableCell>{row.priority}</TableCell>
                      <TableCell>{row.neededByYmd}</TableCell>
                    </TableRow>
                  ))}
                  {importPreview.length > 10 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground text-xs">
                        ...e mais {importPreview.length - 10} linha(s)
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                disabled={importing}
                onClick={() => setImportStep("upload")}
              >
                Voltar
              </Button>
              <Button
                type="button"
                disabled={importing || importErrors.length > 0}
                onClick={() => void handleImport()}
              >
                {importing ? "Importando..." : `Importar ${importPreview.length} linha(s)`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {importStep === "done" && (
          <div className="space-y-4 py-4 text-center">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Check className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <p className="text-sm font-medium">Importação concluída!</p>
            <DialogFooter className="justify-center">
              <Button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setImportStep("upload")
                  setImportPreview([])
                  setImportErrors([])
                  setImporting(false)
                }}
              >
                Fechar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

