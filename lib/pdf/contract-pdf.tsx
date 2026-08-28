import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer"
import {
  CONTRACT_KINDS,
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  type ContractKind,
  type ContractStatus,
  type ContractType,
} from "@/types/contracts"
import { contractAvailableValue } from "@/lib/contracts/contract-balance-helpers"
import { formatDateBR, formatNowBR } from "@/lib/formato-data"

const PRIMARY = "#4f46e5"
const GRAY = "#6b7280"
const LIGHT_GRAY = "#f3f4f6"
const BORDER = "#e5e7eb"
const BLACK = "#111827"

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: BLACK,
    padding: 40,
    paddingBottom: 56,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
  },
  logo: {
    width: 80,
    height: 40,
    objectFit: "contain",
  },
  logoPlaceholder: {
    width: 80,
    height: 40,
    backgroundColor: PRIMARY,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  logoPlaceholderText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  docTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: PRIMARY,
    marginBottom: 4,
  },
  docCode: {
    fontSize: 11,
    color: GRAY,
    marginBottom: 2,
  },
  docDate: {
    fontSize: 9,
    color: GRAY,
  },
  twoCol: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 14,
  },
  col: {
    flex: 1,
    backgroundColor: LIGHT_GRAY,
    borderRadius: 4,
    padding: 12,
  },
  colTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: PRIMARY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  colRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  colLabel: {
    fontSize: 8,
    color: GRAY,
    width: 88,
  },
  colValue: {
    fontSize: 8,
    color: BLACK,
    flex: 1,
    fontFamily: "Helvetica-Bold",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  metricBox: {
    flex: 1,
    backgroundColor: LIGHT_GRAY,
    borderRadius: 4,
    padding: 8,
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 7,
    color: GRAY,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: BLACK,
  },
  tableContainer: {
    marginBottom: 14,
  },
  tableTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: BLACK,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: PRIMARY,
    borderRadius: 2,
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginBottom: 2,
  },
  tableHeaderCell: {
    color: "#ffffff",
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRowAlt: {
    backgroundColor: LIGHT_GRAY,
  },
  tableCell: {
    fontSize: 7,
    color: BLACK,
  },
  colItem: { width: 22 },
  colCod: { width: 58 },
  colDesc: { flex: 1 },
  colUN: { width: 28, textAlign: "center" },
  colQtd: { width: 42, textAlign: "right" },
  colPreco: { width: 58, textAlign: "right" },
  colPrazo: { width: 36, textAlign: "right" },
  colTotal: { width: 62, textAlign: "right" },
  obsBox: {
    backgroundColor: LIGHT_GRAY,
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
  },
  obsTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  obsText: {
    fontSize: 8,
    color: BLACK,
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  footerText: {
    fontSize: 7,
    color: GRAY,
  },
})

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

function formatCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return "—"
  const d = cnpj.replace(/\D/g, "")
  if (d.length !== 14) return cnpj
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function statusLabel(status: ContractStatus): string {
  return CONTRACT_STATUSES.find((s) => s.value === status)?.label ?? status
}

function kindLabel(kind: ContractKind): string {
  return CONTRACT_KINDS.find((k) => k.value === kind)?.label ?? kind
}

function typeLabel(type: ContractType | null | undefined): string {
  if (!type) return "—"
  return CONTRACT_TYPES.find((t) => t.value === type)?.label ?? type
}

export type ContractPDFContract = {
  code: string
  title: string
  status: ContractStatus
  contract_kind: ContractKind
  type?: ContractType | null
  start_date: string
  end_date: string
  value: number | null
  total_value: number | null
  consumed_value: number
  reserved_value: number
  payment_condition: string | null
  erp_code: string | null
  quotation_code: string | null
  contract_terms: string | null
  notes: string | null
  supplier_name: string
  supplier_code: string
  supplier_cnpj: string | null
  created_at: string
  sent_for_acceptance_at: string | null
  accepted_at: string | null
}

export type ContractPDFItem = {
  id: string
  line_number: number
  material_code: string
  material_description: string
  unit_of_measure: string | null
  quantity_contracted: number
  quantity_consumed: number
  unit_price: number
  total_price: number
  delivery_days: number | null
}

export type ContractPDFCompany = {
  name: string
  cnpj?: string | null
  logo_url?: string | null
} | null

type Props = {
  contract: ContractPDFContract
  items: ContractPDFItem[]
  company: ContractPDFCompany
}

export function ContractPDF({ contract, items, company }: Props) {
  const companyName = company?.name || "Empresa"
  const now = formatNowBR()
  const available = contractAvailableValue(contract)

  return (
    <Document
      title={`Contrato ${contract.code}`}
      author={companyName}
      subject="Contrato de Fornecimento"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <View>
            {company?.logo_url ? (
              <Image src={company.logo_url} style={styles.logo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>
                  {companyName.slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={{ fontSize: 9, color: GRAY, marginTop: 6 }}>{companyName}</Text>
            {company?.cnpj ? (
              <Text style={{ fontSize: 8, color: GRAY }}>
                CNPJ: {formatCNPJ(company.cnpj)}
              </Text>
            ) : null}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>CONTRATO</Text>
            <Text style={styles.docCode}>{contract.code}</Text>
            <Text style={styles.docDate}>{contract.title}</Text>
            <Text style={styles.docDate}>Emitido em: {now}</Text>
            <Text style={styles.docDate}>
              Criado em: {formatDateBR(contract.created_at)}
            </Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.colTitle}>Comprador</Text>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>Empresa:</Text>
              <Text style={styles.colValue}>{companyName}</Text>
            </View>
            {company?.cnpj ? (
              <View style={styles.colRow}>
                <Text style={styles.colLabel}>CNPJ:</Text>
                <Text style={styles.colValue}>{formatCNPJ(company.cnpj)}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.col}>
            <Text style={styles.colTitle}>Fornecedor</Text>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>Empresa:</Text>
              <Text style={styles.colValue}>{contract.supplier_name}</Text>
            </View>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>Código:</Text>
              <Text style={styles.colValue}>{contract.supplier_code}</Text>
            </View>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>CNPJ:</Text>
              <Text style={styles.colValue}>{formatCNPJ(contract.supplier_cnpj)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.colTitle}>Dados do Contrato</Text>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>Status:</Text>
              <Text style={styles.colValue}>{statusLabel(contract.status)}</Text>
            </View>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>Modalidade:</Text>
              <Text style={styles.colValue}>{kindLabel(contract.contract_kind)}</Text>
            </View>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>Tipo:</Text>
              <Text style={styles.colValue}>{typeLabel(contract.type)}</Text>
            </View>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>Vigência:</Text>
              <Text style={styles.colValue}>
                {formatDateBR(contract.start_date)} a {formatDateBR(contract.end_date)}
              </Text>
            </View>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>Cond. Pagamento:</Text>
              <Text style={styles.colValue}>{contract.payment_condition ?? "—"}</Text>
            </View>
          </View>

          <View style={styles.col}>
            <Text style={styles.colTitle}>Referências</Text>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>Cotação:</Text>
              <Text style={styles.colValue}>{contract.quotation_code ?? "—"}</Text>
            </View>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>Cód. ERP:</Text>
              <Text style={styles.colValue}>{contract.erp_code ?? "—"}</Text>
            </View>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>Valor Contrato:</Text>
              <Text style={styles.colValue}>
                {contract.value != null ? money.format(contract.value) : "—"}
              </Text>
            </View>
            {contract.sent_for_acceptance_at ? (
              <View style={styles.colRow}>
                <Text style={styles.colLabel}>Enviado em:</Text>
                <Text style={styles.colValue}>
                  {formatDateBR(contract.sent_for_acceptance_at)}
                </Text>
              </View>
            ) : null}
            {contract.accepted_at ? (
              <View style={styles.colRow}>
                <Text style={styles.colLabel}>Aceito em:</Text>
                <Text style={styles.colValue}>{formatDateBR(contract.accepted_at)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {items.length > 0 ? (
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Valor Total</Text>
              <Text style={styles.metricValue}>
                {contract.total_value != null
                  ? money.format(contract.total_value)
                  : "—"}
              </Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Reservado</Text>
              <Text style={styles.metricValue}>
                {money.format(contract.reserved_value)}
              </Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Consumido</Text>
              <Text style={styles.metricValue}>
                {money.format(contract.consumed_value)}
              </Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Saldo</Text>
              <Text style={styles.metricValue}>{money.format(available)}</Text>
            </View>
          </View>
        ) : null}

        {items.length > 0 ? (
          <View style={styles.tableContainer}>
            <Text style={styles.tableTitle}>Itens do Contrato</Text>

            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.colItem]}>#</Text>
              <Text style={[styles.tableHeaderCell, styles.colCod]}>Código</Text>
              <Text style={[styles.tableHeaderCell, styles.colDesc]}>Descrição</Text>
              <Text style={[styles.tableHeaderCell, styles.colUN]}>UN</Text>
              <Text style={[styles.tableHeaderCell, styles.colQtd]}>Qtd</Text>
              <Text style={[styles.tableHeaderCell, styles.colPreco]}>Preço Unit.</Text>
              <Text style={[styles.tableHeaderCell, styles.colPrazo]}>Prazo</Text>
              <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total</Text>
            </View>

            {items.map((item, idx) => (
              <View
                key={item.id}
                style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, styles.colItem]}>{item.line_number}</Text>
                <Text style={[styles.tableCell, styles.colCod]}>{item.material_code}</Text>
                <Text style={[styles.tableCell, styles.colDesc]}>
                  {item.material_description}
                </Text>
                <Text style={[styles.tableCell, styles.colUN]}>
                  {item.unit_of_measure ?? "—"}
                </Text>
                <Text style={[styles.tableCell, styles.colQtd]}>
                  {item.quantity_contracted}
                  {item.quantity_consumed > 0
                    ? ` (${item.quantity_consumed} cons.)`
                    : ""}
                </Text>
                <Text style={[styles.tableCell, styles.colPreco]}>
                  {money.format(item.unit_price)}
                </Text>
                <Text style={[styles.tableCell, styles.colPrazo]}>
                  {item.delivery_days != null ? `${item.delivery_days}d` : "—"}
                </Text>
                <Text style={[styles.tableCell, styles.colTotal]}>
                  {money.format(item.total_price)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {contract.notes?.trim() ? (
          <View style={styles.obsBox}>
            <Text style={styles.obsTitle}>Observações</Text>
            <Text style={styles.obsText}>{contract.notes}</Text>
          </View>
        ) : null}

        {contract.contract_terms?.trim() ? (
          <View style={styles.obsBox}>
            <Text style={styles.obsTitle}>Termos Contratuais</Text>
            <Text style={styles.obsText}>{contract.contract_terms}</Text>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {companyName} — Documento gerado pelo sistema Valore
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}
