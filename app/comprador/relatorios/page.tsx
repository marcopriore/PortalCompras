"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import {
  Download,
  FileText,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  Calendar,
  Filter,
} from "lucide-react"

const gastosCategoria = [
  { name: "Tecnologia", value: 245000, color: "var(--color-chart-1)" },
  { name: "Industrial", value: 189000, color: "var(--color-chart-2)" },
  { name: "Escritório", value: 67000, color: "var(--color-chart-3)" },
  { name: "Segurança", value: 98000, color: "var(--color-chart-4)" },
  { name: "Químicos", value: 45000, color: "var(--color-chart-5)" },
]

const evolucaoMensal = [
  { mes: "Jan", compras: 125000, saving: 12500 },
  { mes: "Fev", compras: 145000, saving: 18200 },
  { mes: "Mar", compras: 132000, saving: 15800 },
  { mes: "Abr", compras: 168000, saving: 22100 },
  { mes: "Mai", compras: 155000, saving: 19500 },
  { mes: "Jun", compras: 178000, saving: 25600 },
]

const topFornecedores = [
  { nome: "Tech Solutions", valor: 145000 },
  { nome: "Industrial Parts", valor: 112000 },
  { nome: "Safety Equipment", valor: 98000 },
  { nome: "Office Supplies", valor: 67000 },
  { nome: "Chemical Solutions", valor: 45000 },
]

const leadTimeData = [
  { mes: "Jan", media: 12, meta: 10 },
  { mes: "Fev", media: 11, meta: 10 },
  { mes: "Mar", media: 9, meta: 10 },
  { mes: "Abr", media: 8, meta: 10 },
  { mes: "Mai", media: 10, meta: 10 },
  { mes: "Jun", media: 7, meta: 10 },
]

const relatoriosDisponiveis = [
  {
    id: 1,
    titulo: "Análise de Gastos por Categoria",
    descricao: "Relatório detalhado de gastos segmentado por categoria de compras",
    icon: DollarSign,
  },
  {
    id: 2,
    titulo: "Performance de Fornecedores",
    descricao: "Avaliação de desempenho dos fornecedores com métricas de qualidade",
    icon: Users,
  },
  {
    id: 3,
    titulo: "Saving Acumulado",
    descricao: "Economia gerada através de negociações e processos de cotação",
    icon: TrendingUp,
  },
  {
    id: 4,
    titulo: "Lead Time de Compras",
    descricao: "Tempo médio do ciclo de compras da requisição à entrega",
    icon: Package,
  },
]

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState("6m")
  const [categoria, setCategoria] = useState("todas")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">
            Análises e indicadores de compras
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-full sm:w-36">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">Último mês</SelectItem>
              <SelectItem value="3m">Últimos 3 meses</SelectItem>
              <SelectItem value="6m">Últimos 6 meses</SelectItem>
              <SelectItem value="12m">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="tecnologia">Tecnologia</SelectItem>
              <SelectItem value="industrial">Industrial</SelectItem>
              <SelectItem value="escritorio">Escritório</SelectItem>
              <SelectItem value="seguranca">Segurança</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Compras
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 903.000</div>
            <p className="text-xs text-success">+12.5% vs período anterior</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saving Total
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">R$ 113.700</div>
            <p className="text-xs text-muted-foreground">12.6% de economia</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pedidos Realizados
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">184</div>
            <p className="text-xs text-muted-foreground">30.7 pedidos/mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lead Time Médio
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">9.5 dias</div>
            <p className="text-xs text-success">-2.3 dias vs meta</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dashboards" className="w-full">
        <TabsList>
          <TabsTrigger value="dashboards">Dashboards</TabsTrigger>
          <TabsTrigger value="exportar">Exportar Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboards" className="mt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Evolução de Compras e Saving</CardTitle>
                <CardDescription>Valores mensais em R$</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={evolucaoMensal}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="mes" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `${v / 1000}k`} />
                      <Tooltip
                        formatter={(value: number) =>
                          value.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })
                        }
                        contentStyle={{
                          backgroundColor: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="compras"
                        name="Compras"
                        stroke="var(--color-chart-1)"
                        strokeWidth={2}
                        dot={{ fill: "var(--color-chart-1)" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="saving"
                        name="Saving"
                        stroke="var(--color-chart-2)"
                        strokeWidth={2}
                        dot={{ fill: "var(--color-chart-2)" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gastos por Categoria</CardTitle>
                <CardDescription>Distribuição do volume de compras</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gastosCategoria}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {gastosCategoria.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) =>
                          value.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })
                        }
                        contentStyle={{
                          backgroundColor: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top 5 Fornecedores por Volume</CardTitle>
                <CardDescription>Maiores fornecedores em valor de compras</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topFornecedores} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        type="number"
                        className="text-xs"
                        tickFormatter={(v) => `${v / 1000}k`}
                      />
                      <YAxis
                        type="category"
                        dataKey="nome"
                        className="text-xs"
                        width={100}
                      />
                      <Tooltip
                        formatter={(value: number) =>
                          value.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })
                        }
                        contentStyle={{
                          backgroundColor: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <Bar dataKey="valor" fill="var(--color-chart-1)" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lead Time vs Meta</CardTitle>
                <CardDescription>Tempo médio de ciclo de compras em dias</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={leadTimeData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="mes" className="text-xs" />
                      <YAxis className="text-xs" domain={[0, 15]} />
                      <Tooltip
                        formatter={(value: number) => `${value} dias`}
                        contentStyle={{
                          backgroundColor: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="media"
                        name="Lead Time Médio"
                        stroke="var(--color-chart-1)"
                        strokeWidth={2}
                        dot={{ fill: "var(--color-chart-1)" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="meta"
                        name="Meta"
                        stroke="var(--color-destructive)"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="exportar" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {relatoriosDisponiveis.map((relatorio) => (
              <Card key={relatorio.id}>
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <relatorio.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{relatorio.titulo}</CardTitle>
                      <CardDescription>{relatorio.descricao}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`inicio-${relatorio.id}`}>Data Início</Label>
                        <Input type="date" id={`inicio-${relatorio.id}`} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`fim-${relatorio.id}`}>Data Fim</Label>
                        <Input type="date" id={`fim-${relatorio.id}`} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1">
                        <FileText className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <Download className="mr-2 h-4 w-4" />
                        Excel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
