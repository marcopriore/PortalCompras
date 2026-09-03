import type { Workbook } from "exceljs"

const HEADER_COLOR = "FF4F3EF5"

type ExcelBorder = {
  top: { style: "thin"; color: { argb: string } }
  bottom: { style: "thin"; color: { argb: string } }
  left: { style: "thin"; color: { argb: string } }
  right: { style: "thin"; color: { argb: string } }
}

const BORDER: ExcelBorder = {
  top: { style: "thin", color: { argb: "FFDDDDDD" } },
  bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
  left: { style: "thin", color: { argb: "FFDDDDDD" } },
  right: { style: "thin", color: { argb: "FFDDDDDD" } },
}

export async function downloadExcelWorkbook(
  workbook: Workbook,
  filename: string,
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export type PurchaseOrderExcelItem = {
  material_code: string
  material_description: string
  site_code: string | null
  quantity: number
  unit_of_measure: string | null
  price_unit: number
  unit_price: number
  total_price: number | null
}

export type PurchaseOrderExcelData = {
  code: string
  erp_code: string | null
  supplier_name: string
  supplier_cnpj: string | null
  payment_condition: string | null
  delivery_days: number | null
  estimated_delivery_label: string
  quotation_code: string | null
  requisition_code: string | null
  delivery_address: string | null
  observations: string | null
  created_at_label: string
  items: PurchaseOrderExcelItem[]
  order_total: number
}

export type PurchaseOrderExcelOptions = {
  porEnabled: boolean
  lineTotal: (item: PurchaseOrderExcelItem) => number
}

export async function buildPurchaseOrderDetailWorkbook(
  data: PurchaseOrderExcelData,
  options: PurchaseOrderExcelOptions,
): Promise<Workbook> {
  const ExcelJS = (await import("exceljs")).default
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet("Pedido")

  const itemHeaders = [
    "Código",
    "Descrição Curta",
    "Centro / Filial",
    "Qtd",
    "Unidade",
    ...(options.porEnabled ? ["POR"] : []),
    "Preço Unit.",
    "Total Item",
  ]
  const itemColCount = itemHeaders.length
  const qtyCol = 4
  const priceCol = options.porEnabled ? 7 : 6
  const totalCol = options.porEnabled ? 8 : 7

  ws.columns = Array.from({ length: itemColCount }, (_, i) => ({
    width: i === 1 ? 42 : i === 0 || i === 2 ? 16 : 14,
  }))

  ws.mergeCells(1, 1, 1, itemColCount)
  const titleCell = ws.getCell(1, 1)
  titleCell.value = `Pedido ${data.code}`
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } }
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HEADER_COLOR },
  }
  titleCell.alignment = { horizontal: "center", vertical: "middle" }
  ws.getRow(1).height = 24

  const infoRows: Array<[string, string]> = [
    ["Nº Pedido:", data.code],
    ["Código ERP:", data.erp_code ?? "—"],
    ["Fornecedor:", data.supplier_name],
    ["CNPJ:", data.supplier_cnpj ?? "—"],
    ["Condição de Pagamento:", data.payment_condition ?? "—"],
    [
      "Prazo de Entrega:",
      data.delivery_days != null ? `${data.delivery_days} dias` : "—",
    ],
    ["Entrega Prevista:", data.estimated_delivery_label],
    ["Código Cotação:", data.quotation_code ?? "—"],
    ["Código Requisição:", data.requisition_code ?? "—"],
    ["Endereço de Entrega:", data.delivery_address ?? "—"],
    ["Observações:", data.observations ?? "—"],
    ["Data Criação:", data.created_at_label],
  ]

  let rowIndex = 3
  for (const [label, value] of infoRows) {
    const row = ws.getRow(rowIndex)
    row.getCell(1).value = label
    row.getCell(2).value = value
    ws.mergeCells(rowIndex, 2, rowIndex, itemColCount)
    row.getCell(1).font = { bold: true }
    row.getCell(1).alignment = { vertical: "top" }
    row.getCell(2).alignment = { vertical: "top", wrapText: true }
    rowIndex += 1
  }

  rowIndex += 1
  const headerRow = ws.getRow(rowIndex)
  itemHeaders.forEach((header, idx) => {
    const cell = headerRow.getCell(idx + 1)
    cell.value = header
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_COLOR },
    }
    cell.font = { color: { argb: "FFFFFFFF" }, bold: true, size: 11 }
    cell.alignment = { horizontal: "center", vertical: "middle" }
    cell.border = BORDER
  })
  headerRow.height = 20

  rowIndex += 1
  for (const item of data.items) {
    const row = ws.getRow(rowIndex)
    const lineTotal = options.lineTotal(item)
    const values: (string | number)[] = [
      item.material_code,
      item.material_description,
      item.site_code ?? "—",
      item.quantity,
      item.unit_of_measure ?? "—",
      ...(options.porEnabled ? [item.price_unit] : []),
      item.unit_price,
      lineTotal,
    ]

    values.forEach((value, idx) => {
      const cell = row.getCell(idx + 1)
      cell.value = value
      cell.border = BORDER
      cell.alignment = { vertical: "middle", wrapText: idx === 1 }
      if (idx + 1 === priceCol || idx + 1 === totalCol) {
        cell.numFmt = '"R$" #,##0.00'
      }
      if (idx + 1 === qtyCol) {
        cell.alignment = { horizontal: "center", vertical: "middle" }
      }
    })

    rowIndex += 1
  }

  const totalRow = ws.getRow(rowIndex)
  const mergeEndCol = totalCol - 1
  if (mergeEndCol >= 1) {
    ws.mergeCells(rowIndex, 1, rowIndex, mergeEndCol)
  }
  totalRow.getCell(1).value = "Total do Pedido"
  totalRow.getCell(1).font = { bold: true }
  totalRow.getCell(1).alignment = { horizontal: "right", vertical: "middle" }

  const totalCell = totalRow.getCell(totalCol)
  totalCell.value = data.order_total
  totalCell.numFmt = '"R$" #,##0.00'
  totalCell.font = { bold: true }

  for (let col = 1; col <= itemColCount; col += 1) {
    const cell = totalRow.getCell(col)
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8E8E8" },
    }
    cell.border = BORDER
  }

  ws.views = [{ state: "frozen", ySplit: 0 }]

  return workbook
}
