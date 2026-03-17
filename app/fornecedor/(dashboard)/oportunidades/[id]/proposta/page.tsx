"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Upload, Calculator } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const itens = [
  { id: 1, descricao: "Papel A4 (resma 500 folhas)", quantidade: 100, unidade: "resma" },
  { id: 2, descricao: "Caneta esferográfica azul", quantidade: 500, unidade: "un" },
  { id: 3, descricao: "Grampeador de mesa", quantidade: 50, unidade: "un" },
  { id: 4, descricao: "Clips para papel nº 2/0", quantidade: 200, unidade: "cx" },
  { id: 5, descricao: "Post-it 76x76mm", quantidade: 300, unidade: "bloco" },
]

interface ItemPricing {
  id: number
  precoUnitario: number
  icms: number
  ipi: number
}

export default function EnviarPropostaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [pricing, setPricing] = useState<ItemPricing[]>(
    itens.map((item) => ({ id: item.id, precoUnitario: 0, icms: 0, ipi: 0 }))
  )

  const updatePricing = (itemId: number, field: keyof Omit<ItemPricing, "id">, value: number) => {
    setPricing((prev) =>
      prev.map((p) => (p.id === itemId ? { ...p, [field]: value } : p))
    )
  }

  const calculateItemTotal = (itemId: number) => {
    const item = itens.find((i) => i.id === itemId)
    const price = pricing.find((p) => p.id === itemId)
    if (!item || !price) return 0

    const subtotal = price.precoUnitario * item.quantidade
    const icmsValue = subtotal * (price.icms / 100)
    const ipiValue = subtotal * (price.ipi / 100)
    return subtotal + icmsValue + ipiValue
  }

  const totalGeral = pricing.reduce((acc, p) => acc + calculateItemTotal(p.id), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    router.push("/fornecedor/propostas")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/fornecedor/oportunidades/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Enviar Proposta</h1>
          <p className="text-muted-foreground">Cotação {id} - Material de escritório 2026</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Precificação dos Itens
            </CardTitle>
            <CardDescription>
              Informe o preço unitário e os impostos para cada item
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Item</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead>Preço Unit. (R$)</TableHead>
                    <TableHead>ICMS (%)</TableHead>
                    <TableHead>IPI (%)</TableHead>
                    <TableHead className="text-right">Total (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((item) => {
                    const price = pricing.find((p) => p.id === item.id)
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="font-medium">{item.descricao}</p>
                        </TableCell>
                        <TableCell className="text-center">
                          {item.quantidade} {item.unidade}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={price?.precoUnitario || ""}
                            onChange={(e) =>
                              updatePricing(item.id, "precoUnitario", parseFloat(e.target.value) || 0)
                            }
                            className="w-24"
                            required
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.1"
                            min={0}
                            max={100}
                            value={price?.icms || ""}
                            onChange={(e) =>
                              updatePricing(item.id, "icms", parseFloat(e.target.value) || 0)
                            }
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.1"
                            min={0}
                            max={100}
                            value={price?.ipi || ""}
                            onChange={(e) =>
                              updatePricing(item.id, "ipi", parseFloat(e.target.value) || 0)
                            }
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {calculateItemTotal(item.id).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={5} className="text-right font-bold">
                      Total Geral:
                    </TableCell>
                    <TableCell className="text-right font-bold text-lg">
                      {totalGeral.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Condições Comerciais</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Prazo de Entrega</FieldLabel>
                    <div className="flex gap-2">
                      <Input type="number" min={1} placeholder="0" required />
                      <Select defaultValue="dias">
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dias">dias</SelectItem>
                          <SelectItem value="semanas">semanas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </Field>

                  <Field>
                    <FieldLabel>Validade da Proposta</FieldLabel>
                    <Input type="date" required />
                  </Field>
                </div>

                <Field>
                  <FieldLabel>Condição de Pagamento</FieldLabel>
                  <Select required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="avista">À Vista</SelectItem>
                      <SelectItem value="30dias">30 Dias</SelectItem>
                      <SelectItem value="60dias">60 Dias</SelectItem>
                      <SelectItem value="90dias">90 Dias</SelectItem>
                      <SelectItem value="30-60">30/60 Dias</SelectItem>
                      <SelectItem value="30-60-90">30/60/90 Dias</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>Frete</FieldLabel>
                  <Select required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cif">CIF (Incluso)</SelectItem>
                      <SelectItem value="fob">FOB (Por conta do comprador)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Observações e Anexos</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Observações</FieldLabel>
                  <Textarea
                    placeholder="Informações adicionais sobre sua proposta..."
                    rows={4}
                  />
                </Field>

                <div className="rounded-lg border border-dashed p-6 text-center">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Anexe proposta técnica, catálogos ou certificados
                  </p>
                  <Button type="button" variant="outline" size="sm" className="mt-4">
                    Selecionar Arquivos
                  </Button>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" asChild>
            <Link href={`/fornecedor/oportunidades/${id}`}>Cancelar</Link>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" type="button">
              Salvar Rascunho
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Enviando..." : "Enviar Proposta"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
