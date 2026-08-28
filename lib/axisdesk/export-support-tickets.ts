import { formatDateTimeBR, formatExportFileTimestamp } from "@/lib/formato-data"
import type { AxisDeskChamado } from "@/lib/axisdesk/types"
import {
  AXISDESK_TIPO_OPTIONS,
  getAxisDeskPrioridadeLabel,
  getAxisDeskStatusLabel,
} from "@/lib/axisdesk/types"

export async function exportSupportTicketsExcel(
  tickets: AxisDeskChamado[],
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Chamados")

  ws.columns = [
    { header: "Título", key: "titulo", width: 40 },
    { header: "Tipo", key: "tipo", width: 14 },
    { header: "Status", key: "status", width: 22 },
    { header: "Prioridade", key: "prioridade", width: 14 },
    { header: "Categoria", key: "categoria", width: 28 },
    { header: "Responsável", key: "responsavel", width: 28 },
    { header: "SLA", key: "sla", width: 20 },
    { header: "Criado em", key: "criado_em", width: 20 },
  ]

  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4F3EF5" },
  }

  for (const ticket of tickets) {
    ws.addRow({
      titulo: ticket.titulo,
      tipo:
        AXISDESK_TIPO_OPTIONS.find((o) => o.value === ticket.tipo)?.label ??
        ticket.tipo,
      status: getAxisDeskStatusLabel(ticket.status),
      prioridade: getAxisDeskPrioridadeLabel(ticket.prioridade),
      categoria: ticket.categoria?.nome ?? "—",
      responsavel: ticket.solicitante?.nome ?? "—",
      sla: formatDateTimeBR(ticket.sla_prazo, true),
      criado_em: formatDateTimeBR(ticket.created_at, true),
    })
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `chamados_suporte_${formatExportFileTimestamp()}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
