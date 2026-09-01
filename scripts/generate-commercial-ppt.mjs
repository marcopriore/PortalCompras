/**
 * Gera apresentação comercial PPTX a partir dos prints em docs/apresentacao-comercial/screenshots
 *
 *   npm install --save-dev pptxgenjs
 *   node scripts/generate-commercial-ppt.mjs
 */
import { access, readdir } from "node:fs/promises"
import path from "node:path"
import PptxGenJS from "pptxgenjs"

const ROOT = path.resolve("docs/apresentacao-comercial")
const SHOTS = path.join(ROOT, "screenshots")
const OUT = path.join(ROOT, "Valore-Portal-Compras-Apresentacao-Comercial.pptx")

const BRAND = {
  primary: "4F3EF5",
  accent: "00C2FF",
  dark: "1A1A2E",
  text: "1F2937",
  muted: "6B7280",
  white: "FFFFFF",
  lavender: "F4F3FF",
}

async function shotExists(name) {
  try {
    await access(path.join(SHOTS, name))
    return true
  } catch {
    return false
  }
}

function addTitleSlide(pptx) {
  const slide = pptx.addSlide()
  slide.background = { color: BRAND.dark }
  slide.addText("Valore", {
    x: 0.6,
    y: 1.4,
    w: 12,
    fontSize: 54,
    bold: true,
    color: BRAND.white,
    fontFace: "Segoe UI",
  })
  slide.addText("Portal de Compras", {
    x: 0.6,
    y: 2.2,
    w: 12,
    fontSize: 28,
    color: BRAND.accent,
    fontFace: "Segoe UI",
  })
  slide.addText(
    "Plataforma SaaS de procurement multi-tenant\nComprador · Solicitante · Fornecedor · Admin",
    {
      x: 0.6,
      y: 3.2,
      w: 11,
      fontSize: 16,
      color: "E5E7EB",
      fontFace: "Segoe UI",
    },
  )
  slide.addText("Apresentação comercial · Tenant demo: Apresentação POC", {
    x: 0.6,
    y: 6.6,
    w: 12,
    fontSize: 11,
    color: "9CA3AF",
    fontFace: "Segoe UI",
  })
}

function addSectionSlide(pptx, title, subtitle, bullets) {
  const slide = pptx.addSlide()
  slide.background = { color: BRAND.lavender }
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.12,
    fill: { color: BRAND.primary },
    line: { color: BRAND.primary },
  })
  slide.addText(title, {
    x: 0.6,
    y: 0.5,
    w: 12,
    fontSize: 30,
    bold: true,
    color: BRAND.dark,
    fontFace: "Segoe UI",
  })
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.6,
      y: 1.1,
      w: 12,
      fontSize: 14,
      color: BRAND.muted,
      fontFace: "Segoe UI",
    })
  }
  slide.addText(
    bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
    {
      x: 0.8,
      y: 1.8,
      w: 11.8,
      h: 4.8,
      fontSize: 16,
      color: BRAND.text,
      fontFace: "Segoe UI",
      valign: "top",
    },
  )
}

async function addScreenshotSlide(pptx, title, caption, imageFile, benefits = []) {
  const slide = pptx.addSlide()
  slide.background = { color: BRAND.white }
  slide.addText(title, {
    x: 0.5,
    y: 0.25,
    w: 12.3,
    fontSize: 22,
    bold: true,
    color: BRAND.dark,
    fontFace: "Segoe UI",
  })
  if (caption) {
    slide.addText(caption, {
      x: 0.5,
      y: 0.75,
      w: 12.3,
      fontSize: 11,
      color: BRAND.muted,
      fontFace: "Segoe UI",
    })
  }

  const hasImage = imageFile && (await shotExists(imageFile))
  if (hasImage) {
    slide.addImage({
      path: path.join(SHOTS, imageFile),
      x: 0.45,
      y: 1.15,
      w: benefits.length ? 8.6 : 12.4,
      h: 5.9,
      sizing: { type: "contain", w: benefits.length ? 8.6 : 12.4, h: 5.9 },
    })
  } else {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.45,
      y: 1.15,
      w: 12.4,
      h: 5.9,
      fill: { color: "F3F4F6" },
      line: { color: "D1D5DB", width: 1 },
    })
    slide.addText("(Print não capturado — execute capture-commercial-screenshots.mjs)", {
      x: 0.6,
      y: 3.8,
      w: 12,
      fontSize: 12,
      color: BRAND.muted,
      fontFace: "Segoe UI",
    })
  }

  if (benefits.length) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 9.25,
      y: 1.15,
      w: 3.6,
      h: 5.9,
      fill: { color: BRAND.lavender },
      line: { color: "E0E7FF", width: 1 },
    })
    slide.addText("Benefícios", {
      x: 9.45,
      y: 1.35,
      w: 3.2,
      fontSize: 13,
      bold: true,
      color: BRAND.primary,
      fontFace: "Segoe UI",
    })
    slide.addText(
      benefits.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
      {
        x: 9.45,
        y: 1.75,
        w: 3.2,
        h: 5.1,
        fontSize: 11,
        color: BRAND.text,
        fontFace: "Segoe UI",
        valign: "top",
      },
    )
  }
}

async function main() {
  const pptx = new PptxGenJS()
  pptx.layout = "LAYOUT_16x9"
  pptx.author = "Valore / Axis Strategy"
  pptx.company = "Valore Portal de Compras"
  pptx.subject = "Apresentação comercial"
  pptx.title = "Valore Portal de Compras"

  addTitleSlide(pptx)

  addSectionSlide(pptx, "Agenda", "Visão completa para público misto (negócio + TI)", [
    "Contexto e desafios de compras B2B",
    "Visão da plataforma e portais",
    "Jornada Comprador → Solicitante → Fornecedor",
    "Diferenciais: Saving, IA, contratos, catálogo, integrações",
    "Governança, segurança multi-tenant e próximos passos",
  ])

  addSectionSlide(pptx, "Desafios do mercado", "Por que digitalizar o procurement?", [
    "Processos fragmentados (e-mail, planilhas, ERP desconectado)",
    "Baixa visibilidade de spend e saving em tempo real",
    "Ciclo comprador-fornecedor lento e pouco auditável",
    "Dificuldade de escalar governança em operações multi-unidade",
    "Integração com ERP ainda manual ou inconsistente",
  ])

  addSectionSlide(pptx, "Proposta de valor Valore", "Uma plataforma, três portais, um fluxo integrado", [
    "Centraliza requisição → aprovação → cotação → pedido → contrato",
    "Portal do fornecedor com propostas, pedidos e contratos",
    "Portal do solicitante para demanda interna estruturada",
    "Multi-tenant com RLS, auditoria e permissões granulares",
    "API Store e integrações ERP outbound/inbound",
  ])

  await addScreenshotSlide(
    pptx,
    "Landing & posicionamento",
    "Primeira impressão: marca Valore e proposta de valor",
    "01-landing.png",
    ["Imagem profissional para abertura comercial", "Comunica modernidade e foco em compras"],
  )

  await addScreenshotSlide(
    pptx,
    "Login unificado",
    "Comprador e solicitante no mesmo ponto de entrada",
    "02-login.png",
    ["Reduz fricção de adoção", "Separação clara de perfis"],
  )

  await addScreenshotSlide(
    pptx,
    "Dashboard do comprador",
    "Visão executiva: ROI, saving e indicadores",
    "10-comprador-dashboard.png",
    ["Decisão baseada em dados", "Widgets configuráveis por permissão", "Análise de spend por IA (quando habilitada)"],
  )

  await addScreenshotSlide(
    pptx,
    "Requisições",
    "Demanda interna estruturada com catálogo e anexos",
    "11-comprador-requisicoes.png",
    ["Rastreabilidade ponta a ponta", "Importação em massa via Excel", "Status integrado ao fluxo de compras"],
  )

  await addScreenshotSlide(
    pptx,
    "Aprovações",
    "Alçadas por centro de custo e categoria",
    "12-comprador-aprovacoes.png",
    ["Governança sem gargalo", "Fila alinhada ao status real da requisição", "Notificações in-app e e-mail"],
  )

  await addScreenshotSlide(
    pptx,
    "Cotações",
    "Convite de fornecedores, rodadas e prazos",
    "13-comprador-cotacoes.png",
    ["Processo competitivo transparente", "Importação de proposta Excel (wizard)", "Score de fornecedor na equalização"],
  )

  await addScreenshotSlide(
    pptx,
    "Equalização",
    "Comparativo com benchmark e saving",
    "13b-comprador-cotacao-detalhe.png",
    ["Benchmark vs alvo e vs histórico", "IA de negociação (feature)", "Vínculo automático a contrato quando aplicável"],
  )

  await addScreenshotSlide(
    pptx,
    "Pedidos de compra",
    "Do draft ao aceite do fornecedor e ERP",
    "14-comprador-pedidos.png",
    ["PDF do pedido", "Integração ERP no aceite", "Monitor de integrações"],
  )

  await addScreenshotSlide(
    pptx,
    "Contratos",
    "Gestão de saldo, aceite e consumo via pedido",
    "15-comprador-contratos.png",
    ["Contrato por valor ou quantidade", "Aceite digital do fornecedor", "Disponibilização opt-in no catálogo"],
  )

  await addScreenshotSlide(
    pptx,
    "Catálogo de compras",
    "Compra direta a partir de contratos disponibilizados",
    "16-comprador-catalogo.png",
    ["Checkout gera REQ + PO draft", "Carrinho persistente", "Filtro por contrato Valore/ERP"],
  )

  await addScreenshotSlide(
    pptx,
    "Itens & fornecedores",
    "Cadastro mestre, categorias e score",
    "18-comprador-fornecedores.png",
    ["Import/export Excel", "Categorias atendidas por fornecedor", "Sync ERP quando habilitado"],
  )

  await addScreenshotSlide(
    pptx,
    "Relatórios BI",
    "Saving, spend, pedidos e cotações",
    "19-comprador-relatorios.png",
    ["Exports Excel", "Filtros globais", "Permissões por seção de relatório"],
  )

  await addScreenshotSlide(
    pptx,
    "Portal do solicitante",
    "Autonomia controlada para áreas requisitantes",
    "23-solicitante-lista.png",
    ["Timeline e histórico", "Catálogo de compras (quando liberado)", "Cancelamento e resubmit"],
  )

  await addScreenshotSlide(
    pptx,
    "Portal do fornecedor",
    "Experiência dedicada ao parceiro comercial",
    "31-fornecedor-dashboard.png",
    ["Dashboard com métricas", "Resposta a cotações e pedidos", "Aceite de termos e contratos"],
  )

  await addScreenshotSlide(
    pptx,
    "Cotações & pedidos (fornecedor)",
    "Operação diária sem depender do comprador",
    "32-fornecedor-cotacoes.png",
    ["Wizard Excel de proposta", "Aceite/recusa de pedidos", "Atualização de data de entrega"],
  )

  await addScreenshotSlide(
    pptx,
    "Admin & multi-tenant",
    "Gestão central para operação SaaS",
    "40-admin-tenants.png",
    ["Tenants, features e configurações técnicas", "Fornecedores cross-tenant (CNPJ)", "API keys e monitor de integrações"],
  )

  await addScreenshotSlide(
    pptx,
    "Suporte integrado",
    "Chamados AxisDesk dentro do portal",
    "21-comprador-suporte.png",
    ["Abertura e acompanhamento sem sair do sistema", "Webhook e notificações in-app"],
  )

  addSectionSlide(pptx, "Benefícios mensuráveis", "O que o cliente ganha na prática", [
    "Redução de lead time do ciclo de compras",
    "Saving visível vs preço alvo e histórico",
    "Menos retrabalho entre comprador, solicitante e fornecedor",
    "Auditoria completa (login, proposta, pedido, contrato)",
    "Integração ERP com idempotência e reenvio controlado",
    "Escala multi-empresa com isolamento por tenant (RLS)",
  ])

  addSectionSlide(pptx, "Segurança & compliance", "Arquitetura enterprise-ready", [
    "Supabase PostgreSQL com RLS em todas as tabelas de negócio",
    "Permissões por feature e por ação (RBAC)",
    "2FA TOTP, política de senha por tenant",
    "Termos de fornecimento com aceite auditado (IP, versão)",
    "Logs de integração inbound/outbound",
  ])

  const closing = pptx.addSlide()
  closing.background = { color: BRAND.primary }
  closing.addText("Próximos passos", {
    x: 0.6,
    y: 1.2,
    w: 12,
    fontSize: 34,
    bold: true,
    color: BRAND.white,
    fontFace: "Segoe UI",
  })
  closing.addText(
    [
      "1. Workshop de discovery (processos atuais + ERP)",
      "2. Piloto com tenant dedicado e dados reais",
      "3. Go-live por módulos (REQ → COT → PO → contratos)",
      "4. Treinamento comprador, solicitante e fornecedores",
      "",
      "Contato: Axis Strategy · Valore Portal de Compras",
    ].join("\n"),
    {
      x: 0.6,
      y: 2.2,
      w: 12,
      fontSize: 18,
      color: BRAND.white,
      fontFace: "Segoe UI",
    },
  )

  await pptx.writeFile({ fileName: OUT })
  const files = await readdir(SHOTS).catch(() => [])
  console.log(`PPT gerado: ${OUT}`)
  console.log(`Prints disponíveis: ${files.filter((f) => f.endsWith(".png")).length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
