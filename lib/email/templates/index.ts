import { emailBase, emailButton, emailInfoRow } from "@/lib/email/templates/base"

export function getAppEmailBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}

export function templateProposalSubmitted(data: {
  buyerName: string
  supplierName: string
  quotationCode: string
  roundNumber: number
  totalPrice?: number
}): { subject: string; html: string } {
  const base = getAppEmailBaseUrl()
  const totalRow =
    data.totalPrice != null
      ? emailInfoRow(
          "Valor Total",
          `R$ ${data.totalPrice.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
        )
      : ""
  const content = `
      <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 8px;">
        Nova proposta recebida
      </h2>
      <p style="color:#6c757d;font-size:15px;margin:0 0 32px;">
        Olá, ${data.buyerName}! Um fornecedor enviou uma proposta para sua cotação.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;">
        <tr><td>
          <table width="100%">
            ${emailInfoRow("Fornecedor", data.supplierName)}
            ${emailInfoRow("Cotação", data.quotationCode)}
            ${emailInfoRow("Rodada", `Rodada ${data.roundNumber}`)}
            ${totalRow}
          </table>
        </td></tr>
      </table>
      ${emailButton("Ver Equalização", `${base}/comprador/cotacoes`)}
    `
  return {
    subject: `Nova proposta recebida — ${data.quotationCode}`,
    html: emailBase(content, "Nova proposta recebida"),
  }
}

export function templateOrderAccepted(data: {
  buyerName: string
  supplierName: string
  orderCode: string
  estimatedDelivery?: string
}): { subject: string; html: string } {
  const base = getAppEmailBaseUrl()
  const content = `
      <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 8px;">
        Pedido aceito pelo fornecedor
      </h2>
      <p style="color:#6c757d;font-size:15px;margin:0 0 32px;">
        Olá, ${data.buyerName}! Seu pedido foi aceito e está em andamento.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;
                  padding:16px;margin-bottom:24px;text-align:center;">
        <span style="font-size:32px;">✅</span>
        <p style="color:#166534;font-weight:600;margin:8px 0 0;font-size:16px;">
          ${data.orderCode} aceito
        </p>
        ${
          data.estimatedDelivery
            ? `<p style="color:#4ade80;font-size:13px;margin:4px 0 0;">Entrega prevista: ${data.estimatedDelivery}</p>`
            : ""
        }
      </div>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;">
        <tr><td>
          <table width="100%">
            ${emailInfoRow("Fornecedor", data.supplierName)}
            ${emailInfoRow("Pedido", data.orderCode)}
            ${
              data.estimatedDelivery
                ? emailInfoRow("Entrega Prevista", data.estimatedDelivery)
                : ""
            }
          </table>
        </td></tr>
      </table>
      ${emailButton("Ver Pedido", `${base}/comprador/pedidos`)}
    `
  return {
    subject: `Pedido aceito — ${data.orderCode}`,
    html: emailBase(content, "Pedido aceito"),
  }
}

export function templateOrderRefused(data: {
  buyerName: string
  supplierName: string
  orderCode: string
  reason?: string
}): { subject: string; html: string } {
  const base = getAppEmailBaseUrl()
  const content = `
      <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 8px;">
        Pedido recusado pelo fornecedor
      </h2>
      <p style="color:#6c757d;font-size:15px;margin:0 0 32px;">
        Olá, ${data.buyerName}! O fornecedor recusou o pedido ${data.orderCode}.
        Você pode revisar as condições e reenviar.
      </p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;
                  padding:16px;margin-bottom:24px;">
        <p style="color:#dc2626;font-weight:600;margin:0 0 8px;">Motivo da recusa:</p>
        <p style="color:#7f1d1d;margin:0;font-size:14px;">
          ${data.reason ?? "Não informado"}
        </p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;">
        <tr><td>
          <table width="100%">
            ${emailInfoRow("Fornecedor", data.supplierName)}
            ${emailInfoRow("Pedido", data.orderCode)}
          </table>
        </td></tr>
      </table>
      ${emailButton("Revisar e Reenviar", `${base}/comprador/pedidos`)}
    `
  return {
    subject: `Pedido recusado — ${data.orderCode}`,
    html: emailBase(content, "Pedido recusado"),
  }
}

export function templateNewRound(data: {
  supplierName: string
  quotationCode: string
  roundNumber: number
  deadline?: string
}): { subject: string; html: string } {
  const base = getAppEmailBaseUrl()
  const deadlineBlock = data.deadline
    ? `
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;
                  padding:16px;margin-bottom:24px;text-align:center;">
        <p style="color:#92400e;font-weight:600;margin:0;font-size:14px;">
          ⏰ Prazo para resposta: ${data.deadline}
        </p>
      </div>`
    : ""
  const content = `
      <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 8px;">
        Nova rodada de negociação
      </h2>
      <p style="color:#6c757d;font-size:15px;margin:0 0 32px;">
        Olá, ${data.supplierName}! Uma nova rodada foi aberta e aguarda sua proposta.
      </p>
      ${deadlineBlock}
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;">
        <tr><td>
          <table width="100%">
            ${emailInfoRow("Cotação", data.quotationCode)}
            ${emailInfoRow("Rodada", `Rodada ${data.roundNumber}`)}
            ${data.deadline ? emailInfoRow("Prazo", data.deadline) : ""}
          </table>
        </td></tr>
      </table>
      ${emailButton("Responder Proposta", `${base}/fornecedor/cotacoes`)}
    `
  return {
    subject: `Nova rodada de negociação — ${data.quotationCode} Rodada ${data.roundNumber}`,
    html: emailBase(content, "Nova rodada de negociação"),
  }
}

export function templateDeliveryUpdated(data: {
  buyerName: string
  supplierName: string
  orderCode: string
  newDate: string
  reason?: string
}): { subject: string; html: string } {
  const base = getAppEmailBaseUrl()
  const content = `
      <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 8px;">
        Data de entrega atualizada
      </h2>
      <p style="color:#6c757d;font-size:15px;margin:0 0 32px;">
        Olá, ${data.buyerName}! O fornecedor atualizou a data de entrega do pedido ${data.orderCode}.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;">
        <tr><td>
          <table width="100%">
            ${emailInfoRow("Fornecedor", data.supplierName)}
            ${emailInfoRow("Pedido", data.orderCode)}
            ${emailInfoRow("Nova data de entrega", data.newDate)}
            ${data.reason ? emailInfoRow("Justificativa", data.reason) : ""}
          </table>
        </td></tr>
      </table>
      ${emailButton("Ver Pedido", `${base}/comprador/pedidos`)}
    `
  return {
    subject: `Data de entrega atualizada — ${data.orderCode}`,
    html: emailBase(content, "Data de entrega atualizada"),
  }
}
