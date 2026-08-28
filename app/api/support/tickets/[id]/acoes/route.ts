import { NextResponse } from "next/server"
import { executeAction } from "@/lib/axisdesk/client"
import { getSupportContext } from "@/lib/axisdesk/support-context"
import { AXISDESK_MAX_TEXTO } from "@/lib/axisdesk/support-form"
import type { AxisDeskAnexo, AxisDeskChamadoAcao } from "@/lib/axisdesk/types"

const VALID_ACOES = new Set<AxisDeskChamadoAcao>([
  "usuario_respondeu",
  "usuario_aprovou",
  "usuario_reprovou",
  "usuario_cancelou",
  "usuario_reenviou",
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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 })
    }

    const ctx = await getSupportContext()
    if ("error" in ctx) return ctx.error

    const body = (await request.json()) as Record<string, unknown>
    const acao = body.acao
    const mensagem =
      typeof body.mensagem === "string" ? body.mensagem.trim() : undefined

    if (!VALID_ACOES.has(acao as AxisDeskChamadoAcao)) {
      return NextResponse.json({ error: "Ação inválida." }, { status: 400 })
    }

    if (acao === "usuario_reprovou" && !mensagem) {
      return NextResponse.json(
        { error: "Motivo é obrigatório para reprovar." },
        { status: 400 },
      )
    }

    if (mensagem && mensagem.length > AXISDESK_MAX_TEXTO) {
      return NextResponse.json(
        { error: `Mensagem deve ter no máximo ${AXISDESK_MAX_TEXTO} caracteres.` },
        { status: 400 },
      )
    }

    let anexos: AxisDeskAnexo[] | undefined
    if (Array.isArray(body.anexos)) {
      const parsed = body.anexos.filter(isValidAnexo)
      if (parsed.length > 0) anexos = parsed
    }

    const result = await executeAction(
      id,
      acao as AxisDeskChamadoAcao,
      mensagem,
      anexos,
    )

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
