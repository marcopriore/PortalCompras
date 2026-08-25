"use client"

import * as React from "react"
import Link from "next/link"
import { BookOpen, ChevronRight, Copy, ExternalLink } from "lucide-react"
import { ValoreLogo } from "@/components/ui/valore-logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  API_DOC_ENDPOINTS,
  API_DOC_GROUPS,
  API_ERROR_CODES,
  API_V1_BASE,
  type ApiDocEndpoint,
} from "@/lib/api/openapi/v1-catalog"
import { toast } from "sonner"

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-100 text-blue-800",
  POST: "bg-green-100 text-green-800",
  PUT: "bg-amber-100 text-amber-800",
  DELETE: "bg-red-100 text-red-800",
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const copy = () => {
    void navigator.clipboard.writeText(code)
    toast.success("Copiado!")
  }

  return (
    <div className="relative rounded-lg border border-white/10 bg-black/40">
      {label && (
        <div className="border-b border-white/10 px-3 py-1.5 text-xs text-white/50">{label}</div>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-7 w-7 text-white/50 hover:text-white"
        onClick={copy}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <pre className="overflow-x-auto p-4 pr-12 text-xs leading-relaxed text-emerald-100/90">
        {code}
      </pre>
    </div>
  )
}

function FieldsTable({ fields, title }: { fields: ApiDocEndpoint["bodyFields"]; title: string }) {
  if (!fields?.length) return null
  return (
    <div className="mt-4">
      <h4 className="mb-2 text-sm font-semibold text-white">{title}</h4>
      <div className="overflow-hidden rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs text-white/60">
            <tr>
              <th className="px-3 py-2">Campo</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.name} className="border-t border-white/5">
                <td className="px-3 py-2 font-mono text-xs text-cyan-300">
                  {f.name}
                  {f.required && <span className="ml-1 text-red-400">*</span>}
                </td>
                <td className="px-3 py-2 text-white/70">{f.type}</td>
                <td className="px-3 py-2 text-white/60">{f.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EndpointSection({ endpoint }: { endpoint: ApiDocEndpoint }) {
  return (
    <section id={endpoint.id} className="scroll-mt-6 border-b border-white/10 pb-10">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge className={cn("font-mono", METHOD_COLORS[endpoint.method])}>
          {endpoint.method}
        </Badge>
        <code className="text-sm text-white/90">
          {API_V1_BASE}
          {endpoint.path}
        </code>
      </div>
      <h3 className="text-xl font-semibold text-white">{endpoint.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/60">{endpoint.description}</p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {endpoint.scope && (
          <Badge variant="outline" className="border-white/20 text-white/70">
            escopo: {endpoint.scope}
          </Badge>
        )}
        {endpoint.tenantFeature && (
          <Badge variant="outline" className="border-white/20 text-white/70">
            módulo: {endpoint.tenantFeature}
          </Badge>
        )}
      </div>

      {endpoint.queryParams && endpoint.queryParams.length > 0 && (
        <FieldsTable fields={endpoint.queryParams} title="Query parameters" />
      )}
      {endpoint.pathParams && endpoint.pathParams.length > 0 && (
        <FieldsTable fields={endpoint.pathParams} title="Path parameters" />
      )}
      {endpoint.bodyFields && endpoint.bodyFields.length > 0 && (
        <FieldsTable fields={endpoint.bodyFields} title="Body (JSON)" />
      )}

      {endpoint.requestExample && (
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-semibold text-white">Exemplo de request</h4>
          <CodeBlock code={endpoint.requestExample} />
        </div>
      )}

      {endpoint.responseExample && (
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-semibold text-white">Exemplo de response</h4>
          <CodeBlock code={endpoint.responseExample} label="200 OK" />
        </div>
      )}
    </section>
  )
}

function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: "smooth", block: "start" })
}

export default function ApiDocsPage() {
  const [activeGroup, setActiveGroup] = React.useState<string>(API_DOC_GROUPS[0] ?? "Geral")

  const grouped = React.useMemo(() => {
    const map = new Map<string, ApiDocEndpoint[]>()
    for (const ep of API_DOC_ENDPOINTS) {
      const list = map.get(ep.group) ?? []
      list.push(ep)
      map.set(ep.group, list)
    }
    return map
  }, [])

  React.useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "")
    if (!hash) return
    const t = window.setTimeout(() => scrollToSection(hash), 50)
    return () => window.clearTimeout(t)
  }, [])

  const onNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    window.history.replaceState(null, "", `#${id}`)
    scrollToSection(id)
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#0a0a12] text-white">
      <header className="z-20 shrink-0 border-b border-white/10 bg-[#0a0a12]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <ValoreLogo size={28} showName nameColor="#ffffff" instance="api-docs" />
            </Link>
            <Badge className="bg-primary/20 text-primary border-primary/30">API v1</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild className="border-white/20 text-white">
              <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                OpenAPI JSON
              </a>
            </Button>
            <Button size="sm" asChild>
              <Link href="/login">Entrar no portal</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 lg:flex">
          <nav
            className={cn(
              "flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-6 text-sm",
              "[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.25)_transparent]",
              "[&::-webkit-scrollbar]:w-1.5",
              "[&::-webkit-scrollbar-track]:bg-transparent",
              "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20",
            )}
          >
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                Introdução
              </p>
              <a
                href="#auth"
                onClick={(e) => onNavClick(e, "auth")}
                className="block py-1 text-white/70 hover:text-white"
              >
                Autenticação
              </a>
              <a
                href="#outbound-idempotency"
                onClick={(e) => onNavClick(e, "outbound-idempotency")}
                className="block py-1 text-white/70 hover:text-white"
              >
                Outbound Idempotency-Key
              </a>
              <a
                href="#errors"
                onClick={(e) => onNavClick(e, "errors")}
                className="block py-1 text-white/70 hover:text-white"
              >
                Códigos de erro
              </a>
            </div>
            {API_DOC_GROUPS.map((group) => (
              <div key={group}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                  {group}
                </p>
                {(grouped.get(group) ?? []).map((ep) => (
                  <a
                    key={ep.id}
                    href={`#${ep.id}`}
                    onClick={(e) => onNavClick(e, ep.id)}
                    className="flex items-center gap-1 py-1 text-white/60 hover:text-white"
                  >
                    <ChevronRight className="h-3 w-3 shrink-0" />
                    <span className="truncate">{ep.title}</span>
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 space-y-12 overflow-y-auto overscroll-contain px-4 py-8 sm:px-6">
          <div>
            <div className="mb-4 flex items-center gap-2 text-primary">
              <BookOpen className="h-5 w-5" />
              <span className="text-sm font-medium">Documentação pública</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Valore — Loja de API
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/60">
              Referência para integração ERP ↔ Valore. Todas as rotas usam o prefixo{" "}
              <code className="text-cyan-300">{API_V1_BASE}</code> e exigem API key do tenant
              (feature <code className="text-cyan-300">api_integrations</code>).
            </p>
          </div>

          <section id="auth" className="scroll-mt-6 rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Autenticação</h2>
            <p className="mt-2 text-sm text-white/60">
              Envie a chave em um dos formatos abaixo. A chave é exibida apenas uma vez na criação.
            </p>
            <div className="mt-4 space-y-3">
              <CodeBlock
                code={`Authorization: Bearer valore_sua_chave_aqui`}
                label="Header Bearer (recomendado)"
              />
              <CodeBlock code={`X-Api-Key: valore_sua_chave_aqui`} label="Header alternativo" />
            </div>
            <p className="mt-4 text-sm text-white/50">
              Respostas de sucesso: <code className="text-white/70">{`{ "data": { ... } }`}</code>
              <br />
              Erros: <code className="text-white/70">{`{ "error": "...", "code": "FORBIDDEN" }`}</code>
            </p>
          </section>

          <section id="outbound-idempotency" className="scroll-mt-6 rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Outbound Valore → ERP (Idempotency-Key)</h2>
            <p className="mt-2 text-sm text-white/60">
              Chamadas do Valore ao ERP (pedidos e contratos) enviam o header{" "}
              <code className="text-cyan-300">Idempotency-Key</code>. A chave é estável por
              tenant + ação + entidade (SHA-256). Reenvios do monitor reutilizam a mesma chave
              para o ERP deduplicar (ex.: pedido já criado no SAP).
            </p>
            <div className="mt-4 space-y-3">
              <CodeBlock
                code={`Idempotency-Key: <sha256(company_id:action:entity_id)>`}
                label="Header enviado pelo Valore"
              />
              <CodeBlock
                code={`{
  "action": "purchase_order.create",
  "entity": "purchase_orders",
  "entity_id": "uuid",
  "entity_code": "PO-2026-0001",
  "data": { "...": "payload do pedido" }
}`}
                label="Corpo JSON típico"
              />
            </div>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-white/50">
              <li>Cada tentativa incrementa o contador <code className="text-white/70">attempts</code> no log.</li>
              <li>Despachos concorrentes para a mesma entidade são bloqueados (HTTP 409 no Valore).</li>
              <li>O ERP deve tratar a mesma chave como a mesma operação de negócio.</li>
            </ul>
          </section>

          <section id="errors" className="scroll-mt-6">
            <h2 className="text-lg font-semibold">Códigos de erro</h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-left text-xs text-white/60">
                  <tr>
                    <th className="px-4 py-2">Code</th>
                    <th className="px-4 py-2">HTTP</th>
                    <th className="px-4 py-2">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {API_ERROR_CODES.map((row) => (
                    <tr key={row.code} className="border-t border-white/5">
                      <td className="px-4 py-2 font-mono text-xs text-amber-300">{row.code}</td>
                      <td className="px-4 py-2 text-white/70">{row.http}</td>
                      <td className="px-4 py-2 text-white/60">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-wrap gap-2 lg:hidden">
            {API_DOC_GROUPS.map((g) => (
              <Button
                key={g}
                size="sm"
                variant={activeGroup === g ? "default" : "outline"}
                className={activeGroup !== g ? "border-white/20 text-white" : ""}
                onClick={() => setActiveGroup(g)}
              >
                {g}
              </Button>
            ))}
          </div>

          {API_DOC_GROUPS.map((group) => (
            <div
              key={group}
              className={cn(
                "space-y-8",
                "lg:block",
                activeGroup === group ? "block" : "hidden lg:block",
              )}
            >
              <h2 className="text-2xl font-bold text-white">{group}</h2>
              {(grouped.get(group) ?? []).map((ep) => (
                <EndpointSection key={ep.id} endpoint={ep} />
              ))}
            </div>
          ))}

          <footer className="border-t border-white/10 pt-8 text-center text-xs text-white/40">
            <p>
              Especificação OpenAPI:{" "}
              <a href="/api/v1/openapi.json" className="text-primary hover:underline">
                /api/v1/openapi.json
              </a>
            </p>
            <p className="mt-1">© 2026 Valore · Documentação v1 (em evolução)</p>
          </footer>
        </main>
      </div>
    </div>
  )
}
