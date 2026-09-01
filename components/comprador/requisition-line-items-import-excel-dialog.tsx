"use client"

import * as React from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertTriangle, Download, Upload } from "lucide-react"

export type RequisitionLineImportPayload = {
  lineId: string
  itemId: string
  materialCode: string
  materialDescription: string
  unitOfMeasure: string
  commodityGroup: string
  quantity: number
  observations: string
}

type CatalogItemRow = {
  id: string
  code: string
  short_description: string
  unit_of_measure: string | null
  commodity_group: string | null
  status: string
}

type Props = {
  open: boolean
  onClose: () => void
  companyId: string
  existingItemIds: string[]
  onImport: (lines: RequisitionLineImportPayload[]) => void
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
      .select("id, code, short_description, unit_of_measure, commodity_group, status")
      .eq("company_id", companyId)
      .in("code", chunk)

    for (const item of (data ?? []) as CatalogItemRow[]) {
      catalogMap.set(item.code, item)
    }
  }

  return catalogMap
}

export function RequisitionLineItemsImportExcelDialog({
  open,
  onClose,
  companyId,
  existingItemIds,
  onImport,
}: Props) {
  const [importStep, setImportStep] = React.useState<"upload" | "preview" | "done">("upload")
  const [importPreview, setImportPreview] = React.useState<RequisitionLineImportPayload[]>([])
  const [importErrors, setImportErrors] = React.useState<string[]>([])
  const [importing, setImporting] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) {
      setImportStep("upload")
      setImportPreview([])
      setImportErrors([])
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [open])

  async function handleDownloadTemplate() {
    const ExcelJS = (await import("exceljs")).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet("Itens da Requisição")
    ws.columns = [
      { header: "codigo_item", key: "codigo_item", width: 18 },
      { header: "quantidade", key: "quantidade", width: 12 },
      { header: "observacoes", key: "observacoes", width: 32 },
    ]

    const headerRow = ws.getRow(1)
    for (let col = 1; col <= 3; col++) {
      const cell = headerRow.getCell(col)
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F3EF5" } }
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
      cell.alignment = { horizontal: "center" }
    }

    ws.addRow({ codigo_item: "A01", quantidade: 10, observacoes: "Opcional" })

    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "template-itens-requisicao.xlsx"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleProcessFile(file: File) {
    setImporting(true)
    setImportErrors([])
    setImportPreview([])
    try {
      const ExcelJS = (await import("exceljs")).default
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())
      const ws = wb.worksheets[0]
      if (!ws) {
        setImportErrors(["Arquivo inválido. Use um .xlsx com a planilha de itens."])
        setImportStep("preview")
        return
      }

      const headerRow = ws.getRow(1)
      const colIndex: Record<string, number> = {}
      headerRow.eachCell((cell, col) => {
        const key = String(cell.value ?? "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_")
        if (key) colIndex[key] = col
      })

      const codeCol = colIndex.codigo_item ?? 1
      const qtyCol = colIndex.quantidade ?? 2
      const obsCol = colIndex.observacoes ?? 3

      const errors: string[] = []
      const parsed: Array<{
        rowNumber: number
        materialCode: string
        quantity: number
        observations: string
      }> = []

      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const materialCode = String(row.getCell(codeCol).value ?? "").trim()
        const qtyRaw = row.getCell(qtyCol).value
        const observations = String(row.getCell(obsCol).value ?? "").trim()

        if (!materialCode && !qtyRaw && !observations) return

        if (!materialCode) {
          errors.push(`Linha ${rowNumber}: codigo_item é obrigatório.`)
          return
        }

        const quantity = Number(qtyRaw)
        if (!Number.isFinite(quantity) || quantity < 1) {
          errors.push(`Linha ${rowNumber}: quantidade inválida para "${materialCode}".`)
          return
        }

        parsed.push({
          rowNumber,
          materialCode,
          quantity: Math.floor(quantity),
          observations: observations.slice(0, 300),
        })
      })

      if (parsed.length === 0) {
        errors.push("Nenhuma linha de item encontrada no arquivo.")
        setImportErrors(errors)
        setImportStep("preview")
        return
      }

      const catalogMap = await loadCatalogByCodes(
        companyId,
        [...new Set(parsed.map((row) => row.materialCode))],
      )

      const preview: RequisitionLineImportPayload[] = []
      const existingSet = new Set(existingItemIds)

      for (const row of parsed) {
        const catalogItem = catalogMap.get(row.materialCode)
        if (!catalogItem) {
          errors.push(
            `Linha ${row.rowNumber}: codigo_item "${row.materialCode}" não encontrado no catálogo.`,
          )
          continue
        }
        if (catalogItem.status !== "active") {
          errors.push(`Linha ${row.rowNumber}: item "${row.materialCode}" está inativo.`)
          continue
        }
        if (existingSet.has(catalogItem.id)) {
          errors.push(`Linha ${row.rowNumber}: item "${row.materialCode}" já está na requisição.`)
          continue
        }

        existingSet.add(catalogItem.id)
        preview.push({
          lineId: crypto.randomUUID(),
          itemId: catalogItem.id,
          materialCode: catalogItem.code,
          materialDescription: catalogItem.short_description,
          unitOfMeasure: catalogItem.unit_of_measure ?? "",
          commodityGroup: catalogItem.commodity_group ?? "",
          quantity: row.quantity,
          observations: row.observations,
        })
      }

      setImportPreview(preview)
      setImportErrors(errors)
      setImportStep("preview")
    } finally {
      setImporting(false)
    }
  }

  function handleConfirm() {
    if (importPreview.length === 0) return
    onImport(importPreview)
    toast.success(`${importPreview.length} item(ns) importado(s).`)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Itens da Requisição (Excel)</DialogTitle>
        </DialogHeader>

        {importStep === "upload" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Colunas: <strong>codigo_item</strong>, <strong>quantidade</strong>,{" "}
              <strong>observacoes</strong> (opcional). Itens devem existir no catálogo ativo.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void handleDownloadTemplate()}>
                <Download className="mr-2 h-4 w-4" />
                Baixar modelo
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                <Upload className="mr-2 h-4 w-4" />
                {importing ? "Processando..." : "Selecionar arquivo"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleProcessFile(file)
                }}
              />
            </div>
          </div>
        ) : null}

        {importStep === "preview" ? (
          <div className="space-y-4">
            {importErrors.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Avisos de validação
                </div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {importErrors.slice(0, 12).map((msg) => (
                    <li key={msg}>{msg}</li>
                  ))}
                </ul>
                {importErrors.length > 12 ? (
                  <p className="text-xs">… e mais {importErrors.length - 12} aviso(s).</p>
                ) : null}
              </div>
            ) : null}

            {importPreview.length > 0 ? (
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.slice(0, 10).map((row) => (
                      <TableRow key={row.lineId}>
                        <TableCell className="font-mono text-xs">{row.materialCode}</TableCell>
                        <TableCell className="text-sm">{row.materialDescription}</TableCell>
                        <TableCell className="text-center">{row.quantity}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.observations || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {importPreview.length > 10 ? (
                  <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
                    Prévia dos primeiros 10 de {importPreview.length} itens.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum item válido para importar. Corrija o arquivo e tente novamente.
              </p>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          {importStep === "preview" ? (
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={importPreview.length === 0}
            >
              Importar {importPreview.length > 0 ? `(${importPreview.length})` : ""}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
