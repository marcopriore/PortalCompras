"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"
import { FileText } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CONTRACT_TYPES } from "@/types/contracts"

type PublicContract = {
  id: string
  title: string
  code: string
  type: string
  status: string
  start_date: string
  end_date: string
  contract_terms: string | null
  supplier_name: string
}

export default function ContratoTermosPublicPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = React.use(params)
  const [contract, setContract] = React.useState<PublicContract | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setNotFound(false)
      setContract(null)
      try {
        const res = await fetch(
          `/api/contracts-public-terms?id=${encodeURIComponent(id)}`,
        )
        const data = (await res.json()) as {
          contract?: PublicContract
          error?: string
        }
        if (!res.ok || !data.contract) {
          if (!cancelled) {
            setContract(null)
            setNotFound(res.status === 404 || !data.contract)
          }
          return
        }
        if (!cancelled) setContract(data.contract)
      } catch {
        if (!cancelled) {
          setContract(null)
          setNotFound(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading && !contract) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-8">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Termos Contratuais</h1>
              <p className="text-muted-foreground text-sm">Carregando…</p>
            </div>
          </div>
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!loading && (notFound || !contract)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="text-muted-foreground text-center text-sm">
          Contrato não encontrado.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Termos Contratuais</h1>
            <p className="text-muted-foreground text-sm">
              {contract?.title} · {contract?.code}
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Fornecedor</p>
                <p className="font-medium">{contract?.supplier_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Vigência</p>
                <p className="font-medium">
                  {contract?.start_date && contract?.end_date
                    ? `${format(parseISO(contract.start_date), "dd/MM/yyyy")} – ${format(parseISO(contract.end_date), "dd/MM/yyyy")}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Tipo</p>
                <p className="font-medium">
                  {CONTRACT_TYPES.find((t) => t.value === contract?.type)?.label ??
                    "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium">{contract?.status ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {contract?.contract_terms ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Termos e Condições</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {contract.contract_terms}
              </p>
            </CardContent>
          </Card>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            Este contrato não possui termos contratuais cadastrados.
          </p>
        )}

        <p className="text-xs text-muted-foreground text-center mt-8">
          Documento gerado por Valore · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
