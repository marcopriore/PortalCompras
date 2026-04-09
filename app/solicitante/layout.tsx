import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Portal do Solicitante — Valore",
}

export default function SolicitanteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="min-h-screen bg-background">{children}</div>
}
