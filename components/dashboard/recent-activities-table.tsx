"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Eye } from "lucide-react"
import Link from "next/link"

interface Activity {
  id: string
  title: string
  type: "cotacao" | "pedido" | "requisicao"
  status: "pendente" | "em_andamento" | "concluido" | "cancelado"
  date: string
  value?: string
}

const statusConfig = {
  pendente: { label: "Pendente", variant: "outline" as const },
  em_andamento: { label: "Em Andamento", variant: "secondary" as const },
  concluido: { label: "Concluído", variant: "default" as const },
  cancelado: { label: "Cancelado", variant: "destructive" as const },
}

const typeConfig = {
  cotacao: "Cotação",
  pedido: "Pedido",
  requisicao: "Requisição",
}

interface RecentActivitiesTableProps {
  activities: Activity[]
  basePath: string
}

export function RecentActivitiesTable({ activities, basePath }: RecentActivitiesTableProps) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities.map((activity) => (
            <TableRow key={activity.id}>
              <TableCell className="font-medium">{activity.id}</TableCell>
              <TableCell>{activity.title}</TableCell>
              <TableCell>
                <span className="text-muted-foreground">
                  {typeConfig[activity.type]}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={statusConfig[activity.status].variant}>
                  {statusConfig[activity.status].label}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{activity.date}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`${basePath}/${activity.type}s/${activity.id}`}>
                    <Eye className="h-4 w-4 mr-1" />
                    Ver
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
