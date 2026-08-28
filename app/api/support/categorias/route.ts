import { NextResponse } from "next/server"
import { getCategorias } from "@/lib/axisdesk/client"
import { getSupportContext } from "@/lib/axisdesk/support-context"
import type { AxisDeskChamadoTipo } from "@/lib/axisdesk/types"

const VALID_TIPOS = new Set<AxisDeskChamadoTipo>(["incidente", "melhoria"])

export async function GET(request: Request) {
  try {
    const ctx = await getSupportContext()
    if ("error" in ctx) return ctx.error

    const { searchParams } = new URL(request.url)
    const tipoParam = searchParams.get("tipo")
    let tipo: AxisDeskChamadoTipo | undefined

    if (tipoParam) {
      if (!VALID_TIPOS.has(tipoParam as AxisDeskChamadoTipo)) {
        return NextResponse.json({ error: "Tipo inválido." }, { status: 400 })
      }
      tipo = tipoParam as AxisDeskChamadoTipo
    }

    const result = await getCategorias(ctx.tenantIdExterno, tipo)
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
