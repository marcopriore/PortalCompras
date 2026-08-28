"use client"

import * as React from "react"
import { SupportTicketDetail } from "@/components/support/support-ticket-detail"

export default function CompradorSuporteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = React.use(params)
  return <SupportTicketDetail ticketId={id} portal="comprador" />
}
