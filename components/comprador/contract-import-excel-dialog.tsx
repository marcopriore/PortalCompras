"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ChevronRight, Download, Upload } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { ContractItemForm } from "@/types/contracts"

type Props = {
  open: boolean
  onClose: () => void
  companyId: string
  onImport: (items: ContractItemForm[]) => void
}

export function ContractImportExcelDialog({
  open,
  onClose,
  companyId,
  onImport,
}: Props) {
  const [importStep, setImportStep] = React.useState<1 | 2 | 3>(1)
  const [importFile, setImportFile] = React.useState<File | null>(null)
  const [importPreview, setImportPreview] = React.useState<ContractItemForm[]>([])
  const [importErrors, setImportErrors] = React.useState<string[]>([])
  const [importProcessing, setImportProcessing] = React.useState(false)
  const importFileRef = React.useRef<HTMLInputElement>(null)

  function closeImportDialog() {
    setImportStep(1)
    setImportFile(null)
    setImportPreview([])
    setImportErrors([])
    if (importFileRef.current) importFileRef.current.value = ""
    onClose()
  }

  async function handleDownloadTemplate() {
    const ExcelJS = (await import("exceljs")).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet("Itens do Contrato")
    ws.views = [{ showGridLines: false }]
    ws.columns = [{ width: 20 }, { width: 15 }, { width: 18 }, { width: 15 }]

    const headerRow = ws.addRow([
      "Código do Material",
      "Quantidade",
      "Preço Unitário",
      "Prazo (dias)",
    ])
    headerRow.height = 24
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F3EF5" },
      }
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
      cell.alignment = { vertical: "middle", horizontal: "center" }
    })

    const orientRow = ws.addRow(["MEC-001", "100", "12.50", "30"])
    orientRow.height = 20
    orientRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF9C4" },
      }
      cell.font = { italic: true, color: { argb: "FF757575" }, size: 10 }
      cell.alignment = { vertical: "middle", horizontal: "center" }
    })

    for (let i = 3; i <= 52; i++) ws.addRow(["", "", "", ""])
    ws.views = [{ state: "frozen", ySplit: 1, showGridLines: false }]

    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "template-itens-contrato.xlsx"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleProcessImport() {
    if (!importFile) return
    setImportProcessing(true)
    setImportErrors([])
    setImportPreview([])
    try {
      const supabase = createClient()
      const ExcelJS = (await import("exceljs")).default
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await importFile.arrayBuffer())
      const ws = wb.worksheets[0]
      if (!ws) {
        setImportErrors(["Erro ao processar o arquivo. Verifique se é um .xlsx válido."])
        setImportStep(3)
        return
      }
      type RawRow = { rowNumber: number; code: string; qtyRaw: string; priceRaw: string; daysRaw: string }
      const rawRows: RawRow[] = []
      ws.eachRow((row, rowNumber) => {
        if (rowNumber <= 2) return
        const code = String(row.getCell(1).value ?? "").trim()
        const qtyRaw = String(row.getCell(2).value ?? "").trim()
        const priceRaw = String(row.getCell(3).value ?? "").trim()
        const daysRaw = String(row.getCell(4).value ?? "").trim()
        if (!code && !qtyRaw && !priceRaw) return
        rawRows.push({ rowNumber, code, qtyRaw, priceRaw, daysRaw })
      })
      if (rawRows.length === 0) {
        setImportErrors(["Nenhum item encontrado no arquivo."])
        setImportStep(3)
        return
      }
      const codes = rawRows.map((r) => r.code).filter(Boolean)
      const { data: catalogItems } = await supabase
        .from("items")
        .select("code, short_description, unit_of_measure, status")
        .eq("company_id", companyId)
        .in("code", codes)
      const catalogMap = new Map((catalogItems ?? []).map((i) => [i.code, i]))
      const items: ContractItemForm[] = []
      const errors: string[] = []
      for (const row of rawRows) {
        const { rowNumber, code, qtyRaw, priceRaw, daysRaw } = row
        if (!code) {
          errors.push(`Linha ${rowNumber}: Código é obrigatório`)
          continue
        }
        const catalogItem = catalogMap.get(code)
        if (!catalogItem) {
          errors.push(`Linha ${rowNumber}: Código "${code}" não encontrado no catálogo`)
          continue
        }
        if (catalogItem.status !== "active") {
          errors.push(`Linha ${rowNumber}: Item "${code}" está inativo no catálogo`)
          continue
        }
        const qty = parseFloat(qtyRaw.replace(",", "."))
        if (!qtyRaw || Number.isNaN(qty) || qty <= 0) {
          errors.push(`Linha ${rowNumber}: Quantidade inválida para "${code}" (deve ser > 0)`)
          continue
        }
        const price = parseFloat(priceRaw.replace(",", "."))
        if (!priceRaw || Number.isNaN(price) || price < 0) {
          errors.push(`Linha ${rowNumber}: Preço inválido para "${code}"`)
          continue
        }
        items.push({
          material_code: catalogItem.code,
          material_description: catalogItem.short_description,
          unit_of_measure: catalogItem.unit_of_measure ?? "",
          quantity_contracted: qtyRaw,
          unit_price: priceRaw,
          notes: "",
          delivery_days: daysRaw,
          _fromQuotation: false,
        })
      }
      setImportPreview(items)
      setImportErrors(errors)
      setImportStep(3)
    } catch {
      setImportErrors(["Erro ao processar o arquivo. Verifique se é um .xlsx válido."])
      setImportStep(3)
    } finally {
      setImportProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeImportDialog()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Itens via Excel</DialogTitle>
          <DialogDescription>
            {importStep === 1 && "Baixe o template, preencha e avance para o upload."}
            {importStep === 2 && "Selecione o arquivo Excel preenchido."}
            {importStep === 3 && "Revise os dados antes de confirmar a importação."}
          </DialogDescription>
        </DialogHeader>
        {importStep === 1 && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
              <p className="font-medium">Orientações de preenchimento:</p>
              <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                <li><strong>Código</strong> — código do material cadastrado no sistema (obrigatório)</li>
                <li><strong>Quantidade</strong> — quantidade contratada, maior que zero (obrigatório)</li>
                <li><strong>Preço Unitário</strong> — valor unitário em reais (obrigatório)</li>
                <li><strong>Prazo (dias)</strong> — prazo de entrega em dias corridos (opcional)</li>
              </ul>
            </div>
            <Button variant="outline" onClick={() => void handleDownloadTemplate()} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Baixar Template Excel
            </Button>
          </div>
        )}
        {importStep === 2 && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30" onClick={() => importFileRef.current?.click()}>
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">{importFile ? importFile.name : "Clique para selecionar o arquivo"}</p>
            </div>
            <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
          </div>
        )}
        {importStep === 3 && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {importErrors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
            {importPreview.length > 0 && <p className="text-sm">{importPreview.length} item(s) válido(s) para importar</p>}
          </div>
        )}
        <DialogFooter className="gap-2">
          {importStep === 1 && <>
            <Button variant="outline" onClick={closeImportDialog}>Cancelar</Button>
            <Button onClick={() => setImportStep(2)}>Próximo <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </>}
          {importStep === 2 && <>
            <Button variant="outline" onClick={() => setImportStep(1)}>Voltar</Button>
            <Button onClick={() => void handleProcessImport()} disabled={!importFile || importProcessing}>{importProcessing ? "Processando..." : "Processar"}</Button>
          </>}
          {importStep === 3 && <>
            <Button variant="outline" onClick={() => setImportStep(2)}>Voltar</Button>
            <Button onClick={() => { onImport(importPreview); toast.success(`${importPreview.length} item(s) importado(s)`); closeImportDialog() }} disabled={importPreview.length === 0}>Confirmar Importação</Button>
          </>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
