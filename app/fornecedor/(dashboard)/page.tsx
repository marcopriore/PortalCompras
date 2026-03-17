import Link from "next/link"
import { FileText, Send, ShoppingCart, Clock, ArrowRight } from "lucide-react"
import { MetricsCard } from "@/components/dashboard/metrics-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const opportunities = [
  { id: "COT-001", titulo: "Material de escritório 2026", comprador: "Empresa ABC", dataLimite: "20/03/2026", status: "nova" },
  { id: "COT-003", titulo: "Serviços de limpeza anual", comprador: "Corp XYZ", dataLimite: "25/03/2026", status: "visualizada" },
  { id: "COT-006", titulo: "Manutenção predial", comprador: "Tech Inc", dataLimite: "22/03/2026", status: "nova" },
]

const recentProposals = [
  { id: "PROP-001", cotacao: "COT-002", titulo: "Equipamentos de TI", valor: 42500, status: "enviada", data: "10/03/2026" },
  { id: "PROP-002", cotacao: "COT-004", titulo: "Móveis corporativos", valor: 38000, status: "aceita", data: "01/03/2026" },
  { id: "PROP-003", cotacao: "COT-007", titulo: "Licenças Microsoft 365", valor: 62000, status: "recusada", data: "28/02/2026" },
]

const statusColors: Record<string, string> = {
  nova: "bg-success/15 text-success",
  visualizada: "bg-primary/15 text-primary",
  enviada: "bg-primary/15 text-primary",
  aceita: "bg-success/15 text-success",
  recusada: "bg-destructive/15 text-destructive",
}

const statusLabels: Record<string, string> = {
  nova: "Nova",
  visualizada: "Visualizada",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
}

export default function FornecedorDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Acompanhe suas oportunidades e propostas
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricsCard
          title="Cotações Pendentes"
          value={5}
          change={25}
          icon={FileText}
        />
        <MetricsCard
          title="Propostas Enviadas"
          value={12}
          change={8}
          icon={Send}
        />
        <MetricsCard
          title="Pedidos Recebidos"
          value={3}
          change={50}
          icon={ShoppingCart}
        />
        <MetricsCard
          title="Taxa de Sucesso"
          value="67%"
          change={5}
          icon={Clock}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Novas Oportunidades</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/fornecedor/oportunidades">
                Ver todas
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {opportunities.map((opp) => (
                <Link
                  key={opp.id}
                  href={`/fornecedor/oportunidades/${opp.id}`}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{opp.titulo}</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[opp.status]}`}
                      >
                        {statusLabels[opp.status]}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {opp.comprador} - Prazo: {opp.dataLimite}
                    </p>
                  </div>
                  <Button size="sm">Ver Cotação</Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Propostas Recentes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/fornecedor/propostas">
                Ver todas
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentProposals.map((prop) => (
                <div
                  key={prop.id}
                  className="flex items-center justify-between p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{prop.titulo}</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[prop.status]}`}
                      >
                        {statusLabels[prop.status]}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      R$ {prop.valor.toLocaleString("pt-BR")} - {prop.data}
                    </p>
                  </div>
                  <Badge variant="outline">{prop.id}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
