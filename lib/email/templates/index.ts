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

// ─── CONTRATOS ───────────────────────────────────────────

export function templateContractSentForAcceptance(data: {
  supplierName: string
  buyerCompanyName: string
  contractCode: string
  contractTitle: string
  startDate?: string
  endDate?: string
}): { subject: string; html: string } {
  const base = getAppEmailBaseUrl()
  const vigencia =
    data.startDate && data.endDate
      ? `${data.startDate} até ${data.endDate}`
      : "A definir"
  const content = `
    <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 8px;">
      Contrato aguardando seu aceite
    </h2>
    <p style="color:#6c757d;font-size:15px;margin:0 0 32px;">
      Olá, ${data.supplierName}! A empresa ${data.buyerCompanyName}
      enviou um contrato para sua análise e aceite.
    </p>
    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;
                padding:16px;margin-bottom:24px;text-align:center;">
      <span style="font-size:32px;">📄</span>
      <p style="color:#5b21b6;font-weight:600;margin:8px 0 0;font-size:16px;">
        ${data.contractCode}
      </p>
      <p style="color:#7c3aed;font-size:13px;margin:4px 0 0;">
        ${data.contractTitle}
      </p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr><td>
        <table width="100%">
          ${emailInfoRow("Empresa", data.buyerCompanyName)}
          ${emailInfoRow("Contrato", data.contractCode)}
          ${emailInfoRow("Vigência", vigencia)}
        </table>
      </td></tr>
    </table>
    ${emailButton("Ver Contrato", `${base}/fornecedor/contratos`)}
  `
  return {
    subject: `Contrato aguardando aceite — ${data.contractCode}`,
    html: emailBase(content, "Contrato aguardando aceite"),
  }
}

export function templateContractAccepted(data: {
  buyerName: string
  supplierName: string
  contractCode: string
  contractTitle: string
}): { subject: string; html: string } {
  const base = getAppEmailBaseUrl()
  const content = `
    <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 8px;">
      Contrato aceito pelo fornecedor
    </h2>
    <p style="color:#6c757d;font-size:15px;margin:0 0 32px;">
      Olá, ${data.buyerName}! O fornecedor aceitou o contrato
      e ele está agora ativo.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;
                padding:16px;margin-bottom:24px;text-align:center;">
      <span style="font-size:32px;">✅</span>
      <p style="color:#166534;font-weight:600;margin:8px 0 0;font-size:16px;">
        ${data.contractCode} ativo
      </p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr><td>
        <table width="100%">
          ${emailInfoRow("Fornecedor", data.supplierName)}
          ${emailInfoRow("Contrato", data.contractCode)}
          ${emailInfoRow("Título", data.contractTitle)}
        </table>
      </td></tr>
    </table>
    ${emailButton("Ver Contrato", `${base}/comprador/contratos`)}
  `
  return {
    subject: `Contrato aceito — ${data.contractCode}`,
    html: emailBase(content, "Contrato aceito"),
  }
}

export function templateContractRefused(data: {
  buyerName: string
  supplierName: string
  contractCode: string
  contractTitle: string
  reason?: string
}): { subject: string; html: string } {
  const base = getAppEmailBaseUrl()
  const content = `
    <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 8px;">
      Contrato recusado pelo fornecedor
    </h2>
    <p style="color:#6c757d;font-size:15px;margin:0 0 32px;">
      Olá, ${data.buyerName}! O fornecedor recusou o contrato
      ${data.contractCode}. Você pode revisar as condições e reenviar.
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;
                padding:16px;margin-bottom:24px;">
      <p style="color:#dc2626;font-weight:600;margin:0 0 8px;">
        Motivo da recusa:
      </p>
      <p style="color:#7f1d1d;margin:0;font-size:14px;">
        ${data.reason ?? "Não informado"}
      </p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr><td>
        <table width="100%">
          ${emailInfoRow("Fornecedor", data.supplierName)}
          ${emailInfoRow("Contrato", data.contractCode)}
          ${emailInfoRow("Título", data.contractTitle)}
        </table>
      </td></tr>
    </table>
    ${emailButton("Revisar Contrato", `${base}/comprador/contratos`)}
  `
  return {
    subject: `Contrato recusado — ${data.contractCode}`,
    html: emailBase(content, "Contrato recusado"),
  }
}

export function templateContractExpiringSoon(data: {
  buyerName: string
  supplierName: string
  contractCode: string
  contractTitle: string
  endDate: string
  daysRemaining: number
}): { subject: string; html: string } {
  const base = getAppEmailBaseUrl()
  const content = `
    <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 8px;">
      Contrato próximo do vencimento
    </h2>
    <p style="color:#6c757d;font-size:15px;margin:0 0 32px;">
      Olá, ${data.buyerName}! O contrato abaixo vence em
      <strong>${data.daysRemaining} dia(s)</strong>.
      Renove ou tome as providências necessárias.
    </p>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;
                padding:16px;margin-bottom:24px;text-align:center;">
      <span style="font-size:32px;">⚠️</span>
      <p style="color:#92400e;font-weight:600;margin:8px 0 0;font-size:16px;">
        Vence em ${data.daysRemaining} dia(s) — ${data.endDate}
      </p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr><td>
        <table width="100%">
          ${emailInfoRow("Fornecedor", data.supplierName)}
          ${emailInfoRow("Contrato", data.contractCode)}
          ${emailInfoRow("Título", data.contractTitle)}
          ${emailInfoRow("Vencimento", data.endDate)}
        </table>
      </td></tr>
    </table>
    ${emailButton("Ver Contrato", `${base}/comprador/contratos`)}
  `
  return {
    subject: `⚠️ Contrato vence em ${data.daysRemaining} dia(s) — ${data.contractCode}`,
    html: emailBase(content, "Contrato próximo do vencimento"),
  }
}

export function templateContractExpired(data: {
  buyerName: string
  supplierName: string
  contractCode: string
  contractTitle: string
  endDate: string
}): { subject: string; html: string } {
  const base = getAppEmailBaseUrl()
  const content = `
    <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 8px;">
      Contrato vencido
    </h2>
    <p style="color:#6c757d;font-size:15px;margin:0 0 32px;">
      Olá, ${data.buyerName}! O contrato abaixo atingiu a data de vencimento
      (<strong>${data.endDate}</strong>) e foi marcado como expirado.
      Renove ou tome as providências necessárias.
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;
                padding:16px;margin-bottom:24px;text-align:center;">
      <span style="font-size:32px;">⏱️</span>
      <p style="color:#991b1b;font-weight:600;margin:8px 0 0;font-size:16px;">
        Vencido em ${data.endDate}
      </p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr><td>
        <table width="100%">
          ${emailInfoRow("Fornecedor", data.supplierName)}
          ${emailInfoRow("Contrato", data.contractCode)}
          ${emailInfoRow("Título", data.contractTitle)}
          ${emailInfoRow("Vencimento", data.endDate)}
        </table>
      </td></tr>
    </table>
    ${emailButton("Ver Contrato", `${base}/comprador/contratos`)}
  `
  return {
    subject: `Contrato vencido — ${data.contractCode}`,
    html: emailBase(content, "Contrato vencido"),
  }
}

export function templateContractLowBalance(data: {
  buyerName: string
  supplierName: string
  contractCode: string
  contractTitle: string
  availableBalance: string
  remainingPercent: number
  thresholdPercent: number
}): { subject: string; html: string } {
  const base = getAppEmailBaseUrl()
  const content = `
    <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 8px;">
      Saldo baixo no contrato
    </h2>
    <p style="color:#6c757d;font-size:15px;margin:0 0 32px;">
      Olá, ${data.buyerName}! O contrato abaixo está com saldo disponível
      abaixo do limite configurado (${data.thresholdPercent}%).
    </p>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;
                padding:16px;margin-bottom:24px;text-align:center;">
      <span style="font-size:32px;">📉</span>
      <p style="color:#92400e;font-weight:600;margin:8px 0 0;font-size:16px;">
        ${data.availableBalance} disponível (${data.remainingPercent}% restante)
      </p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr><td>
        <table width="100%">
          ${emailInfoRow("Fornecedor", data.supplierName)}
          ${emailInfoRow("Contrato", data.contractCode)}
          ${emailInfoRow("Título", data.contractTitle)}
          ${emailInfoRow("Saldo disponível", data.availableBalance)}
        </table>
      </td></tr>
    </table>
    ${emailButton("Ver Contrato", `${base}/comprador/contratos`)}
  `
  return {
    subject: `Saldo baixo — ${data.contractCode}`,
    html: emailBase(content, "Saldo baixo no contrato"),
  }
}

export function templateIntegrationError(data: {
  adminName: string
  entityLabel: string
  code: string
  message: string
  detailUrl: string
  monitorUrl: string
}): { subject: string; html: string } {
  const content = `
    <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 8px;">
      Erro de integração ERP
    </h2>
    <p style="color:#6c757d;font-size:15px;margin:0 0 32px;">
      Olá, ${data.adminName}! A integração com o ERP falhou e requer atenção da equipe técnica.
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;
                padding:16px;margin-bottom:24px;">
      <p style="color:#991b1b;font-weight:600;margin:0;font-size:15px;">
        ${data.entityLabel} ${data.code}
      </p>
      <p style="color:#7f1d1d;font-size:13px;margin:8px 0 0;word-break:break-word;">
        ${data.message}
      </p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr><td>
        <table width="100%">
          ${emailInfoRow(data.entityLabel, data.code)}
          ${emailInfoRow("Ação sugerida", "Reenviar pelo Monitor de Integrações")}
        </table>
      </td></tr>
    </table>
    ${emailButton("Abrir Monitor", data.monitorUrl)}
    <p style="color:#9ca3af;font-size:13px;margin:16px 0 0;">
      <a href="${data.detailUrl}" style="color:#4F3EF5;">Ver ${data.entityLabel.toLowerCase()}</a>
    </p>
  `
  return {
    subject: `[Valore] Erro de integração — ${data.code}`,
    html: emailBase(content, "Erro de integração ERP"),
  }
}

export function templateSupplierPortalInvite(data: {
  supplierName: string
  buyerCompanyName: string
  inviteUrl: string
  expiresAtLabel: string
}): { subject: string; html: string } {
  const content = `
    <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 8px;">
      Convite para o Portal do Fornecedor
    </h2>
    <p style="color:#6c757d;font-size:15px;margin:0 0 32px;">
      Olá! <strong>${data.buyerCompanyName}</strong> convidou
      <strong>${data.supplierName}</strong> a acessar o portal Valore.
    </p>
    <p style="color:#6c757d;font-size:15px;margin:0 0 24px;">
      Conclua seu cadastro para responder cotações, aceitar pedidos e
      acompanhar contratos. Você precisará confirmar o CNPJ cadastrado
      no portal do comprador.
    </p>
    ${emailButton("Concluir cadastro", data.inviteUrl)}
    <p style="color:#9ca3af;font-size:13px;margin:24px 0 0;">
      Este convite expira em ${data.expiresAtLabel}.
    </p>
  `
  return {
    subject: `Convite — Portal do Fornecedor Valore`,
    html: emailBase(content, "Convite Portal do Fornecedor"),
  }
}

export function templatePasswordReset(data: {
  resetUrl: string
  portalLabel: string
}): { subject: string; html: string } {
  const content = `
    <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 8px;">
      Redefinição de senha
    </h2>
    <p style="color:#6c757d;font-size:15px;margin:0 0 24px;">
      Recebemos um pedido para redefinir a senha de acesso ao
      <strong>${data.portalLabel}</strong> Valore.
    </p>
    <p style="color:#6c757d;font-size:15px;margin:0 0 32px;">
      Clique no botão abaixo. Na próxima tela, confirme para criar uma nova senha.
      O link é válido por tempo limitado.
    </p>
    ${emailButton("Continuar redefinição", data.resetUrl)}
    <p style="color:#9ca3af;font-size:13px;margin:24px 0 0;">
      Se você não solicitou esta alteração, ignore este e-mail. Sua senha permanecerá a mesma.
    </p>
  `
  return {
    subject: "Redefinição de senha — Valore",
    html: emailBase(content, "Redefinição de senha"),
  }
}

// ─── CATÁLOGO DE COMPRAS ───────────────────────────────────

export function templateCatalogOrderCreated(data: {
  recipientName: string
  title: string
  orderCodes: string
  requisitionCodes: string
  linkPath: string
  portalLabel: string
}): { subject: string; html: string } {
  const base = getAppEmailBaseUrl()
  const content = `
      <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 8px;">
        Pedido do catálogo criado
      </h2>
      <p style="color:#6c757d;font-size:15px;margin:0 0 32px;">
        Olá, ${data.recipientName}! Um pedido foi gerado a partir do Catálogo de Compras.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;">
        <tr><td>
          <table width="100%">
            ${emailInfoRow("Título", data.title)}
            ${emailInfoRow("Pedido(s)", data.orderCodes)}
            ${emailInfoRow("Requisição(ões)", data.requisitionCodes)}
          </table>
        </td></tr>
      </table>
      ${emailButton(data.portalLabel, `${base}${data.linkPath}`)}
    `
  return {
    subject: `Catálogo — ${data.orderCodes}`,
    html: emailBase(content, "Pedido do catálogo"),
  }
}
