"use client"

import { useState } from "react"
import { DataTable } from "@/components/data-table/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Search, Filter, MoreHorizontal, Eye, Star, Mail, Phone, MapPin, Building2, Users, Award, TrendingUp, Plus } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const fornecedoresData = [
  {
    id: "F001",
    razaoSocial: "Tech Solutions Ltda",
    cnpj: "12.345.678/0001-90",
    categoria: "Tecnologia",
    cidade: "São Paulo",
    estado: "SP",
    status: "ativo",
    avaliacao: 4.8,
    pedidos: 45,
    email: "contato@techsolutions.com.br",
    telefone: "(11) 3456-7890",
  },
  {
    id: "F002",
    razaoSocial: "Industrial Parts S.A.",
    cnpj: "23.456.789/0001-01",
    categoria: "Industrial",
    cidade: "Campinas",
    estado: "SP",
    status: "ativo",
    avaliacao: 4.5,
    pedidos: 32,
    email: "vendas@industrialparts.com.br",
    telefone: "(19) 3234-5678",
  },
  {
    id: "F003",
    razaoSocial: "Office Supplies Co.",
    cnpj: "34.567.890/0001-12",
    categoria: "Escritório",
    cidade: "Rio de Janeiro",
    estado: "RJ",
    status: "ativo",
    avaliacao: 4.2,
    pedidos: 28,
    email: "comercial@officesupplies.com.br",
    telefone: "(21) 2345-6789",
  },
  {
    id: "F004",
    razaoSocial: "Global Materials Inc.",
    cnpj: "45.678.901/0001-23",
    categoria: "Matéria-Prima",
    cidade: "Belo Horizonte",
    estado: "MG",
    status: "pendente",
    avaliacao: 0,
    pedidos: 0,
    email: "contato@globalmaterials.com.br",
    telefone: "(31) 3456-7890",
  },
  {
    id: "F005",
    razaoSocial: "Safety Equipment Ltd",
    cnpj: "56.789.012/0001-34",
    categoria: "Segurança",
    cidade: "Curitiba",
    estado: "PR",
    status: "ativo",
    avaliacao: 4.9,
    pedidos: 67,
    email: "vendas@safetyequipment.com.br",
    telefone: "(41) 3567-8901",
  },
  {
    id: "F006",
    razaoSocial: "Chemical Solutions",
    cnpj: "67.890.123/0001-45",
    categoria: "Químicos",
    cidade: "Porto Alegre",
    estado: "RS",
    status: "bloqueado",
    avaliacao: 3.2,
    pedidos: 12,
    email: "atendimento@chemicalsolutions.com.br",
    telefone: "(51) 3678-9012",
  },
]

const statusConfig = {
  ativo: { label: "Ativo", variant: "success" as const },
  pendente: { label: "Pendente", variant: "warning" as const },
  bloqueado: { label: "Bloqueado", variant: "destructive" as const },
}

type Fornecedor = typeof fornecedoresData[0]

const columns = [
  {
    key: "razaoSocial",
    header: "Fornecedor",
    cell: (item: Fornecedor) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {item.razaoSocial.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{item.razaoSocial}</p>
          <p className="text-xs text-muted-foreground">{item.cnpj}</p>
        </div>
      </div>
    ),
  },
  {
    key: "categoria",
    header: "Categoria",
    cell: (item: Fornecedor) => (
      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
        {item.categoria}
      </span>
    ),
  },
  {
    key: "cidade",
    header: "Localização",
    cell: (item: Fornecedor) => (
      <div className="flex items-center gap-1 text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" />
        <span>{item.cidade}, {item.estado}</span>
      </div>
    ),
  },
  {
    key: "avaliacao",
    header: "Avaliação",
    cell: (item: Fornecedor) => (
      item.avaliacao > 0 ? (
        <div className="flex items-center gap-1">
          <Star className="h-4 w-4 fill-warning text-warning" />
          <span className="font-medium">{item.avaliacao.toFixed(1)}</span>
        </div>
      ) : (
        <span className="text-muted-foreground text-sm">Sem avaliação</span>
      )
    ),
  },
  {
    key: "pedidos",
    header: "Pedidos",
    cell: (item: Fornecedor) => (
      <span className="text-muted-foreground">{item.pedidos}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (item: Fornecedor) => {
      const config = statusConfig[item.status as keyof typeof statusConfig]
      return <StatusBadge variant={config.variant}>{config.label}</StatusBadge>
    },
  },
]

const renderActions = (item: Fornecedor) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-8 w-8">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem>
        <Eye className="mr-2 h-4 w-4" />
        Ver Perfil
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Mail className="mr-2 h-4 w-4" />
        Enviar E-mail
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Phone className="mr-2 h-4 w-4" />
        Ligar
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)

export default function FornecedoresPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("todos")
  const [categoriaFilter, setCategoriaFilter] = useState("todas")
  const [dialogOpen, setDialogOpen] = useState(false)

  const categorias = [...new Set(fornecedoresData.map((f) => f.categoria))]

  const filteredData = fornecedoresData.filter((fornecedor) => {
    const matchesSearch =
      fornecedor.razaoSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fornecedor.cnpj.includes(searchTerm)
    const matchesStatus = statusFilter === "todos" || fornecedor.status === statusFilter
    const matchesCategoria = categoriaFilter === "todas" || fornecedor.categoria === categoriaFilter
    return matchesSearch && matchesStatus && matchesCategoria
  })

  const metrics = {
    total: fornecedoresData.length,
    ativos: fornecedoresData.filter((f) => f.status === "ativo").length,
    pendentes: fornecedoresData.filter((f) => f.status === "pendente").length,
    mediaAvaliacao: (
      fornecedoresData
        .filter((f) => f.avaliacao > 0)
        .reduce((acc, f) => acc + f.avaliacao, 0) /
      fornecedoresData.filter((f) => f.avaliacao > 0).length
    ).toFixed(1),
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fornecedores</h1>
          <p className="text-muted-foreground">
            Gerencie sua base de fornecedores homologados
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Convidar Fornecedor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar Fornecedor</DialogTitle>
              <DialogDescription>
                Envie um convite para um novo fornecedor se cadastrar no portal
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="empresa">Nome da Empresa</Label>
                <Input id="empresa" placeholder="Razão social do fornecedor" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" placeholder="email@empresa.com.br" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="mensagem">Mensagem (opcional)</Label>
                <Textarea
                  id="mensagem"
                  placeholder="Adicione uma mensagem personalizada ao convite"
                  rows={3}
                />
              </div>
              <Button onClick={() => setDialogOpen(false)}>Enviar Convite</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Fornecedores
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fornecedores Ativos
            </CardTitle>
            <Users className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{metrics.ativos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendentes Homologação
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{metrics.pendentes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avaliação Média
            </CardTitle>
            <Award className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold">{metrics.mediaAvaliacao}</span>
              <Star className="h-5 w-5 fill-warning text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Lista de Fornecedores</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar fornecedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {categorias.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={filteredData} actions={renderActions} />
        </CardContent>
      </Card>
    </div>
  )
}
