"use client"

import * as React from "react"
import ExcelJS from "exceljs"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  Upload,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type QuotationItem = {
  id: string
  material_code: string
  material_description: string
  unit_of_measure: string | null
  quantity: number | string
}

export type ItemFormRow = {
  quotation_item_id: string
  proposal_item_id: string | null
  previous_unit_price: number
  delivery_days: number | null
  unit_price: number
  tax_percent: number
  item_status: "accepted" | "rejected" | "not_answered"
  observations: string
}

export interface ImportProposalWizardProps {
  open: boolean
  onClose: () => void
  quotation: { id: string; code: string; company_id: string }
  activeRound: { id: string; round_number: number }
  quotationItems: QuotationItem[]
  currentItemRows: ItemFormRow[]
  paymentOptions: { code: string; description: string }[]
  /** Condição de pagamento atual (código) para pré-preencher o modelo */
  currentPaymentCondition: string
  onImportComplete: (rows: ItemFormRow[], paymentConditionFromSheet: string) => void
}

const LAVANDA = "FFF4F3FF"
const INDIGO = "FF4F3EF5"
const GRAY666 = "FF666666"
const YELLOW_EDIT = "FFFFF9C4"
const GRAY_LOCKED = "FFF5F5F5"
const RED_ROW = "FFFFEBEE"
const WHITE = "FFFFFFFF"

function toNum(v: number | string | null | undefined): number {
  if (v == null || v === "") return 0
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function getCellScalar(cell: ExcelJS.Cell): string | number | null {
  const v = cell.value
  if (v == null || v === "") return null
  if (typeof v === "number") return v
  if (typeof v === "string") return v
  if (typeof v === "object" && v !== null && "result" in v) {
    const r = (v as { result?: unknown }).result
    if (typeof r === "number") return r
    if (typeof r === "string") return r
  }
  if (typeof v === "object" && v !== null && "richText" in v) {
    const parts = (v as { richText: { text: string }[] }).richText
    return parts.map((p) => p.text).join("")
  }
  if (typeof v === "object" && v !== null && "text" in v) {
    return String((v as { text: string }).text)
  }
  return String(v)
}

function parseNumber(val: string | number | null): number | null {
  if (val == null) return null
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : null
  }
  const s = String(val).trim().replace(",", ".")
  if (s === "") return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function parseIntStrict(val: string | number | null): number | null {
  const n = parseNumber(val)
  if (n == null) return null
  const i = Math.round(n)
  if (Math.abs(n - i) > 1e-9) return null
  return i
}

const INSTRUCTIONS_LIST = [
  "Clique em 'Baixar Modelo' para obter a planilha desta cotação",
  "Preencha os campos destacados em amarelo (Preço Unit., Imposto %, Prazo Dias, Observações, Status)",
  "Não altere os códigos de material, descrições ou estrutura das colunas",
  "Salve o arquivo e avance para a próxima etapa",
  "A condição de pagamento deve ser preenchida na aba 'Proposta'",
] as const

export function ImportProposalWizard({
  open,
  onClose,
  quotation,
  activeRound,
  quotationItems,
  currentItemRows,
  paymentOptions,
  currentPaymentCondition,
  onImportComplete,
}: ImportProposalWizardProps) {
  const [step, setStep] = React.useState(1)
  const [templateDownloaded, setTemplateDownloaded] = React.useState(false)
  const [downloading, setDownloading] = React.useState(false)

  const [fileName, setFileName] = React.useState<string | null>(null)
  const [parseErrors, setParseErrors] = React.useState<string[]>([])
  const [parseWarnings, setParseWarnings] = React.useState<string[]>([])
  const [parsedOk, setParsedOk] = React.useState(false)
  const [parsedPayment, setParsedPayment] = React.useState("")
  const [parsedByCode, setParsedByCode] = React.useState<
    Map<
      string,
      {
        unit_price: number
        tax_percent: number
        delivery_days: number | null
        observations: string
        item_status: "accepted" | "rejected"
      }
    >
  >(() => new Map())

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) return
    setStep(1)
    setTemplateDownloaded(false)
    setFileName(null)
    setParseErrors([])
    setParseWarnings([])
    setParsedOk(false)
    setParsedPayment("")
    setParsedByCode(new Map())
    setDownloading(false)
  }, [open])

  const rowByItemId = React.useMemo(
    () => new Map(currentItemRows.map((r) => [r.quotation_item_id, r])),
    [currentItemRows],
  )

  const handleDownloadTemplate = async () => {
    setDownloading(true)
    try {
      const workbook = new ExcelJS.Workbook()
      const ws = workbook.addWorksheet("Proposta", {
        views: [{ showGridLines: false }],
      })

      ws.mergeCells("A1:J1")
      const r1 = ws.getRow(1)
      r1.height = 28
      const c1 = ws.getCell("A1")
      c1.value = "Valore — Portal do Fornecedor"
      c1.font = { bold: true, size: 14, color: { argb: INDIGO } }
      c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LAVANDA } }
      c1.alignment = { vertical: "middle", horizontal: "center" }

      ws.mergeCells("A2:J2")
      const r2 = ws.getRow(2)
      r2.height = 18
      const c2 = ws.getCell("A2")
      c2.value = `Cotação: ${quotation.code} | Rodada: ${activeRound.round_number}`
      c2.font = { size: 10, color: { argb: GRAY666 } }
      c2.alignment = { vertical: "middle", horizontal: "center" }

      ws.getRow(3).height = 8

      ws.getCell("A4").value = ""
      const labelPay = ws.getCell("B4")
      labelPay.value = "Condição de Pagamento:"
      labelPay.font = { bold: true }
      labelPay.alignment = { horizontal: "right", vertical: "middle" }
      labelPay.protection = { locked: true }

      ws.mergeCells("C4:E4")
      const payCell = ws.getCell("C4")
      payCell.value = currentPaymentCondition.trim() || ""
      payCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW_EDIT } }
      payCell.protection = { locked: false }
      if (paymentOptions.length > 0) {
        const list = paymentOptions.map((o) => o.code).join(",")
        payCell.dataValidation = {
          type: "list",
          allowBlank: false,
          formulae: [`"${list}"`],
        }
      }

      ws.getRow(5).height = 8

      const headerRow = ws.getRow(6)
      headerRow.height = 22
      const headers = [
        "#",
        "Cód. Material",
        "Descrição",
        "UN",
        "Qtd",
        "Preço Unit.",
        "Imposto %",
        "Prazo (dias)",
        "Observações",
        "Status",
      ]
      headers.forEach((text, i) => {
        const col = i + 1
        const cell = headerRow.getCell(col)
        cell.value = text
        cell.font = { bold: true, color: { argb: WHITE } }
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INDIGO } }
        cell.alignment = {
          horizontal: col === 3 || col === 9 ? "left" : "center",
          vertical: "middle",
          wrapText: true,
        }
        cell.protection = { locked: true }
      })

      quotationItems.forEach((qi, idx) => {
        const rowNum = 7 + idx
        const cur = rowByItemId.get(qi.id)
        const row = ws.getRow(rowNum)
        row.height = 18
        const rejected = cur?.item_status === "rejected"
        const rowFill = rejected
          ? { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: RED_ROW } }
          : undefined

        const seq = row.getCell(1)
        seq.value = idx + 1
        seq.alignment = { horizontal: "center", vertical: "middle" }
        seq.protection = { locked: true }
        if (rowFill) seq.fill = rowFill

        const setLocked = (col: number, value: string | number, align: "left" | "center" | "right") => {
          const cell = row.getCell(col)
          cell.value = value
          cell.alignment = { horizontal: align, vertical: "middle" }
          cell.protection = { locked: true }
          cell.fill =
            rowFill ??
            ({ type: "pattern", pattern: "solid", fgColor: { argb: GRAY_LOCKED } } as ExcelJS.Fill)
        }

        setLocked(2, qi.material_code, "left")
        setLocked(3, qi.material_description, "left")
        setLocked(4, qi.unit_of_measure ?? "", "center")
        setLocked(5, toNum(qi.quantity), "right")

        const up = cur ? cur.unit_price : 0
        const tax = cur ? cur.tax_percent : 0
        const dd = cur?.delivery_days ?? null
        const obs = cur?.observations ?? ""

        const f = row.getCell(6)
        f.value = up > 0 ? up : ""
        f.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW_EDIT } }
        f.protection = { locked: false }
        f.alignment = { horizontal: "right", vertical: "middle" }
        if (rowFill) f.fill = rowFill

        const g = row.getCell(7)
        g.value = tax > 0 ? tax : ""
        g.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW_EDIT } }
        g.protection = { locked: false }
        g.alignment = { horizontal: "center", vertical: "middle" }
        if (rowFill) g.fill = rowFill

        const h = row.getCell(8)
        h.value = dd != null && dd > 0 ? dd : ""
        h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW_EDIT } }
        h.protection = { locked: false }
        h.alignment = { horizontal: "center", vertical: "middle" }
        if (rowFill) h.fill = rowFill

        const ic = row.getCell(9)
        ic.value = obs
        ic.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW_EDIT } }
        ic.protection = { locked: false }
        ic.alignment = { horizontal: "left", vertical: "middle", wrapText: true }
        if (rowFill) ic.fill = rowFill

        const statusUi = cur?.item_status
        const statusLabel =
          statusUi === "rejected" ? "Recusado" : "Aceito"
        const st = row.getCell(10)
        st.value = statusLabel
        st.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW_EDIT } }
        st.protection = { locked: false }
        st.alignment = { horizontal: "center", vertical: "middle" }
        if (rowFill) st.fill = rowFill
        st.dataValidation = {
          type: "list",
          allowBlank: false,
          formulae: ['"Aceito,Recusado"'],
        }
      })

      ws.getColumn(1).width = 5
      ws.getColumn(2).width = 22
      ws.getColumn(3).width = 38
      ws.getColumn(4).width = 7
      ws.getColumn(5).width = 7
      ws.getColumn(6).width = 10
      ws.getColumn(7).width = 10
      ws.getColumn(8).width = 10
      ws.getColumn(9).width = 30
      ws.getColumn(10).width = 12

      await ws.protect("", {
        selectLockedCells: true,
        selectUnlockedCells: true,
      })

      const wsInst = workbook.addWorksheet("Instruções", {
        views: [{ showGridLines: false }],
      })
      wsInst.getColumn(1).width = 80
      let r = 1
      wsInst.getCell(`A${r}`).value = "Como preencher esta planilha"
      wsInst.getCell(`A${r}`).font = { bold: true, size: 14 }
      r += 2
      INSTRUCTIONS_LIST.forEach((line, i) => {
        wsInst.getCell(`A${r}`).value = `${i + 1}. ${line}`
        r += 1
      })
      r += 1
      wsInst.getCell(`A${r}`).value = "Condições de pagamento disponíveis (código | descrição)"
      wsInst.getCell(`A${r}`).font = { bold: true }
      r += 1
      if (paymentOptions.length === 0) {
        wsInst.getCell(`A${r}`).value = "— (livre conforme combinado com o comprador)"
        r += 1
      } else {
        paymentOptions.forEach((o) => {
          wsInst.getCell(`A${r}`).value = `${o.code} | ${o.description}`
          r += 1
        })
      }
      r += 1
      wsInst.getCell(`A${r}`).value =
        "Não altere células cinzas — são somente leitura."
      r += 1
      wsInst.getCell(`A${r}`).value = "Salve como .xlsx antes de importar."

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `proposta_${quotation.code}_rodada${activeRound.round_number}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setTemplateDownloaded(true)
    } catch (e) {
      console.error(e)
    } finally {
      setDownloading(false)
    }
  }

  const runValidations = (
    byCode: Map<
      string,
      {
        unit_price: number
        tax_percent: number
        delivery_days: number | null
        observations: string
        item_status: "accepted" | "rejected"
      }
    >,
    paymentRaw: string,
    invalidDeliveryCodes: Set<string>,
    invalidStatusCodes: Set<string>,
  ): { lines: string[]; warnings: string[] } => {
    const lines: string[] = []
    const warnings: string[] = []

    lines.push("✅ Arquivo possui aba 'Proposta'")

    const expectedCodes = new Set(quotationItems.map((q) => q.material_code.trim()))
    const sheetCodes = [...byCode.keys()].map((c) => c.trim())
    const uniqueSheet = new Set(sheetCodes)

    let codesOk = true
    if (sheetCodes.length !== uniqueSheet.size) {
      lines.push("❌ Há códigos de material duplicados na planilha")
      codesOk = false
    }
    for (const c of sheetCodes) {
      if (!expectedCodes.has(c)) {
        lines.push(`❌ Código de material não pertence à cotação: ${c}`)
        codesOk = false
      }
    }
    for (const qi of quotationItems) {
      if (!byCode.has(qi.material_code.trim())) {
        lines.push(`❌ Falta linha para o material: ${qi.material_code}`)
        codesOk = false
      }
    }
    if (sheetCodes.length !== quotationItems.length) {
      lines.push("❌ Quantidade de itens não confere com a cotação")
      codesOk = false
    }
    if (codesOk) {
      lines.push("✅ Todos os códigos de material correspondem à cotação")
      lines.push("✅ Quantidade de itens confere")
    }

    let pricesOk = true
    let taxOk = true
    for (const [, row] of byCode) {
      if (row.unit_price < 0 || Number.isNaN(row.unit_price)) pricesOk = false
      if (row.tax_percent < 0 || row.tax_percent > 100 || Number.isNaN(row.tax_percent)) taxOk = false
    }
    lines.push(
      pricesOk
        ? "✅ Preços unitários são numéricos e não negativos"
        : "❌ Preços unitários devem ser numéricos e não negativos",
    )
    lines.push(
      taxOk ? "✅ Imposto % entre 0 e 100" : "❌ Imposto % deve estar entre 0 e 100",
    )

    const daysOk = invalidDeliveryCodes.size === 0
    lines.push(
      daysOk
        ? "✅ Prazo em dias é inteiro positivo (quando preenchido)"
        : "❌ Prazo em dias deve ser inteiro positivo quando preenchido",
    )

    const statusOk = invalidStatusCodes.size === 0
    lines.push(
      statusOk
        ? "✅ Status dos itens válido (Aceito ou Recusado)"
        : "❌ Status dos itens inválido — use apenas Aceito ou Recusado (ou deixe vazio)",
    )

    const payTrim = paymentRaw.trim()
    if (paymentOptions.length > 0) {
      if (!payTrim) {
        warnings.push(
          "Condição de pagamento vazia na planilha — preencha na tela antes de enviar, se necessário",
        )
        lines.push("⚠️ Condição de pagamento: vazia (não bloqueia a importação)")
      } else if (!paymentOptions.some((o) => o.code === payTrim)) {
        lines.push("❌ Condição de pagamento inválida para as opções do comprador")
      } else {
        lines.push("✅ Condição de pagamento válida")
      }
    } else {
      lines.push("✅ Condição de pagamento (sem lista restrita no cadastro)")
      if (!payTrim) {
        warnings.push("Condição de pagamento vazia na planilha")
      }
    }

    return { lines, warnings }
  }

  const handleFileUpload = async (file: File | null) => {
    if (!file) return
    setFileName(file.name)
    setParseErrors([])
    setParseWarnings([])
    setParsedOk(false)
    setParsedByCode(new Map())
    setParsedPayment("")

    try {
      const buffer = await file.arrayBuffer()
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer)
      const ws = wb.getWorksheet("Proposta")
      if (!ws) {
        setParseErrors(["❌ Aba 'Proposta' não encontrada"])
        return
      }

      const payScalar = getCellScalar(ws.getCell("C4"))
      const paymentRaw = payScalar != null ? String(payScalar).trim() : ""

      const byCode = new Map<
        string,
        {
          unit_price: number
          tax_percent: number
          delivery_days: number | null
          observations: string
          item_status: "accepted" | "rejected"
        }
      >()
      const invalidDeliveryCodes = new Set<string>()
      const invalidStatusCodes = new Set<string>()

      ws.eachRow((row, rowNumber) => {
        if (rowNumber < 7) return
        const rawB = String(row.getCell(2).value ?? "")
        if (/^\s/.test(rawB)) return
        const materialCode = rawB.trim()
        if (!materialCode || materialCode.toLowerCase().includes("total")) return

        const f = parseNumber(getCellScalar(row.getCell(6))) ?? 0
        const g = parseNumber(getCellScalar(row.getCell(7))) ?? 0
        const hRaw = getCellScalar(row.getCell(8))
        const hStr = hRaw != null && String(hRaw).trim() !== "" ? String(hRaw).trim() : ""
        let delivery_days: number | null = null
        if (hStr !== "") {
          const parsed = parseIntStrict(hRaw)
          if (parsed == null || parsed <= 0) {
            invalidDeliveryCodes.add(materialCode)
          } else {
            delivery_days = parsed
          }
        }
        const obsScalar = getCellScalar(row.getCell(9))
        const observations = obsScalar != null ? String(obsScalar).trim() : ""

        const statusScalar = getCellScalar(row.getCell(10))
        const statusRaw =
          statusScalar != null ? String(statusScalar).trim().toLowerCase() : ""
        const normalizedStatus = statusRaw.normalize("NFD").replace(/\p{M}/gu, "")
        let item_status: "accepted" | "rejected" = "accepted"
        if (
          normalizedStatus !== "" &&
          normalizedStatus !== "aceito" &&
          normalizedStatus !== "recusado"
        ) {
          invalidStatusCodes.add(materialCode)
        }
        if (normalizedStatus === "recusado") {
          item_status = "rejected"
        }

        byCode.set(materialCode, {
          unit_price: f,
          tax_percent: g,
          delivery_days,
          observations,
          item_status,
        })
      })

      const { lines, warnings } = runValidations(
        byCode,
        paymentRaw,
        invalidDeliveryCodes,
        invalidStatusCodes,
      )
      const blocking = lines.filter((e) => e.startsWith("❌"))
      setParseWarnings(warnings)
      setParseErrors(lines)
      setParsedOk(blocking.length === 0)
      setParsedPayment(paymentRaw)
      setParsedByCode(byCode)
    } catch (e) {
      console.error(e)
      setParseErrors(["❌ Não foi possível ler o arquivo. Verifique se é um .xlsx válido."])
      setParsedOk(false)
    }
  }

  const buildImportedRows = React.useCallback((): ItemFormRow[] => {
    return quotationItems.map((qi) => {
      const cur = rowByItemId.get(qi.id)
      if (!cur) {
        throw new Error("Item inconsistente")
      }
      const sheet = parsedByCode.get(qi.material_code.trim())
      if (!sheet) return cur
      const nextStatus =
        sheet.item_status === "rejected" ? "rejected" : "accepted"
      return {
        ...cur,
        unit_price: sheet.unit_price,
        tax_percent: sheet.tax_percent,
        delivery_days: sheet.delivery_days,
        observations: sheet.observations,
        item_status: nextStatus,
      }
    })
  }, [quotationItems, rowByItemId, parsedByCode])

  const handleFinalize = () => {
    const rows = buildImportedRows()
    onImportComplete(rows, parsedPayment.trim())
    onClose()
  }

  const summaryRows = React.useMemo(() => {
    if (!parsedOk) return []
    try {
      return buildImportedRows()
    } catch {
      return []
    }
  }, [parsedOk, buildImportedRows])

  const canAdvanceStep1 = templateDownloaded
  const canAdvanceStep2 = parsedOk
  const hasBlockingErrors = parseErrors.some((e) => e.startsWith("❌"))

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        showCloseButton
      >
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle>Importar Proposta via Planilha</DialogTitle>
              <p className="text-sm text-muted-foreground">Etapa 1 de 3</p>
            </DialogHeader>

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Instruções</p>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
                {INSTRUCTIONS_LIST.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </div>

            <Badge variant="secondary" className="w-fit text-xs font-normal">
              Os valores já preenchidos na tela serão incluídos como ponto de partida
            </Badge>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleDownloadTemplate}
                disabled={downloading}
              >
                <Download className="w-4 h-4 mr-2" />
                {downloading ? "Gerando…" : "Baixar Modelo"}
              </Button>
              <Button
                type="button"
                onClick={() => setStep(2)}
                disabled={!canAdvanceStep1}
              >
                Avançar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle>Etapa 2 de 3 — Carregar Planilha</DialogTitle>
            </DialogHeader>

            <div
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const f = e.dataTransfer.files?.[0] ?? null
                if (f) void handleFileUpload(f)
              }}
            >
              <div
                role="button"
                tabIndex={0}
                className={cn(
                  "border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer",
                  "hover:bg-muted/30 transition-colors",
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }
                }}
              >
                <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground pointer-events-none">
                  <Upload className="w-10 h-10 text-muted-foreground" />
                  <p>Clique para selecionar ou arraste o arquivo aqui</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  void handleFileUpload(f)
                  e.target.value = ""
                }}
              />
            </div>

            {fileName ? (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{fileName}</span>
              </div>
            ) : null}

            {parseErrors.length > 0 && (
              <div
                className={cn(
                  "rounded-lg border p-3 text-sm space-y-1",
                  hasBlockingErrors
                    ? "border-destructive/50 bg-destructive/5 text-destructive"
                    : "border-green-200 bg-green-50 text-green-900",
                )}
              >
                {hasBlockingErrors ? (
                  <p className="font-medium">Corrija os erros e recarregue o arquivo</p>
                ) : (
                  <p className="font-medium">
                    Planilha válida — {quotationItems.length} itens prontos para importar
                  </p>
                )}
                <ul className="list-none space-y-1">
                  {parseErrors.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            {parseWarnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-1">
                <p className="font-medium">Avisos</p>
                <ul className="list-disc list-inside">
                  {parseWarnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => setStep(3)} disabled={!canAdvanceStep2}>
                Avançar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 3 && (
          <>
            <DialogHeader>
              <DialogTitle>Etapa 3 de 3 — Confirmar Importação</DialogTitle>
            </DialogHeader>

            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium">
                {quotationItems.length} itens serão atualizados
              </p>
              <Badge variant="outline" className="text-xs">
                Condição de pagamento: {parsedPayment.trim() || "—"}
              </Badge>
            </div>

            <div className="rounded-md border border-border overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <th className="px-2 py-2">Cód.</th>
                    <th className="px-2 py-2">Descrição</th>
                    <th className="px-2 py-2 text-right">Preço Unit.</th>
                    <th className="px-2 py-2 text-center">Imposto %</th>
                    <th className="px-2 py-2 text-center">Prazo</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.slice(0, 10).map((r) => {
                    const qi = quotationItems.find((q) => q.id === r.quotation_item_id)
                    return (
                      <tr key={r.quotation_item_id} className="border-b border-border">
                        <td className="px-2 py-2 font-mono text-xs">{qi?.material_code ?? "—"}</td>
                        <td className="px-2 py-2 max-w-[200px] truncate">
                          {qi?.material_description ?? "—"}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{r.unit_price}</td>
                        <td className="px-2 py-2 text-center">{r.tax_percent}</td>
                        <td className="px-2 py-2 text-center">
                          {r.delivery_days ?? "—"}
                        </td>
                        <td className="px-2 py-2">{r.item_status}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {summaryRows.length > 10 ? (
                <p className="text-xs text-muted-foreground p-2">
                  e mais {summaryRows.length - 10} itens
                </p>
              ) : null}
            </div>

            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Os valores atuais da proposta serão substituídos. A proposta será salva como rascunho.
            </p>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-green-600 hover:bg-green-600/90 text-white"
                onClick={handleFinalize}
              >
                <Check className="w-4 h-4 mr-2" />
                Finalizar Importação
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
