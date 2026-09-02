import type { NegotiationReportData } from "@/lib/negotiation/report-data"
import { formatDateTimeBR, formatExportFileTimestamp } from "@/lib/formato-data"

const STRATEGY_LABEL: Record<string, string> = {
  per_item: "Por item",
  per_supplier: "Por fornecedor",
  by_category: "Por categoria",
  by_cost_center: "Por centro de custo",
}

function boolLabel(value: boolean): string {
  return value ? "Sim" : "Não"
}

function formatBrl(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export async function buildNegotiationReportExcelBuffer(
  data: NegotiationReportData,
): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()

  const headerStyle = {
    font: { bold: true, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF4F3EF5" } },
  }

  const summary = wb.addWorksheet("Resumo")
  summary.columns = [
    { header: "Campo", key: "field", width: 36 },
    { header: "Valor", key: "value", width: 48 },
  ]
  Object.assign(summary.getRow(1), headerStyle)

  const m = data.metrics
  const rows = [
    ["Cotação", data.quotation.code],
    ["Descrição", data.quotation.description],
    ["Empresa", data.quotation.company_name],
    ["Status do evento", data.run.status],
    ["Início", data.run.started_at ? formatDateTimeBR(data.run.started_at, true) : "—"],
    ["Conclusão", data.run.completed_at ? formatDateTimeBR(data.run.completed_at, true) : "—"],
    ["Rodadas mín./máx.", `${data.plan.min_rounds} / ${data.plan.max_rounds}`],
    ["Teto (% acima melhor)", String(data.plan.max_price_pct_above_best)],
    ["Saving alvo (%)", String(data.plan.target_saving_pct_below_target)],
    ["Estratégia", STRATEGY_LABEL[data.plan.strategy] ?? data.plan.strategy],
    ["Parar no alvo", boolLabel(data.plan.stop_on_target)],
    ["Parar sem melhoria", boolLabel(data.plan.stop_on_no_improvement)],
    ["Rodadas concluídas", String(m.rounds_closed_in_run)],
    ["Última melhoria (%)", m.last_improvement_pct != null ? String(m.last_improvement_pct) : "—"],
    ["Total melhor (última rodada)", formatBrl(m.last_round_best_total)],
  ]
  for (const [field, value] of rows) {
    summary.addRow({ field, value })
  }

  const rounds = wb.addWorksheet("Rodadas")
  rounds.columns = [
    { header: "Rodada", key: "round", width: 10 },
    { header: "Total melhor", key: "total", width: 18 },
    { header: "Itens c/ oferta", key: "items", width: 16 },
    { header: "Violações teto", key: "violations", width: 16 },
  ]
  Object.assign(rounds.getRow(1), headerStyle)
  for (const snap of m.round_snapshots) {
    rounds.addRow({
      round: snap.round_number,
      total: snap.best_total,
      items: snap.items_with_offer,
      violations: snap.ceiling_violations,
    })
  }

  const logs = wb.addWorksheet("Decisões")
  logs.columns = [
    { header: "Data", key: "at", width: 20 },
    { header: "Tipo", key: "type", width: 12 },
    { header: "Ação", key: "action", width: 22 },
    { header: "Motivo", key: "reason", width: 60 },
  ]
  Object.assign(logs.getRow(1), headerStyle)
  for (const log of data.decision_logs) {
    logs.addRow({
      at: formatDateTimeBR(log.created_at, true),
      type: log.decision_type,
      action: log.action,
      reason: log.reason ?? "",
    })
  }

  const offers = wb.addWorksheet("Contrapropostas")
  offers.columns = [
    { header: "Item", key: "item", width: 14 },
    { header: "Descrição", key: "desc", width: 32 },
    { header: "Fornecedor", key: "supplier", width: 24 },
    { header: "Melhor", key: "best", width: 14 },
    { header: "Alvo", key: "target", width: 14 },
    { header: "Criado em", key: "at", width: 20 },
  ]
  Object.assign(offers.getRow(1), headerStyle)
  for (const co of data.counter_offers) {
    offers.addRow({
      item: co.material_code ?? "—",
      desc: co.material_description ?? "",
      supplier: co.supplier_name ?? "Todos",
      best: co.current_best_unit_price,
      target: co.target_unit_price,
      at: formatDateTimeBR(co.created_at, true),
    })
  }

  if (data.group_summaries.length > 0) {
    const groups = wb.addWorksheet("Grupos")
    groups.columns = [
      { header: "Grupo", key: "group", width: 28 },
      { header: "Itens", key: "items", width: 10 },
      { header: "Total melhor", key: "best", width: 16 },
      { header: "Total alvo", key: "target", width: 16 },
      { header: "Saving (%)", key: "saving", width: 12 },
    ]
    Object.assign(groups.getRow(1), headerStyle)
    for (const g of data.group_summaries) {
      groups.addRow({
        group: g.group_key,
        items: g.item_count,
        best: g.best_total,
        target: g.target_total,
        saving: g.saving_pct,
      })
    }
  }

  if (data.item_evolution.length > 0) {
    const maxRound = Math.max(
      ...data.item_evolution.flatMap((i) => i.rounds.map((r) => r.round_number)),
    )
    const itemsSheet = wb.addWorksheet("Evolução itens")
    const columns: { header: string; key: string; width: number }[] = [
      { header: "Código", key: "code", width: 14 },
      { header: "Descrição", key: "desc", width: 36 },
      { header: "Alvo catálogo", key: "target", width: 14 },
    ]
    for (let n = 1; n <= maxRound; n += 1) {
      columns.push({ header: `R${n} melhor`, key: `r${n}`, width: 14 })
    }
    itemsSheet.columns = columns
    Object.assign(itemsSheet.getRow(1), headerStyle)

    for (const item of data.item_evolution) {
      const row: Record<string, string | number | null> = {
        code: item.material_code,
        desc: item.material_description,
        target: item.target_price,
      }
      for (const r of item.rounds) {
        row[`r${r.round_number}`] = r.best_unit_price
      }
      itemsSheet.addRow(row)
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export function negotiationReportFileBaseName(quotationCode: string): string {
  return `negociacao_${quotationCode}_${formatExportFileTimestamp()}`
}
