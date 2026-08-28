import { NextResponse } from "next/server"
import { createTicket, listTickets } from "@/lib/axisdesk/client"
import { getSupportContext } from "@/lib/axisdesk/support-context"
import {
  AXISDESK_MAX_TEXTO,
  AXISDESK_MAX_TITULO,
} from "@/lib/axisdesk/support-form"
import type {
  AxisDeskChamadoPrioridade,
  AxisDeskChamadoTipo,
  AxisDeskAnexo,
} from "@/lib/axisdesk/types"

const VALID_TIPOS = new Set<AxisDeskChamadoTipo>(["incidente", "melhoria"])
const VALID_PRIORIDADES = new Set<AxisDeskChamadoPrioridade>([
  "baixa",
  "media",
  "alta",
  "critica",
])

function isValidAnexo(value: unknown): value is AxisDeskAnexo {
  if (!value || typeof value !== "object") return false
  const a = value as Record<string, unknown>
  return (
    typeof a.nome_arquivo === "string" &&
    a.nome_arquivo.trim().length > 0 &&
    typeof a.tipo_mime === "string" &&
    a.tipo_mime.trim().length > 0 &&
    typeof a.conteudo_base64 === "string" &&
    a.conteudo_base64.length > 0
  )
}

export async function GET() {
  try {
    const ctx = await getSupportContext()
    if ("error" in ctx) return ctx.error

    const result = await listTickets(ctx.tenantIdExterno)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.message },
        { status: result.status },
      )
    }

    return NextResponse.json({ data: result.data })
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSupportContext()
    if ("error" in ctx) return ctx.error

    const body = (await request.json()) as Record<string, unknown>

    const tipo = body.tipo
    const titulo = typeof body.titulo === "string" ? body.titulo.trim() : ""
    const descricao =
      typeof body.descricao === "string" ? body.descricao.trim() : ""
    const contextoOrigem =
      typeof body.contexto_origem === "string"
        ? body.contexto_origem.trim()
        : undefined
    const prioridade = body.prioridade
    const categoriaId =
      typeof body.categoria_id === "string" ? body.categoria_id.trim() : ""
    const subcategoriaId =
      typeof body.subcategoria_id === "string" ? body.subcategoria_id.trim() : ""

    if (!VALID_TIPOS.has(tipo as AxisDeskChamadoTipo)) {
      return NextResponse.json({ error: "Tipo inválido." }, { status: 400 })
    }
    if (!titulo) {
      return NextResponse.json({ error: "Título é obrigatório." }, { status: 400 })
    }
    if (titulo.length > AXISDESK_MAX_TITULO) {
      return NextResponse.json(
        { error: `Título deve ter no máximo ${AXISDESK_MAX_TITULO} caracteres.` },
        { status: 400 },
      )
    }
    if (!descricao) {
      return NextResponse.json(
        { error: "Descrição é obrigatória." },
        { status: 400 },
      )
    }
    if (descricao.length > AXISDESK_MAX_TEXTO) {
      return NextResponse.json(
        { error: `Descrição deve ter no máximo ${AXISDESK_MAX_TEXTO} caracteres.` },
        { status: 400 },
      )
    }
    if (!categoriaId) {
      return NextResponse.json(
        { error: "Categoria é obrigatória." },
        { status: 400 },
      )
    }
    if (!subcategoriaId) {
      return NextResponse.json(
        { error: "Subcategoria é obrigatória." },
        { status: 400 },
      )
    }

    let prioridadeValue: AxisDeskChamadoPrioridade | undefined
    if (prioridade !== undefined && prioridade !== null && prioridade !== "") {
      if (!VALID_PRIORIDADES.has(prioridade as AxisDeskChamadoPrioridade)) {
        return NextResponse.json(
          { error: "Prioridade inválida." },
          { status: 400 },
        )
      }
      prioridadeValue = prioridade as AxisDeskChamadoPrioridade
    }

    let anexos: AxisDeskAnexo[] | undefined
    if (Array.isArray(body.anexos)) {
      const parsed = body.anexos.filter(isValidAnexo)
      if (parsed.length > 0) anexos = parsed
    }

    const result = await createTicket({
      tenant_id_externo: ctx.tenantIdExterno,
      nome_empresa: ctx.nomeEmpresa,
      solicitante: {
        id_externo: ctx.solicitante.idExterno,
        nome: ctx.solicitante.nome,
        email: ctx.solicitante.email,
      },
      tipo: tipo as AxisDeskChamadoTipo,
      titulo,
      descricao,
      categoria_id: categoriaId,
      subcategoria_id: subcategoriaId,
      ...(contextoOrigem ? { contexto_origem: contextoOrigem } : {}),
      ...(prioridadeValue ? { prioridade: prioridadeValue } : {}),
      ...(anexos ? { anexos } : {}),
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message },
        { status: result.status },
      )
    }

    return NextResponse.json({ data: result.data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 })
  }
}
