import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer"

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
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 16,
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
    fontSize: 18,
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
    marginBottom: 16,
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
    width: 90,
  },
  colValue: {
    fontSize: 8,
    color: BLACK,
    flex: 1,
    fontFamily: "Helvetica-Bold",
  },
  tableContainer: {
    marginBottom: 16,
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
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  tableHeaderCell: {
    color: "#ffffff",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRowAlt: {
    backgroundColor: LIGHT_GRAY,
  },
  tableCell: {
    fontSize: 8,
    color: BLACK,
  },
  colCod: { width: 70 },
  colDesc: { flex: 1 },
  colQtd: { width: 40, textAlign: "right" },
  colUN: { width: 35, textAlign: "center" },
  colPreco: { width: 70, textAlign: "right" },
  colImp: { width: 45, textAlign: "center" },
  colTotal: { width: 75, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 8,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: BLACK,
    marginRight: 16,
  },
  totalValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: PRIMARY,
    width: 75,
    textAlign: "right",
  },
  obsBox: {
    backgroundColor: LIGHT_GRAY,
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
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

function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—"
  const s = String(iso).trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return String(iso)
  const [y, m, d] = s.split("-")
  return `${d}/${m}/${y}`
}

function formatCNPJ(cnpj: string | null): string {
  if (!cnpj) return "—"
  const d = cnpj.replace(/\D/g, "")
  if (d.length !== 14) return cnpj
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export type PurchaseOrderPDFOrder = {
  code: string
  erp_code: string | null
  supplier_name: string
  supplier_cnpj: string | null
  payment_condition: string | null
  delivery_days: number | null
  delivery_address: string | null
  quotation_code: string | null
  requisition_code: string | null
  total_price: number | null
  status: string
  observations: string | null
  created_at: string
  estimated_delivery_date: string | null
  accepted_at: string | null
}

export type PurchaseOrderPDFItem = {
  id: string
  material_code: string
  material_description: string
  quantity: number
  unit_of_measure: string | null
  unit_price: number
  tax_percent: number | null
  total_price: number | null
}

export type PurchaseOrderPDFCompany = {
  name: string
  trade_name?: string | null
  cnpj?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  logo_url?: string | null
} | null

type Props = {
  order: PurchaseOrderPDFOrder
  items: PurchaseOrderPDFItem[]
  company: PurchaseOrderPDFCompany
}

export function PurchaseOrderPDF({ order, items, company }: Props) {
  const companyName = company?.trade_name || company?.name || "Empresa"
  const now = new Date().toLocaleDateString("pt-BR")

  const grandTotal = items.reduce((sum, item) => {
    return sum + (item.total_price ?? item.quantity * item.unit_price)
  }, 0)

  return (
    <Document title={`Pedido ${order.code}`} author={companyName} subject="Pedido de Compra">
      <Page size="A4" style={styles.page}>
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
              <Text style={{ fontSize: 8, color: GRAY }}>CNPJ: {formatCNPJ(company.cnpj)}</Text>
            ) : null}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>PEDIDO DE COMPRA</Text>
            <Text style={styles.docCode}>{order.code}</Text>
            {order.erp_code ? (
              <Text style={styles.docDate}>Cód. ERP: {order.erp_code}</Text>
            ) : null}
            <Text style={styles.docDate}>Emitido em: {now}</Text>
            <Text style={styles.docDate}>Criado em: {formatDateBR(order.created_at)}</Text>
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
            {company?.address ? (
              <View style={styles.colRow}>
                <Text style={styles.colLabel}>Endereço:</Text>
                <Text style={styles.colValue}>
                  {company.address}
                  {company.city ? `, ${company.city}` : ""}
                  {company.state ? `/${company.state}` : ""}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.col}>
            <Text style={styles.colTitle}>Fornecedor</Text>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>Empresa:</Text>
              <Text style={styles.colValue}>{order.supplier_name}</Text>
            </View>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>CNPJ:</Text>
              <Text style={styles.colValue}>{formatCNPJ(order.supplier_cnpj)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.colTitle}>Condições do Pedido</Text>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>Cond. Pagamento:</Text>
              <Text style={styles.colValue}>{order.payment_condition ?? "—"}</Text>
            </View>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>Prazo Entrega:</Text>
              <Text style={styles.colValue}>
                {order.delivery_days != null ? `${order.delivery_days} dias` : "—"}
              </Text>
            </View>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>Entrega Prevista:</Text>
              <Text style={styles.colValue}>{formatDateBR(order.estimated_delivery_date)}</Text>
            </View>
          </View>

          <View style={styles.col}>
            <Text style={styles.colTitle}>Referências</Text>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>Cotação:</Text>
              <Text style={styles.colValue}>{order.quotation_code ?? "—"}</Text>
            </View>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>Requisição:</Text>
              <Text style={styles.colValue}>{order.requisition_code ?? "—"}</Text>
            </View>
            <View style={styles.colRow}>
              <Text style={styles.colLabel}>Endereço Entrega:</Text>
              <Text style={styles.colValue}>{order.delivery_address ?? "—"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tableContainer}>
          <Text style={styles.tableTitle}>Itens do Pedido</Text>

          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colCod]}>Código</Text>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>Descrição</Text>
            <Text style={[styles.tableHeaderCell, styles.colQtd]}>Qtd</Text>
            <Text style={[styles.tableHeaderCell, styles.colUN]}>UN</Text>
            <Text style={[styles.tableHeaderCell, styles.colPreco]}>Preço Unit.</Text>
            <Text style={[styles.tableHeaderCell, styles.colImp]}>Imp. %</Text>
            <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total Item</Text>
          </View>

          {items.map((item, idx) => (
            <View
              key={item.id}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.tableCell, styles.colCod]}>{item.material_code}</Text>
              <Text style={[styles.tableCell, styles.colDesc]}>{item.material_description}</Text>
              <Text style={[styles.tableCell, styles.colQtd]}>{item.quantity}</Text>
              <Text style={[styles.tableCell, styles.colUN]}>{item.unit_of_measure ?? "—"}</Text>
              <Text style={[styles.tableCell, styles.colPreco]}>{money.format(item.unit_price)}</Text>
              <Text style={[styles.tableCell, styles.colImp]}>
                {item.tax_percent != null ? `${item.tax_percent}%` : "—"}
              </Text>
              <Text style={[styles.tableCell, styles.colTotal]}>
                {money.format(item.total_price ?? item.quantity * item.unit_price)}
              </Text>
            </View>
          ))}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL DO PEDIDO</Text>
            <Text style={styles.totalValue}>{money.format(grandTotal)}</Text>
          </View>
        </View>

        {order.observations?.trim() ? (
          <View style={styles.obsBox}>
            <Text style={styles.obsTitle}>Observações</Text>
            <Text style={styles.obsText}>{order.observations}</Text>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {companyName} — Documento gerado pelo sistema Valore
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
