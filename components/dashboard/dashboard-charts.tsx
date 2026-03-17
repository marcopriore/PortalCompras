"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts"

const spendData = [
  { categoria: "TI", valor: 45000 },
  { categoria: "MRO", valor: 32000 },
  { categoria: "Serviços", valor: 28000 },
  { categoria: "Logística", valor: 22000 },
  { categoria: "Marketing", valor: 18000 },
]

const quotationStatusData = [
  { name: "Pendentes", value: 12, color: "var(--warning)" },
  { name: "Respondidas", value: 8, color: "var(--primary)" },
  { name: "Em Análise", value: 5, color: "var(--accent)" },
  { name: "Encerradas", value: 15, color: "var(--muted-foreground)" },
]

const leadTimeData = [
  { mes: "Jan", leadTime: 12 },
  { mes: "Fev", leadTime: 10 },
  { mes: "Mar", leadTime: 14 },
  { mes: "Abr", leadTime: 9 },
  { mes: "Mai", leadTime: 8 },
  { mes: "Jun", leadTime: 7 },
]

export function SpendAnalysisChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Análise de Gastos</CardTitle>
        <CardDescription>Gastos por categoria no período</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={spendData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" tickFormatter={(value) => `R$ ${value / 1000}k`} />
              <YAxis type="category" dataKey="categoria" width={80} />
              <Tooltip
                formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, "Valor"]}
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                }}
              />
              <Bar dataKey="valor" fill="var(--primary)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

interface QuotationStatusChartProps {
  data?: { name: string; value: number; color: string }[]
}

export function QuotationStatusChart({ data }: QuotationStatusChartProps) {
  const chartData = data && data.length > 0 ? data : quotationStatusData

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status das Cotações</CardTitle>
        <CardDescription>Distribuição por status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function LeadTimeChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Time Médio</CardTitle>
        <CardDescription>Dias até conclusão do processo</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={leadTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis unit=" dias" />
              <Tooltip
                formatter={(value: number) => [`${value} dias`, "Lead Time"]}
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                }}
              />
              <Line
                type="monotone"
                dataKey="leadTime"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={{ fill: "var(--accent)", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
