import { NextResponse } from "next/server"
import { createElement } from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { requireNegotiationApiContext } from "@/lib/negotiation/require-api-context"
import { loadNegotiationReportData } from "@/lib/negotiation/report-data"
import {
  buildNegotiationReportExcelBuffer,
  negotiationReportFileBaseName,
} from "@/lib/excel/negotiation-report-export"
import { NegotiationReportPDF } from "@/lib/pdf/negotiation-report-pdf"

export const runtime = "nodejs"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RouteParams) {
  const ctx = await requireNegotiationApiContext()
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }

  const { id: runId } = await params
  const { searchParams } = new URL(request.url)
  const format = (searchParams.get("format") ?? "xlsx").toLowerCase()

  if (format !== "xlsx" && format !== "pdf") {
    return NextResponse.json({ error: "Formato inválido. Use xlsx ou pdf." }, { status: 400 })
  }

  const service = createServiceRoleClient()
  const data = await loadNegotiationReportData(service, ctx.companyId, runId)

  if (!data) {
    return NextResponse.json({ error: "Execução não encontrada." }, { status: 404 })
  }

  const terminal = new Set(["completed", "cancelled", "failed"])
  if (!terminal.has(data.run.status)) {
    return NextResponse.json(
      { error: "Relatório disponível apenas para eventos encerrados." },
      { status: 409 },
    )
  }

  const baseName = negotiationReportFileBaseName(data.quotation.code)

  if (format === "pdf") {
    const pdfBuffer = await renderToBuffer(
      createElement(NegotiationReportPDF, { data }) as Parameters<typeof renderToBuffer>[0],
    )
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
      },
    })
  }

  const xlsxBuffer = await buildNegotiationReportExcelBuffer(data)
  return new NextResponse(new Uint8Array(xlsxBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
    },
  })
}
