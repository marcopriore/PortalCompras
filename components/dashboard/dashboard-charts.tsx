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
interface SpendAnalysisChartProps {
  data: { name: string; value: number }[]
}

export function SpendAnalysisChart({ data }: SpendAnalysisChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spend por Categoria</CardTitle>
          <CardDescription>Valor total de pedidos por categoria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
            Nenhum dado disponível
          </div>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spend por Categoria</CardTitle>
        <CardDescription>Valor total de pedidos por categoria</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" tickFormatter={(value) => `R$ ${value / 1000}k`} />
              <YAxis type="category" dataKey="name" width={100} />
              <Tooltip
                formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, "Valor"]}
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                }}
              />
              <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} />
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
  if (!data || !data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status das Cotações</CardTitle>
          <CardDescription>Distribuição por status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
            Nenhum dado disponível
          </div>
        </CardContent>
      </Card>
    )
  }
  const total = data.reduce((acc, d) => acc + d.value, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status das Cotações</CardTitle>
        <CardDescription>Distribuição por status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 p-4">
        <div
          className="grid w-full items-center gap-2"
          style={{ gridTemplateColumns: "minmax(0,1fr) 13rem", height: 240 }}
        >
          <div className="h-full min-w-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="96%"
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `${value} cotações`}
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex w-full flex-shrink-0 flex-col justify-center gap-2 pl-1">
            {data.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2 whitespace-nowrap">
                <div
                  className="h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-muted-foreground">{entry.name}</span>
                <span className="text-sm font-medium text-foreground">{entry.value}</span>
                <span className="text-xs text-muted-foreground">
                  ({total > 0 ? Math.round((entry.value / total) * 100) : 0}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface LeadTimeChartProps {
  data: { month: string; days: number }[]
}

export function LeadTimeChart({ data }: LeadTimeChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lead Time Médio</CardTitle>
          <CardDescription>Dias até conclusão do processo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
            Nenhum dado disponível
          </div>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Time Médio</CardTitle>
        <CardDescription>Dias até conclusão do processo</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
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
                dataKey="days"
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
