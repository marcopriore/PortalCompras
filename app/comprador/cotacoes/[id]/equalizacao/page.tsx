"use client"

import { use } from "react"
import Link from "next/link"
import { ArrowLeft, Download, CheckCircle2, Star, FileText, Clock, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface Proposal {
  id: string
  fornecedor: string
  precoTotal: number
  prazoEntrega: number
  condicaoPagamento: string
  validadeProposta: string
  anexos: number
  pontuacao: number
}

const mockProposals: Proposal[] = [
  { id: "1", fornecedor: "Tech Solutions Ltda", precoTotal: 42500, prazoEntrega: 15, condicaoPagamento: "30 dias", validadeProposta: "30/04/2026", anexos: 3, pontuacao: 92 },
  { id: "2", fornecedor: "Office Supplies SA", precoTotal: 38900, prazoEntrega: 20, condicaoPagamento: "À vista", validadeProposta: "25/04/2026", anexos: 2, pontuacao: 88 },
  { id: "3", fornecedor: "InfoTech Brasil", precoTotal: 45200, prazoEntrega: 10, condicaoPagamento: "60 dias", validadeProposta: "20/04/2026", anexos: 4, pontuacao: 85 },
  { id: "4", fornecedor: "Clean Services", precoTotal: 41000, prazoEntrega: 18, condicaoPagamento: "30 dias", validadeProposta: "28/04/2026", anexos: 2, pontuacao: 78 },
  { id: "5", fornecedor: "Mobilia Corp", precoTotal: 52300, prazoEntrega: 12, condicaoPagamento: "45 dias", validadeProposta: "15/04/2026", anexos: 5, pontuacao: 75 },
]

const getBestValue = (proposals: Proposal[], key: keyof Proposal, type: "min" | "max") => {
  const values = proposals.map((p) => p[key] as number)
  return type === "min" ? Math.min(...values) : Math.max(...values)
}

export default function EqualizacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const bestPrice = getBestValue(mockProposals, "precoTotal", "min")
  const bestPrazo = getBestValue(mockProposals, "prazoEntrega", "min")
  const bestScore = getBestValue(mockProposals, "pontuacao", "max")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/comprador/cotacoes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Equalização de Propostas</h1>
          <p className="text-muted-foreground">
            Cotação {id} - Comparativo de propostas recebidas
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                <CreditCard className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Menor Preço</p>
                <p className="text-2xl font-bold">R$ {bestPrice.toLocaleString("pt-BR")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Menor Prazo</p>
                <p className="text-2xl font-bold">{bestPrazo} dias</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
                <Star className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Maior Pontuação</p>
                <p className="text-2xl font-bold">{bestScore} pts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comparativo de Propostas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Fornecedor</TableHead>
                  <TableHead className="text-right">Preço Total</TableHead>
                  <TableHead className="text-center">Prazo Entrega</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead className="text-center">Anexos</TableHead>
                  <TableHead className="text-center">Pontuação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockProposals.map((proposal) => (
                  <TableRow key={proposal.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {proposal.pontuacao === bestScore && (
                          <Badge variant="default" className="bg-success text-success-foreground">
                            Melhor
                          </Badge>
                        )}
                        <span className="font-medium">{proposal.fornecedor}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "font-medium",
                          proposal.precoTotal === bestPrice && "text-success"
                        )}
                      >
                        R$ {proposal.precoTotal.toLocaleString("pt-BR")}
                      </span>
                      {proposal.precoTotal === bestPrice && (
                        <CheckCircle2 className="inline ml-1 h-4 w-4 text-success" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          proposal.prazoEntrega === bestPrazo && "text-success font-medium"
                        )}
                      >
                        {proposal.prazoEntrega} dias
                      </span>
                      {proposal.prazoEntrega === bestPrazo && (
                        <CheckCircle2 className="inline ml-1 h-4 w-4 text-success" />
                      )}
                    </TableCell>
                    <TableCell>{proposal.condicaoPagamento}</TableCell>
                    <TableCell>{proposal.validadeProposta}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="sm">
                        <FileText className="h-4 w-4 mr-1" />
                        {proposal.anexos}
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      <div
                        className={cn(
                          "inline-flex items-center justify-center h-8 w-12 rounded-full text-sm font-medium",
                          proposal.pontuacao >= 90
                            ? "bg-success/15 text-success"
                            : proposal.pontuacao >= 80
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {proposal.pontuacao}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm">Selecionar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/comprador/cotacoes">Voltar</Link>
        </Button>
        <Button>Finalizar Cotação</Button>
      </div>
    </div>
  )
}
