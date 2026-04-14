import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { notFound } from "next/navigation"
import { FileText } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function TermosPage({
  params,
}: {
  params: Promise<{ company_id: string }>
}) {
  const { company_id } = await params

  const service = createServiceRoleClient()

  const [termRes, companyRes] = await Promise.all([
    service
      .from("supplier_terms")
      .select("title, content, version, version_date")
      .eq("company_id", company_id)
      .eq("active", true)
      .maybeSingle(),
    service.from("companies").select("name, trade_name").eq("id", company_id).single(),
  ])

  if (!termRes.data) notFound()

  const term = termRes.data
  const company = companyRes.data
  const companyName = company?.trade_name || company?.name || "Empresa"

  const versionDate = new Date(term.version_date).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{companyName}</p>
              <h1 className="text-xl font-bold text-gray-900">{term.title}</h1>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 font-medium text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Versão {term.version}
            </span>
            <span>Vigente desde {versionDate}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="prose prose-gray max-w-none">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {term.content}
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Documento gerado pelo sistema Valore · {companyName}
        </p>
      </div>
    </div>
  )
}
