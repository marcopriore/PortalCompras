export type POStatusColor = "amber" | "blue" | "green" | "red" | "slate"

export function getPOStatusForSupplier(status: string): {
  label: string
  color: POStatusColor
} {
  switch (status) {
    case "sent":
      return { label: "Pendente Aceite", color: "amber" }
    case "processing":
      return { label: "Pedido Aceito", color: "blue" }
    case "completed":
      return { label: "Pedido Finalizado", color: "green" }
    case "cancelled":
      return { label: "Pedido Cancelado", color: "red" }
    case "refused":
      return { label: "Pedido Recusado", color: "red" }
    default:
      return { label: status, color: "slate" }
  }
}

export function getPOStatusForBuyer(status: string): {
  label: string
  color: POStatusColor
} {
  switch (status) {
    case "draft":
      return { label: "Rascunho", color: "slate" }
    case "sent":
      return { label: "Aguardando Aceite", color: "amber" }
    case "processing":
      return { label: "Processando Integração", color: "blue" }
    case "completed":
      return { label: "Concluído", color: "green" }
    case "cancelled":
      return { label: "Cancelado", color: "red" }
    case "error":
      return { label: "Erro Integração", color: "red" }
    case "refused":
      return { label: "Recusado pelo Fornecedor", color: "red" }
    default:
      return { label: status, color: "slate" }
  }
}

export function poStatusBadgeClass(color: POStatusColor): string {
  switch (color) {
    case "amber":
      return "bg-amber-50 text-amber-700 border border-amber-100"
    case "blue":
      return "bg-blue-50 text-blue-700 border border-blue-100"
    case "green":
      return "bg-green-50 text-green-700 border border-green-100"
    case "red":
      return "bg-red-50 text-red-700 border border-red-100"
    default:
      return "bg-slate-50 text-slate-700 border border-slate-200"
  }
}
