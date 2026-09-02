import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import type { NegotiationReportData } from "@/lib/negotiation/report-data"
import { formatDateTimeBR, formatNowBR } from "@/lib/formato-data"

const PRIMARY = "#4F3EF5"
const GRAY = "#6b7280"
const BORDER = "#e5e7eb"

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#111827" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: PRIMARY, marginBottom: 4 },
  subtitle: { fontSize: 10, color: GRAY, marginBottom: 16 },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 4,
  },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: "38%", color: GRAY },
  value: { width: "62%" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: PRIMARY,
    color: "#ffffff",
    padding: 4,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER, padding: 4 },
  colSm: { width: "12%" },
  colMd: { width: "22%" },
  colLg: { width: "34%" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: GRAY },
})

function formatBrl(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

type Props = { data: NegotiationReportData }

export function NegotiationReportPDF({ data }: Props) {
  const m = data.metrics
  const summaryRows: [string, string][] = [
    ["Cotação", data.quotation.code],
    ["Empresa", data.quotation.company_name],
    ["Status", data.run.status],
    [
      "Período",
      `${data.run.started_at ? formatDateTimeBR(data.run.started_at, true) : "—"} → ${
        data.run.completed_at ? formatDateTimeBR(data.run.completed_at, true) : "—"
      }`,
    ],
    ["Rodadas (mín./máx.)", `${data.plan.min_rounds} / ${data.plan.max_rounds}`],
    ["Teto / Saving (%)", `${data.plan.max_price_pct_above_best}% / ${data.plan.target_saving_pct_below_target}%`],
    ["Rodadas concluídas", String(m.rounds_closed_in_run)],
    ["Última melhoria", m.last_improvement_pct != null ? `${m.last_improvement_pct}%` : "—"],
    ["Total melhor (última)", formatBrl(m.last_round_best_total)],
  ]

  const completionLog = [...data.decision_logs]
    .reverse()
    .find((l) => l.action === "complete" || l.action === "cancel")

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Relatório — Negociação assistida</Text>
        <Text style={styles.subtitle}>{data.quotation.description}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo do evento</Text>
          {summaryRows.map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          ))}
          {completionLog?.reason ? (
            <View style={{ marginTop: 6 }}>
              <Text style={{ color: GRAY }}>Motivo de encerramento</Text>
              <Text>{completionLog.reason}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rodadas</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colSm}>Rod.</Text>
            <Text style={styles.colMd}>Total melhor</Text>
            <Text style={styles.colSm}>Itens</Text>
            <Text style={styles.colMd}>Violações teto</Text>
          </View>
          {m.round_snapshots.map((snap) => (
            <View key={snap.round_id} style={styles.tableRow}>
              <Text style={styles.colSm}>{snap.round_number}</Text>
              <Text style={styles.colMd}>{formatBrl(snap.best_total)}</Text>
              <Text style={styles.colSm}>{snap.items_with_offer}</Text>
              <Text style={styles.colMd}>{snap.ceiling_violations}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>Gerado em {formatNowBR(true)} · Valore Portal de Compras</Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Decisões registradas</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.colMd}>Data</Text>
          <Text style={styles.colSm}>Tipo</Text>
          <Text style={styles.colLg}>Motivo</Text>
        </View>
        {data.decision_logs.slice(0, 35).map((log) => (
          <View key={log.id} style={styles.tableRow}>
            <Text style={styles.colMd}>{formatDateTimeBR(log.created_at, true)}</Text>
            <Text style={styles.colSm}>{log.decision_type}</Text>
            <Text style={styles.colLg}>{log.reason ?? log.action}</Text>
          </View>
        ))}
        <Text style={styles.footer}>Gerado em {formatNowBR(true)} · Valore Portal de Compras</Text>
      </Page>
    </Document>
  )
}
