"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  BarChart2,
  ChevronDown,
  FilePen,
  FileText,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react"
import { ValoreLogo } from "@/components/ui/valore-logo"
import { cn } from "@/lib/utils"

const LANDING_STYLES = `
@keyframes valore-float-orb-1 {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(40px, -30px) scale(1.1); }
}
@keyframes valore-float-orb-2 {
  0% { transform: translate(0, 0) scale(1.1); }
  100% { transform: translate(-30px, 40px) scale(0.9); }
}
@keyframes valore-float-orb-3 {
  0% { transform: translate(0, 0) scale(0.9); }
  100% { transform: translate(20px, 20px) scale(1.05); }
}
@keyframes valore-fade-up {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes valore-bounce-subtle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(6px); }
}
@keyframes valore-pulse-border {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
.valore-orb-1 {
  animation: valore-float-orb-1 10s ease-in-out infinite alternate;
}
.valore-orb-2 {
  animation: valore-float-orb-2 12s ease-in-out infinite alternate;
}
.valore-orb-3 {
  animation: valore-float-orb-3 8s ease-in-out infinite alternate;
}
.valore-hero-badge {
  animation: valore-fade-up 0.85s ease-out 0.1s both;
}
.valore-hero-title {
  animation: valore-fade-up 0.85s ease-out 0.3s both;
}
.valore-hero-sub {
  animation: valore-fade-up 0.85s ease-out 0.5s both;
}
.valore-hero-cta {
  animation: valore-fade-up 0.85s ease-out 0.7s both;
}
.valore-scroll-hint {
  animation: valore-bounce-subtle 2.2s ease-in-out infinite;
}
.valore-badge-ring {
  animation: valore-pulse-border 2.5s ease-in-out infinite;
}
`

const featureCards = [
  {
    icon: FileText,
    title: "Cotações Automatizadas",
    description:
      "Crie RFQs, convide fornecedores e receba propostas estruturadas",
  },
  {
    icon: BarChart2,
    title: "Equalização Inteligente",
    description:
      "Compare propostas lado a lado e identifique as melhores condições",
  },
  {
    icon: Workflow,
    title: "Fluxos de Aprovação",
    description: "Controle total com níveis de aprovação configuráveis",
  },
  {
    icon: Users,
    title: "Portal do Fornecedor",
    description:
      "Fornecedores respondem cotações diretamente na plataforma",
  },
  {
    icon: ShieldCheck,
    title: "Compliance e Auditoria",
    description: "Rastreabilidade completa de todas as operações",
  },
  {
    icon: FilePen,
    title: "Gestão de Contratos",
    description:
      "Centralize contratos com fornecedores e acompanhe vigências",
  },
] as const

export default function HomePage() {
  const router = useRouter()

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LANDING_STYLES }} />

      <div
        className="relative min-h-screen text-white overflow-x-hidden"
        style={{ backgroundColor: "#0d0d1a" }}
      >
        {/* Animated mesh + grid */}
        <div
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
          aria-hidden
        >
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div
            className="valore-orb-1 absolute -left-[20%] -top-[15%] h-[min(90vw,520px)] w-[min(90vw,520px)] rounded-full opacity-50"
            style={{
              background: "#4F3EF5",
              filter: "blur(80px)",
            }}
          />
          <div
            className="valore-orb-2 absolute -bottom-[20%] -right-[15%] h-[min(85vw,480px)] w-[min(85vw,480px)] rounded-full opacity-[0.45]"
            style={{
              background: "#00C2FF",
              filter: "blur(80px)",
            }}
          />
          <div
            className="valore-orb-3 absolute left-1/2 top-1/2 h-[min(70vw,420px)] w-[min(70vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.4]"
            style={{
              background: "#2D1FA3",
              filter: "blur(80px)",
            }}
          />
        </div>

        <div className="relative z-10">
          {/* Header */}
          <header
            className="fixed top-0 z-50 w-full border-b backdrop-blur-[12px]"
            style={{
              backgroundColor: "rgba(13,13,26,0.6)",
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
              <ValoreLogo showName nameColor="#ffffff" size={36} />
            </div>
          </header>

          {/* Hero */}
          <section
            className="relative flex min-h-screen flex-col items-center justify-center px-4 pb-24 pt-[5.5rem] text-center sm:px-6"
          >
            <div className="mx-auto flex max-w-4xl flex-col items-center">
              <div
                className={cn(
                  "valore-hero-badge valore-badge-ring mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm",
                )}
                style={{
                  borderColor: "rgba(79,62,245,0.35)",
                  backgroundColor: "rgba(79,62,245,0.1)",
                  color: "#00C2FF",
                }}
              >
                <span aria-hidden>✦</span>
                Procurement inteligente para empresas modernas
              </div>

              <h1
                className="valore-hero-title font-bold tracking-tight"
                style={{
                  fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                }}
              >
                <span className="block text-white">Transforme suas</span>
                <span
                  className="block bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, #4F3EF5 0%, #00C2FF 100%)",
                  }}
                >
                  compras corporativas
                </span>
                <span className="block text-white">em vantagem competitiva</span>
              </h1>

              <p
                className="valore-hero-sub mx-auto mt-6 max-w-[520px] text-lg leading-relaxed"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                Gerencie fornecedores, automatize cotações e tome decisões baseadas
                em dados — tudo em uma plataforma integrada.
              </p>

              <div className="valore-hero-cta mt-10 flex w-full max-w-md flex-col gap-4 sm:max-w-none sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="rounded-xl px-8 py-4 text-base font-bold text-white transition-all hover:scale-[1.02] hover:opacity-90"
                  style={{
                    background:
                      "linear-gradient(90deg, #4F3EF5 0%, #00C2FF 100%)",
                  }}
                >
                  Acesso Interno →
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/fornecedor/login")}
                  className="rounded-xl border border-white/20 bg-transparent px-8 py-4 text-base font-semibold transition-all hover:border-white/40 hover:bg-white/[0.05]"
                  style={{ color: "rgba(255,255,255,0.8)" }}
                >
                  Portal do Fornecedor
                </button>
              </div>
            </div>

            <div
              className="valore-scroll-hint absolute bottom-10 left-1/2 -translate-x-1/2"
              style={{ color: "rgba(255,255,255,0.3)" }}
              aria-hidden
            >
              <ChevronDown className="h-8 w-8" strokeWidth={1.5} />
            </div>
          </section>

          {/* Features */}
          <section
            className="border-t py-24"
            style={{
              borderColor: "rgba(255,255,255,0.06)",
              backgroundColor: "rgba(255,255,255,0.02)",
            }}
          >
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <h2 className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Tudo que sua empresa precisa
              </h2>
              <p
                className="mx-auto mt-3 max-w-2xl text-center text-lg"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Uma plataforma completa do pedido ao pagamento
              </p>

              <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {featureCards.map(({ icon: Icon, title, description }) => (
                  <div
                    key={title}
                    className="group rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 transition-all duration-300 hover:border-[rgba(79,62,245,0.4)] hover:bg-[rgba(79,62,245,0.06)]"
                  >
                    <Icon
                      className="mb-4 h-8 w-8 shrink-0"
                      style={{ color: "#00C2FF" }}
                      strokeWidth={1.5}
                    />
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    <p
                      className="mt-2 text-sm leading-relaxed"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      {description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Demonstração */}
          <section
            className="border-y py-20"
            style={{
              background:
                "linear-gradient(135deg, rgba(79,62,245,0.15) 0%, rgba(0,194,255,0.08) 100%)",
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
              <span
                className="inline-block rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider"
                style={{
                  borderColor: "rgba(0,194,255,0.3)",
                  backgroundColor: "rgba(0,194,255,0.08)",
                  color: "#00C2FF",
                }}
              >
                Para novos clientes
              </span>
              <h2 className="mt-4 text-2xl font-bold text-white">
                Ainda não é cliente?
              </h2>
              <p
                className="mx-auto mt-3 max-w-lg text-base leading-relaxed"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                Conheça tudo que o Valore pode fazer pela sua operação de compras.
                Fale com um de nossos representantes e solicite uma demonstração
                gratuita.
              </p>
              <button
                type="button"
                onClick={() =>
                  window.open("https://www.axisstrategy.com.br/produtos", "_blank")
                }
                className="mt-8 rounded-xl border border-[rgba(0,194,255,0.5)] bg-[rgba(0,194,255,0.1)] px-8 py-4 text-base font-semibold text-[#00C2FF] transition-all duration-300 hover:border-[rgba(0,194,255,0.8)] hover:bg-[rgba(0,194,255,0.2)]"
              >
                Solicitar uma Demonstração →
              </button>
            </div>
          </section>

          {/* Footer */}
          <footer
            className="border-t py-8"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm sm:flex-row sm:px-6"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                <ValoreLogo showName nameColor="#ffffff" size={28} />
                <span>© 2026 Valore. Todos os direitos reservados.</span>
              </div>
              <p className="text-center sm:text-right">
                Sistema de Gestão de Compras Corporativas
              </p>
            </div>
          </footer>
        </div>
      </div>
    </>
  )
}
