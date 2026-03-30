"use client"

import * as React from "react"

export default function FornecedorCotacaoPropostaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = React.use(params)

  return (
    <div className="space-y-2" data-quotation-id={id}>
      <h1 className="text-2xl font-bold tracking-tight">Responder Proposta</h1>
    </div>
  )
}
