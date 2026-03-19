"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Plus, Trash2, Upload, Search, Building2 } from "lucide-react"

interface QuotationFormProps {
  onSuccess?: () => void
}

interface Item {
  id: string
  descricao: string
  quantidade: number
  unidade: string
  especificacao: string
}

interface Supplier {
  id: string
  nome: string
  cnpj: string
  categoria: string
  selected: boolean
}

const mockSuppliers: Supplier[] = [
  { id: "1", nome: "Tech Solutions Ltda", cnpj: "12.345.678/0001-90", categoria: "Tecnologia", selected: false },
  { id: "2", nome: "Office Supplies SA", cnpj: "98.765.432/0001-10", categoria: "Suprimentos", selected: false },
  { id: "3", nome: "Clean Services", cnpj: "11.222.333/0001-44", categoria: "Serviços", selected: false },
  { id: "4", nome: "Mobilia Corp", cnpj: "55.666.777/0001-88", categoria: "Mobiliário", selected: false },
  { id: "5", nome: "InfoTech Brasil", cnpj: "22.333.444/0001-55", categoria: "Tecnologia", selected: false },
]

export function QuotationForm({ onSuccess }: QuotationFormProps) {
  const [step, setStep] = useState(1)
  const [items, setItems] = useState<Item[]>([
    { id: "1", descricao: "", quantidade: 1, unidade: "un", especificacao: "" },
  ])
  const [suppliers, setSuppliers] = useState<Supplier[]>(mockSuppliers)
  const [supplierSearch, setSupplierSearch] = useState("")

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now().toString(), descricao: "", quantidade: 1, unidade: "un", especificacao: "" },
    ])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id))
    }
  }

  const updateItem = (id: string, field: keyof Item, value: string | number) => {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  const toggleSupplier = (id: string) => {
    setSuppliers(suppliers.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)))
  }

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.nome.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      s.cnpj.includes(supplierSearch)
  )

  const selectedCount = suppliers.filter((s) => s.selected).length

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step >= s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s}
            </div>
            {s < 4 && (
              <div
                className={`h-0.5 w-8 ${step > s ? "bg-primary" : "bg-muted"}`}
              />
            )}
          </div>
        ))}
        <span className="ml-2 text-sm text-muted-foreground">
          {step === 1 && "Dados da Cotação"}
          {step === 2 && "Itens"}
          {step === 3 && "Fornecedores"}
          {step === 4 && "Revisão"}
        </span>
      </div>

      {step === 1 && (
        <FieldGroup>
          <Field>
            <FieldLabel>Título da Cotação</FieldLabel>
            <Input placeholder="Ex: Material de escritório Q1 2026" required />
          </Field>

          <Field>
            <FieldLabel>Descrição</FieldLabel>
            <Textarea
              placeholder="Descreva o objetivo desta cotação..."
              rows={3}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Categoria</FieldLabel>
              <Select required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="suprimentos">Suprimentos</SelectItem>
                  <SelectItem value="tecnologia">Tecnologia</SelectItem>
                  <SelectItem value="servicos">Serviços</SelectItem>
                  <SelectItem value="mobiliario">Mobiliário</SelectItem>
                  <SelectItem value="transporte">Transporte</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Data Limite para Propostas</FieldLabel>
              <Input type="date" required />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Condição de Pagamento</FieldLabel>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avista">À Vista</SelectItem>
                  <SelectItem value="30dias">30 Dias</SelectItem>
                  <SelectItem value="60dias">60 Dias</SelectItem>
                  <SelectItem value="90dias">90 Dias</SelectItem>
                  <SelectItem value="negociar">A Negociar</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Valor Estimado</FieldLabel>
              <Input type="number" placeholder="R$ 0,00" />
            </Field>
          </div>

          <div className="rounded-lg border border-dashed p-6 text-center">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Anexe especificações técnicas, plantas ou outros documentos
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-4">
              Selecionar Arquivos
            </Button>
          </div>
        </FieldGroup>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="rounded-lg border bg-card p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Item {index + 1}</span>
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>

              <FieldGroup>
                <Field>
                  <FieldLabel>Descrição Curta</FieldLabel>
                  <Input
                    placeholder="Descrição curta do item solicitado"
                    value={item.descricao}
                    onChange={(e) => updateItem(item.id, "descricao", e.target.value)}
                    required
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field>
                    <FieldLabel>Quantidade</FieldLabel>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantidade}
                      onChange={(e) => updateItem(item.id, "quantidade", parseInt(e.target.value) || 1)}
                      required
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Unidade</FieldLabel>
                    <Select
                      value={item.unidade}
                      onValueChange={(value) => updateItem(item.id, "unidade", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="un">Unidade</SelectItem>
                        <SelectItem value="cx">Caixa</SelectItem>
                        <SelectItem value="pc">Pacote</SelectItem>
                        <SelectItem value="kg">Quilograma</SelectItem>
                        <SelectItem value="lt">Litro</SelectItem>
                        <SelectItem value="mt">Metro</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>Especificação</FieldLabel>
                    <Input
                      placeholder="Marca, modelo, cor..."
                      value={item.especificacao}
                      onChange={(e) => updateItem(item.id, "especificacao", e.target.value)}
                    />
                  </Field>
                </div>
              </FieldGroup>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addItem} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Item
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar fornecedores por nome ou CNPJ..."
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="text-sm text-muted-foreground">
            {selectedCount} fornecedor(es) selecionado(s)
          </div>

          <div className="rounded-lg border divide-y max-h-[300px] overflow-y-auto">
            {filteredSuppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer"
                onClick={() => toggleSupplier(supplier.id)}
              >
                <Checkbox
                  checked={supplier.selected}
                  onCheckedChange={() => toggleSupplier(supplier.id)}
                />
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{supplier.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {supplier.cnpj} - {supplier.categoria}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {filteredSuppliers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum fornecedor encontrado
            </div>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <h3 className="font-medium mb-2">Resumo da Cotação</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total de Itens:</dt>
                <dd className="font-medium">{items.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Fornecedores Convidados:</dt>
                <dd className="font-medium">{selectedCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status:</dt>
                <dd className="font-medium">Pronto para Publicar</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border">
            <div className="p-4 border-b bg-muted/50">
              <h4 className="font-medium">Itens da Cotação</h4>
            </div>
            <div className="divide-y">
              {items.map((item, index) => (
                <div key={item.id} className="p-4">
                  <p className="font-medium">{item.descricao || `Item ${index + 1}`}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.quantidade} {item.unidade} {item.especificacao && `- ${item.especificacao}`}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border">
            <div className="p-4 border-b bg-muted/50">
              <h4 className="font-medium">Fornecedores Selecionados</h4>
            </div>
            <div className="divide-y">
              {suppliers
                .filter((s) => s.selected)
                .map((supplier) => (
                  <div key={supplier.id} className="p-4 flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{supplier.nome}</span>
                  </div>
                ))}
              {selectedCount === 0 && (
                <div className="p-4 text-muted-foreground text-center">
                  Nenhum fornecedor selecionado
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4 border-t">
        {step > 1 ? (
          <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
            Voltar
          </Button>
        ) : (
          <div />
        )}
        {step < 4 ? (
          <Button type="button" onClick={() => setStep(step + 1)}>
            Continuar
          </Button>
        ) : (
          <Button type="submit">Publicar Cotação</Button>
        )}
      </div>
    </form>
  )
}
