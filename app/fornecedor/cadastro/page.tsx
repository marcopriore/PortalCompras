"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Package, ArrowLeft, Upload, Check } from "lucide-react"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

export default function CadastroPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step < 3) {
      setStep(step + 1)
      return
    }
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    router.push("/fornecedor")
  }

  const steps = [
    { number: 1, title: "Dados Básicos" },
    { number: 2, title: "Empresa" },
    { number: 3, title: "Documentos" },
  ]

  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/fornecedor/login">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Cadastro de Fornecedor</h1>
            <p className="text-sm text-muted-foreground">ProcureMax</p>
          </div>
        </div>

        <div className="flex items-center justify-center mb-8">
          {steps.map((s, index) => (
            <div key={s.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium ${
                    step > s.number
                      ? "bg-success text-success-foreground"
                      : step === s.number
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s.number ? <Check className="h-5 w-5" /> : s.number}
                </div>
                <span className="mt-2 text-xs text-muted-foreground">{s.title}</span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 w-16 mx-2 ${
                    step > s.number ? "bg-success" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {step === 1 && "Informações Básicas"}
              {step === 2 && "Dados da Empresa"}
              {step === 3 && "Documentação"}
            </CardTitle>
            <CardDescription>
              {step === 1 && "Preencha os dados do responsável pelo cadastro"}
              {step === 2 && "Informe os dados cadastrais da sua empresa"}
              {step === 3 && "Envie os documentos necessários para homologação"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {step === 1 && (
                <FieldGroup>
                  <Field>
                    <FieldLabel>Nome Completo</FieldLabel>
                    <Input placeholder="Seu nome completo" required />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>E-mail</FieldLabel>
                      <Input type="email" placeholder="seu@email.com" required />
                    </Field>
                    <Field>
                      <FieldLabel>Telefone</FieldLabel>
                      <Input type="tel" placeholder="(00) 00000-0000" required />
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel>Cargo</FieldLabel>
                    <Input placeholder="Ex: Diretor Comercial" required />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>Senha</FieldLabel>
                      <Input type="password" placeholder="Mínimo 8 caracteres" required />
                    </Field>
                    <Field>
                      <FieldLabel>Confirmar Senha</FieldLabel>
                      <Input type="password" placeholder="Repita a senha" required />
                    </Field>
                  </div>
                </FieldGroup>
              )}

              {step === 2 && (
                <FieldGroup>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>CNPJ</FieldLabel>
                      <Input placeholder="00.000.000/0001-00" required />
                    </Field>
                    <Field>
                      <FieldLabel>Inscrição Estadual</FieldLabel>
                      <Input placeholder="000.000.000.000" />
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel>Razão Social</FieldLabel>
                    <Input placeholder="Razão social completa" required />
                  </Field>

                  <Field>
                    <FieldLabel>Nome Fantasia</FieldLabel>
                    <Input placeholder="Nome fantasia" required />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>Categoria Principal</FieldLabel>
                      <Select required>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tecnologia">Tecnologia</SelectItem>
                          <SelectItem value="suprimentos">Suprimentos</SelectItem>
                          <SelectItem value="servicos">Serviços</SelectItem>
                          <SelectItem value="mobiliario">Mobiliário</SelectItem>
                          <SelectItem value="logistica">Logística</SelectItem>
                          <SelectItem value="outros">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Porte da Empresa</FieldLabel>
                      <Select required>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mei">MEI</SelectItem>
                          <SelectItem value="me">Microempresa</SelectItem>
                          <SelectItem value="epp">EPP</SelectItem>
                          <SelectItem value="medio">Médio Porte</SelectItem>
                          <SelectItem value="grande">Grande Porte</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel>Endereço Completo</FieldLabel>
                    <Input placeholder="Rua, número, bairro" required />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field>
                      <FieldLabel>Cidade</FieldLabel>
                      <Input placeholder="Cidade" required />
                    </Field>
                    <Field>
                      <FieldLabel>Estado</FieldLabel>
                      <Select required>
                        <SelectTrigger>
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SP">SP</SelectItem>
                          <SelectItem value="RJ">RJ</SelectItem>
                          <SelectItem value="MG">MG</SelectItem>
                          <SelectItem value="PR">PR</SelectItem>
                          <SelectItem value="SC">SC</SelectItem>
                          <SelectItem value="RS">RS</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>CEP</FieldLabel>
                      <Input placeholder="00000-000" required />
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel>Descrição da Empresa</FieldLabel>
                    <Textarea
                      placeholder="Descreva os principais produtos/serviços oferecidos..."
                      rows={3}
                    />
                  </Field>
                </FieldGroup>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    {[
                      { name: "Contrato Social", required: true },
                      { name: "Cartão CNPJ", required: true },
                      { name: "Certidão Negativa de Débitos", required: true },
                      { name: "Alvará de Funcionamento", required: false },
                      { name: "Certificações (ISO, etc)", required: false },
                    ].map((doc) => (
                      <div
                        key={doc.name}
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <Upload className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">
                              {doc.name}
                              {doc.required && (
                                <span className="text-destructive ml-1">*</span>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              PDF, JPG ou PNG (máx. 5MB)
                            </p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Selecionar
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg bg-muted/50 p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox id="terms" required />
                      <label htmlFor="terms" className="text-sm leading-relaxed">
                        Li e aceito os{" "}
                        <Link href="#" className="text-primary hover:underline">
                          Termos de Uso
                        </Link>{" "}
                        e a{" "}
                        <Link href="#" className="text-primary hover:underline">
                          Política de Privacidade
                        </Link>{" "}
                        da plataforma ProcureMax.
                      </label>
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
                  <Button variant="outline" asChild>
                    <Link href="/fornecedor/login">Cancelar</Link>
                  </Button>
                )}
                <Button type="submit" disabled={isLoading}>
                  {isLoading
                    ? "Enviando..."
                    : step < 3
                    ? "Continuar"
                    : "Finalizar Cadastro"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
