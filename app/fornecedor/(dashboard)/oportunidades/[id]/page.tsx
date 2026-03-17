"use client"

import { use, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Calendar, Building2, FileText, Download, Send, MessageSquare } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const cotacaoData = {
  id: "COT-001",
  titulo: "Material de escritório 2026",
  descricao: "Solicitação de materiais de escritório para o primeiro trimestre de 2026, incluindo papéis, canetas, organizadores e demais itens de uso diário.",
  comprador: "Empresa ABC",
  compradorContato: "João Silva",
  categoria: "Suprimentos",
  dataLimite: "20/03/2026",
  condicaoPagamento: "30 dias",
  itens: [
    { id: 1, descricao: "Papel A4 (resma 500 folhas)", quantidade: 100, unidade: "resma", especificacao: "75g/m², branco" },
    { id: 2, descricao: "Caneta esferográfica azul", quantidade: 500, unidade: "un", especificacao: "Ponta média 1.0mm" },
    { id: 3, descricao: "Grampeador de mesa", quantidade: 50, unidade: "un", especificacao: "Capacidade 20 folhas" },
    { id: 4, descricao: "Clips para papel nº 2/0", quantidade: 200, unidade: "cx", especificacao: "Caixa com 100 unidades" },
    { id: 5, descricao: "Post-it 76x76mm", quantidade: 300, unidade: "bloco", especificacao: "Amarelo, 100 folhas/bloco" },
  ],
  anexos: [
    { nome: "Especificações_técnicas.pdf", tamanho: "245 KB" },
    { nome: "Termo_de_referência.pdf", tamanho: "128 KB" },
  ],
}

const messages = [
  { id: 1, autor: "João Silva", empresa: "Empresa ABC", mensagem: "Olá, temos interesse em receber propostas com certificação ISO 9001. Vocês possuem?", data: "12/03/2026 10:30", isComprador: true },
  { id: 2, autor: "Maria Santos", empresa: "Tech Solutions", mensagem: "Bom dia! Sim, possuímos certificação ISO 9001:2015. Podemos anexar à proposta.", data: "12/03/2026 14:15", isComprador: false },
]

export default function CotacaoDetalhesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [newMessage, setNewMessage] = useState("")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/fornecedor/oportunidades">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{cotacaoData.titulo}</h1>
            <Badge>Aberta</Badge>
          </div>
          <p className="text-muted-foreground">{id}</p>
        </div>
        <Button asChild>
          <Link href={`/fornecedor/oportunidades/${id}/proposta`}>
            <Send className="mr-2 h-4 w-4" />
            Enviar Proposta
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalhes da Cotação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">{cotacaoData.descricao}</p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Comprador</p>
                    <p className="font-medium">{cotacaoData.comprador}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Data Limite</p>
                    <p className="font-medium">{cotacaoData.dataLimite}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Itens Solicitados</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead>Un</TableHead>
                    <TableHead>Especificação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cotacaoData.itens.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>{item.descricao}</TableCell>
                      <TableCell className="text-center">{item.quantidade}</TableCell>
                      <TableCell>{item.unidade}</TableCell>
                      <TableCell className="text-muted-foreground">{item.especificacao}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Mensagens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4 max-h-[300px] overflow-y-auto">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.isComprador ? "" : "flex-row-reverse"}`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={msg.isComprador ? "bg-primary" : "bg-accent"}>
                        {msg.autor.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={`flex-1 max-w-[80%] rounded-lg p-3 ${
                        msg.isComprador ? "bg-muted" : "bg-primary/10"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{msg.autor}</span>
                        <span className="text-xs text-muted-foreground">{msg.empresa}</span>
                      </div>
                      <p className="text-sm">{msg.mensagem}</p>
                      <p className="text-xs text-muted-foreground mt-1">{msg.data}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Textarea
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={2}
                />
                <Button className="shrink-0">Enviar</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Categoria</dt>
                  <dd className="font-medium">{cotacaoData.categoria}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Pagamento</dt>
                  <dd className="font-medium">{cotacaoData.condicaoPagamento}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Contato</dt>
                  <dd className="font-medium">{cotacaoData.compradorContato}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Total de Itens</dt>
                  <dd className="font-medium">{cotacaoData.itens.length}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Anexos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {cotacaoData.anexos.map((anexo) => (
                <div
                  key={anexo.nome}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{anexo.nome}</p>
                      <p className="text-xs text-muted-foreground">{anexo.tamanho}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
