"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Building2,
  User,
  Bell,
  Shield,
  Workflow,
  Mail,
  Save,
  Upload,
  Plus,
  Trash2,
} from "lucide-react"

const niveisAprovacao = [
  { nivel: 1, valor: "Até R$ 5.000", aprovador: "Gestor Direto" },
  { nivel: 2, valor: "R$ 5.001 - R$ 25.000", aprovador: "Gerente de Área" },
  { nivel: 3, valor: "R$ 25.001 - R$ 100.000", aprovador: "Diretor" },
  { nivel: 4, valor: "Acima de R$ 100.000", aprovador: "CEO" },
]

export default function ConfiguracoesPage() {
  const [notificacoes, setNotificacoes] = useState({
    novaRequisicao: true,
    cotacaoRecebida: true,
    pedidoAprovado: true,
    entregaRealizada: true,
    emailDigest: false,
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações do sistema de compras
        </p>
      </div>

      <Tabs defaultValue="empresa" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:grid-cols-5">
          <TabsTrigger value="empresa" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Empresa</span>
          </TabsTrigger>
          <TabsTrigger value="perfil" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="notificacoes" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notificações</span>
          </TabsTrigger>
          <TabsTrigger value="aprovacoes" className="gap-2">
            <Workflow className="h-4 w-4" />
            <span className="hidden sm:inline">Aprovações</span>
          </TabsTrigger>
          <TabsTrigger value="seguranca" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Segurança</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="empresa" className="mt-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Empresa</CardTitle>
                <CardDescription>
                  Dados cadastrais da sua organização
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src="/placeholder-logo.png" />
                    <AvatarFallback className="text-xl bg-primary/10 text-primary">
                      AC
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm">
                      <Upload className="mr-2 h-4 w-4" />
                      Alterar Logo
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG ou SVG. Máximo 2MB.
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="razaoSocial">Razão Social</Label>
                    <Input
                      id="razaoSocial"
                      defaultValue="Acme Corporation S.A."
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                    <Input id="nomeFantasia" defaultValue="Acme Corp" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      defaultValue="12.345.678/0001-90"
                      disabled
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="inscricaoEstadual">Inscrição Estadual</Label>
                    <Input
                      id="inscricaoEstadual"
                      defaultValue="123.456.789.012"
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      defaultValue="Av. Paulista, 1000 - Bela Vista"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input id="cidade" defaultValue="São Paulo" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="estado">Estado</Label>
                      <Select defaultValue="SP">
                        <SelectTrigger id="estado">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SP">SP</SelectItem>
                          <SelectItem value="RJ">RJ</SelectItem>
                          <SelectItem value="MG">MG</SelectItem>
                          <SelectItem value="PR">PR</SelectItem>
                          <SelectItem value="RS">RS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="cep">CEP</Label>
                      <Input id="cep" defaultValue="01310-100" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Alterações
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="perfil" className="mt-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Meu Perfil</CardTitle>
                <CardDescription>
                  Informações da sua conta de usuário
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src="/placeholder-avatar.jpg" />
                    <AvatarFallback className="text-xl">JD</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm">
                      <Upload className="mr-2 h-4 w-4" />
                      Alterar Foto
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      PNG ou JPG. Máximo 1MB.
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="nome">Nome Completo</Label>
                    <Input id="nome" defaultValue="João da Silva" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      defaultValue="joao.silva@acmecorp.com.br"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="cargo">Cargo</Label>
                    <Input id="cargo" defaultValue="Comprador Sênior" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="departamento">Departamento</Label>
                    <Select defaultValue="compras">
                      <SelectTrigger id="departamento">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compras">Compras</SelectItem>
                        <SelectItem value="financeiro">Financeiro</SelectItem>
                        <SelectItem value="operacoes">Operações</SelectItem>
                        <SelectItem value="ti">TI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input id="telefone" defaultValue="(11) 98765-4321" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ramal">Ramal</Label>
                    <Input id="ramal" defaultValue="1234" />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Alterações
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notificacoes" className="mt-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Notificação</CardTitle>
                <CardDescription>
                  Configure quais notificações deseja receber
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <Label>Nova Requisição</Label>
                      <span className="text-sm text-muted-foreground">
                        Receba alertas quando uma nova requisição for criada
                      </span>
                    </div>
                    <Switch
                      checked={notificacoes.novaRequisicao}
                      onCheckedChange={(checked) =>
                        setNotificacoes({ ...notificacoes, novaRequisicao: checked })
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <Label>Cotação Recebida</Label>
                      <span className="text-sm text-muted-foreground">
                        Notificação quando um fornecedor enviar uma proposta
                      </span>
                    </div>
                    <Switch
                      checked={notificacoes.cotacaoRecebida}
                      onCheckedChange={(checked) =>
                        setNotificacoes({ ...notificacoes, cotacaoRecebida: checked })
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <Label>Pedido Aprovado</Label>
                      <span className="text-sm text-muted-foreground">
                        Alerta quando um pedido for aprovado
                      </span>
                    </div>
                    <Switch
                      checked={notificacoes.pedidoAprovado}
                      onCheckedChange={(checked) =>
                        setNotificacoes({ ...notificacoes, pedidoAprovado: checked })
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <Label>Entrega Realizada</Label>
                      <span className="text-sm text-muted-foreground">
                        Notificação quando uma entrega for confirmada
                      </span>
                    </div>
                    <Switch
                      checked={notificacoes.entregaRealizada}
                      onCheckedChange={(checked) =>
                        setNotificacoes({ ...notificacoes, entregaRealizada: checked })
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <Label>Resumo por E-mail</Label>
                      <span className="text-sm text-muted-foreground">
                        Receba um resumo diário das atividades por e-mail
                      </span>
                    </div>
                    <Switch
                      checked={notificacoes.emailDigest}
                      onCheckedChange={(checked) =>
                        setNotificacoes({ ...notificacoes, emailDigest: checked })
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Preferências
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configurações de E-mail</CardTitle>
                <CardDescription>
                  Personalize os e-mails enviados pelo sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="assinatura">Assinatura de E-mail</Label>
                  <Textarea
                    id="assinatura"
                    rows={4}
                    defaultValue="Atenciosamente,&#10;João da Silva&#10;Comprador Sênior - Acme Corp&#10;Tel: (11) 98765-4321"
                  />
                </div>
                <div className="flex justify-end">
                  <Button variant="outline">
                    <Mail className="mr-2 h-4 w-4" />
                    Testar E-mail
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="aprovacoes" className="mt-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Níveis de Aprovação</CardTitle>
                <CardDescription>
                  Configure as alçadas de aprovação por valor de compra
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {niveisAprovacao.map((nivel, index) => (
                    <div
                      key={nivel.nivel}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                          {nivel.nivel}
                        </div>
                        <div>
                          <p className="font-medium">{nivel.valor}</p>
                          <p className="text-sm text-muted-foreground">
                            Aprovador: {nivel.aprovador}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Nível
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fluxo de Aprovação</CardTitle>
                <CardDescription>
                  Configurações gerais do processo de aprovação
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label>Aprovação em Paralelo</Label>
                    <span className="text-sm text-muted-foreground">
                      Permite que múltiplos aprovadores atuem simultaneamente
                    </span>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label>Delegação Automática</Label>
                    <span className="text-sm text-muted-foreground">
                      Redireciona aprovações para substituto em ausência
                    </span>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label>Lembrete de Aprovação Pendente</Label>
                    <span className="text-sm text-muted-foreground">
                      Envia lembretes após 24h de pendência
                    </span>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="seguranca" className="mt-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Alterar Senha</CardTitle>
                <CardDescription>
                  Atualize sua senha de acesso ao sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="senhaAtual">Senha Atual</Label>
                  <Input id="senhaAtual" type="password" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="novaSenha">Nova Senha</Label>
                  <Input id="novaSenha" type="password" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirmarSenha">Confirmar Nova Senha</Label>
                  <Input id="confirmarSenha" type="password" />
                </div>
                <div className="flex justify-end">
                  <Button>Alterar Senha</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Autenticação em Dois Fatores</CardTitle>
                <CardDescription>
                  Adicione uma camada extra de segurança à sua conta
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label>2FA via Aplicativo</Label>
                    <span className="text-sm text-muted-foreground">
                      Use um aplicativo autenticador como Google Authenticator
                    </span>
                  </div>
                  <Switch />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label>2FA via SMS</Label>
                    <span className="text-sm text-muted-foreground">
                      Receba códigos de verificação por SMS
                    </span>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sessões Ativas</CardTitle>
                <CardDescription>
                  Dispositivos com sessão ativa na sua conta
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex flex-col gap-1">
                      <p className="font-medium">Chrome - Windows</p>
                      <p className="text-sm text-muted-foreground">
                        São Paulo, Brasil - Sessão atual
                      </p>
                    </div>
                    <span className="text-xs text-success">Ativo agora</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex flex-col gap-1">
                      <p className="font-medium">Safari - iPhone</p>
                      <p className="text-sm text-muted-foreground">
                        São Paulo, Brasil
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive">
                      Encerrar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
