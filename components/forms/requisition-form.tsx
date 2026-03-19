"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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
import { Plus, Trash2, Upload } from "lucide-react"

interface RequisitionFormProps {
  onSuccess?: () => void
}

interface Item {
  id: string
  descricao: string
  quantidade: number
  unidade: string
  especificacao: string
}

export function RequisitionForm({ onSuccess }: RequisitionFormProps) {
  const [step, setStep] = useState(1)
  const [items, setItems] = useState<Item[]>([
    { id: "1", descricao: "", quantidade: 1, unidade: "un", especificacao: "" },
  ])

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
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
            {s < 3 && (
              <div
                className={`h-0.5 w-12 ${step > s ? "bg-primary" : "bg-muted"}`}
              />
            )}
          </div>
        ))}
        <span className="ml-2 text-sm text-muted-foreground">
          {step === 1 && "Dados Básicos"}
          {step === 2 && "Itens"}
          {step === 3 && "Revisão"}
        </span>
      </div>

      {step === 1 && (
        <FieldGroup>
          <Field>
            <FieldLabel>Título da Requisição</FieldLabel>
            <Input placeholder="Ex: Material de escritório" required />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Departamento</FieldLabel>
              <Select required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ti">Tecnologia</SelectItem>
                  <SelectItem value="rh">Recursos Humanos</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="administrativo">Administrativo</SelectItem>
                  <SelectItem value="operacoes">Operações</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Prioridade</FieldLabel>
              <Select required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Centro de Custo</FieldLabel>
              <Input placeholder="Ex: CC-001" />
            </Field>

            <Field>
              <FieldLabel>Data Necessária</FieldLabel>
              <Input type="date" />
            </Field>
          </div>

          <Field>
            <FieldLabel>Justificativa</FieldLabel>
            <Textarea
              placeholder="Descreva o motivo da solicitação..."
              rows={3}
            />
          </Field>
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
                    placeholder="Descrição curta do item"
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
                      placeholder="Ex: Marca, modelo..."
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

          <div className="rounded-lg border border-dashed p-6 text-center">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Arraste arquivos ou clique para anexar documentos
            </p>
            <Input type="file" className="hidden" id="file-upload" multiple />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              Selecionar Arquivos
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <h3 className="font-medium mb-2">Resumo da Requisição</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total de Itens:</dt>
                <dd className="font-medium">{items.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status:</dt>
                <dd className="font-medium">Pendente de Aprovação</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border">
            <div className="p-4 border-b bg-muted/50">
              <h4 className="font-medium">Itens Solicitados</h4>
            </div>
            <div className="divide-y">
              {items.map((item, index) => (
                <div key={item.id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{item.descricao || `Item ${index + 1}`}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantidade} {item.unidade} {item.especificacao && `- ${item.especificacao}`}
                    </p>
                  </div>
                </div>
              ))}
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
        {step < 3 ? (
          <Button type="button" onClick={() => setStep(step + 1)}>
            Continuar
          </Button>
        ) : (
          <Button type="submit">Criar Requisição</Button>
        )}
      </div>
    </form>
  )
}
