import { FileText, ShoppingCart, TrendingDown, Clock } from "lucide-react"
import { MetricsCard } from "@/components/dashboard/metrics-card"
import { RecentActivitiesTable } from "@/components/dashboard/recent-activities-table"
import {
  SpendAnalysisChart,
  QuotationStatusChart,
  LeadTimeChart,
} from "@/components/dashboard/dashboard-charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const recentActivities = [
  { id: "COT-001", title: "Material de escritório", type: "cotacao" as const, status: "pendente" as const, date: "13/03/2026" },
  { id: "PED-042", title: "Equipamentos de TI", type: "pedido" as const, status: "em_andamento" as const, date: "12/03/2026" },
  { id: "REQ-089", title: "Serviços de limpeza", type: "requisicao" as const, status: "concluido" as const, date: "11/03/2026" },
  { id: "COT-002", title: "Móveis para escritório", type: "cotacao" as const, status: "em_andamento" as const, date: "10/03/2026" },
  { id: "PED-041", title: "Material de segurança", type: "pedido" as const, status: "concluido" as const, date: "09/03/2026" },
]

export default function CompradorDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Acompanhe suas métricas e atividades de compras
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricsCard
          title="Cotações Pendentes"
          value={12}
          change={-8}
          icon={FileText}
        />
        <MetricsCard
          title="Pedidos em Andamento"
          value={23}
          change={15}
          icon={ShoppingCart}
        />
        <MetricsCard
          title="Saving Acumulado"
          value="R$ 45.2k"
          change={22}
          icon={TrendingDown}
        />
        <MetricsCard
          title="Lead Time Médio"
          value="7 dias"
          change={-12}
          icon={Clock}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpendAnalysisChart />
        <QuotationStatusChart />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Atividades Recentes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <RecentActivitiesTable 
                activities={recentActivities} 
                basePath="/comprador" 
              />
            </CardContent>
          </Card>
        </div>
        <LeadTimeChart />
      </div>
    </div>
  )
}
