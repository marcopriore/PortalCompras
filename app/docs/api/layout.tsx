import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Valore API — Documentação v1",
  description:
    "Documentação pública da Loja de API Valore para integração com ERPs.",
}

export default function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  return children
}
