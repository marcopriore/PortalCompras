import Link from "next/link"
import { Package, ArrowRight, ShoppingCart, Building2, BarChart3, Shield, Zap, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const features = [
  {
    icon: ShoppingCart,
    title: "Gestão de Compras",
    description: "Gerencie requisições, cotações e pedidos de forma centralizada e eficiente.",
  },
  {
    icon: Building2,
    title: "Portal do Fornecedor",
    description: "Acesso dedicado para fornecedores visualizarem cotações e enviarem propostas.",
  },
  {
    icon: BarChart3,
    title: "Análise de Dados",
    description: "Dashboards e relatórios para tomada de decisão baseada em dados.",
  },
  {
    icon: Shield,
    title: "Compliance",
    description: "Fluxos de aprovação e auditoria para garantir conformidade nos processos.",
  },
  {
    icon: Zap,
    title: "Equalização Automática",
    description: "Compare propostas lado a lado e identifique as melhores condições.",
  },
  {
    icon: Users,
    title: "Colaboração",
    description: "Comunicação direta entre compradores e fornecedores na plataforma.",
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">ProcureMax</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/fornecedor/login">Portal do Fornecedor</Link>
            </Button>
            <Button asChild>
              <Link href="/comprador">Área do Comprador</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="py-20 md:py-32">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-3xl mx-auto space-y-6">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-balance">
                Gestão de Compras Inteligente para sua Empresa
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground text-pretty max-w-2xl mx-auto">
                Simplifique processos de compras, gerencie fornecedores e otimize custos com nossa plataforma completa de procurement.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button size="lg" asChild>
                  <Link href="/comprador">
                    Acessar como Comprador
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/fornecedor/login">
                    Portal do Fornecedor
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight mb-4">
                Tudo que você precisa para compras corporativas
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Uma solução completa que conecta compradores e fornecedores em uma única plataforma.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const FeatureIcon = feature.icon
                return (
                  <Card key={feature.title} className="bg-card">
                    <CardContent className="pt-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                        <FeatureIcon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-semibold mb-2">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="grid gap-8 lg:grid-cols-2 items-center">
              <div className="space-y-6">
                <h2 className="text-3xl font-bold tracking-tight">
                  Para Compradores
                </h2>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    Dashboard com métricas de compras em tempo real
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    Criação e gestão de requisições e cotações
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    Equalização automática de propostas
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    Fluxos de aprovação configuráveis
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    Relatórios de spend analysis
                  </li>
                </ul>
                <Button asChild>
                  <Link href="/comprador">
                    Acessar Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="space-y-6">
                <h2 className="text-3xl font-bold tracking-tight">
                  Para Fornecedores
                </h2>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-accent" />
                    Cadastro simplificado com self-onboarding
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-accent" />
                    Receba convites para cotações relevantes
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-accent" />
                    Envie propostas de forma estruturada
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-accent" />
                    Comunicação direta com compradores
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-accent" />
                    Acompanhe status de suas propostas
                  </li>
                </ul>
                <Button variant="outline" asChild>
                  <Link href="/fornecedor/cadastro">
                    Cadastrar Empresa
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 bg-card">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Package className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">ProcureMax</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Sistema de Gestão de Compras e Portal do Fornecedor
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
