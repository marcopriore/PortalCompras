"use client"

import * as React from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import Link from "next/link"
import {
  BookOpen,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Server,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { OUTBOUND_INTEGRATION_ACTIONS } from "@/lib/integrations/types"

type ApiKeyRow = {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  active: boolean
  expires_at: string | null
  last_used_at: string | null
  created_at: string
}

type EndpointRow = {
  id: string
  name: string
  base_url: string
  auth_type: string
  auth_config: Record<string, string>
  actions: string[]
  active: boolean
  timeout_ms: number
}

const SCOPE_LABELS: Record<string, string> = {
  "items:read": "Itens — leitura",
  "items:write": "Itens — escrita",
  "suppliers:read": "Fornecedores — leitura",
  "suppliers:write": "Fornecedores — escrita",
  "requisitions:read": "Requisições — leitura",
  "requisitions:write": "Requisições — escrita",
  "quotations:read": "Cotações — leitura",
  "orders:read": "Pedidos — leitura",
}

const ACTION_LABELS: Record<string, string> = {
  "purchase_order.create": "Pedido criado",
  "purchase_order.update": "Pedido atualizado",
  "purchase_order.delete": "Pedido cancelado",
  "contract.create": "Contrato comercial criado",
  "requisition.created": "Requisição criada",
  "requisition.updated": "Requisição atualizada",
  "requisition.approved": "Requisição aprovada",
  "requisition.rejected": "Requisição rejeitada",
  "requisition.cancelled": "Requisição cancelada",
}

const emptyEndpointForm = () => ({
  name: "",
  base_url: "",
  auth_type: "none",
  auth_config: {} as Record<string, string>,
  actions: [] as string[],
  active: true,
  timeout_ms: 30000,
})

type IntegrationsSettingsProps = {
  companyId: string
}

function apiQuery(companyId: string) {
  return `company_id=${encodeURIComponent(companyId)}`
}

export function IntegrationsSettings({ companyId }: IntegrationsSettingsProps) {
  const [loading, setLoading] = React.useState(true)
  const [keys, setKeys] = React.useState<ApiKeyRow[]>([])
  const [availableScopes, setAvailableScopes] = React.useState<string[]>([])
  const [endpoints, setEndpoints] = React.useState<EndpointRow[]>([])

  const [keyDialogOpen, setKeyDialogOpen] = React.useState(false)
  const [keyName, setKeyName] = React.useState("")
  const [keyScopes, setKeyScopes] = React.useState<string[]>([])
  const [keySaving, setKeySaving] = React.useState(false)
  const [revealedKey, setRevealedKey] = React.useState<string | null>(null)

  const [endpointDialogOpen, setEndpointDialogOpen] = React.useState(false)
  const [endpointForm, setEndpointForm] = React.useState(emptyEndpointForm())
  const [editingEndpointId, setEditingEndpointId] = React.useState<string | null>(null)
  const [endpointSaving, setEndpointSaving] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const q = apiQuery(companyId)
      const [keysRes, endpointsRes] = await Promise.all([
        fetch(`/api/admin/api-keys?${q}`),
        fetch(`/api/admin/integration-endpoints?${q}`),
      ])
      if (keysRes.ok) {
        const json = (await keysRes.json()) as {
          keys: ApiKeyRow[]
          availableScopes: string[]
        }
        setKeys(json.keys ?? [])
        setAvailableScopes(json.availableScopes ?? [])
      }
      if (endpointsRes.ok) {
        const json = (await endpointsRes.json()) as { endpoints: EndpointRow[] }
        setEndpoints(json.endpoints ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [companyId])

  React.useEffect(() => {
    void load()
  }, [load])

  const toggleScope = (scope: string) => {
    setKeyScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    )
  }

  const createKey = async () => {
    setKeySaving(true)
    try {
      const res = await fetch(`/api/admin/api-keys?${apiQuery(companyId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName, scopes: keyScopes }),
      })
      const json = (await res.json()) as { error?: string; key?: { raw_key: string } }
      if (!res.ok) {
        toast.error(json.error ?? "Erro ao criar chave")
        return
      }
      setRevealedKey(json.key?.raw_key ?? null)
      toast.success("API key criada")
      void load()
    } finally {
      setKeySaving(false)
    }
  }

  const openNewKeyDialog = () => {
    setKeyName("")
    setKeyScopes([])
    setRevealedKey(null)
    setKeyDialogOpen(true)
  }

  const revokeKey = async (id: string) => {
    const res = await fetch(`/api/admin/api-keys/${id}?${apiQuery(companyId)}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Erro ao revogar chave")
      return
    }
    toast.success("Chave revogada")
    void load()
  }

  const toggleKeyActive = async (key: ApiKeyRow) => {
    const res = await fetch(`/api/admin/api-keys/${key.id}?${apiQuery(companyId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !key.active }),
    })
    if (!res.ok) {
      toast.error("Erro ao atualizar chave")
      return
    }
    void load()
  }

  const openEndpointDialog = (row?: EndpointRow) => {
    if (row) {
      setEditingEndpointId(row.id)
      setEndpointForm({
        name: row.name,
        base_url: row.base_url,
        auth_type: row.auth_type,
        auth_config: { ...row.auth_config },
        actions: [...row.actions],
        active: row.active,
        timeout_ms: row.timeout_ms,
      })
    } else {
      setEditingEndpointId(null)
      setEndpointForm(emptyEndpointForm())
    }
    setEndpointDialogOpen(true)
  }

  const toggleEndpointAction = (action: string) => {
    setEndpointForm((f) => ({
      ...f,
      actions: f.actions.includes(action)
        ? f.actions.filter((a) => a !== action)
        : [...f.actions, action],
    }))
  }

  const saveEndpoint = async () => {
    setEndpointSaving(true)
    try {
      const payload = {
        name: endpointForm.name,
        base_url: endpointForm.base_url,
        auth_type: endpointForm.auth_type,
        auth_config: endpointForm.auth_config,
        actions: endpointForm.actions,
        active: endpointForm.active,
        timeout_ms: endpointForm.timeout_ms,
      }

      const res = await fetch(
        editingEndpointId
          ? `/api/admin/integration-endpoints/${editingEndpointId}?${apiQuery(companyId)}`
          : `/api/admin/integration-endpoints?${apiQuery(companyId)}`,
        {
          method: editingEndpointId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(json.error ?? "Erro ao salvar endpoint")
        return
      }
      toast.success(editingEndpointId ? "Endpoint atualizado" : "Endpoint criado")
      setEndpointDialogOpen(false)
      void load()
    } finally {
      setEndpointSaving(false)
    }
  }

  const deactivateEndpoint = async (id: string) => {
    const res = await fetch(`/api/admin/integration-endpoints/${id}?${apiQuery(companyId)}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      toast.error("Erro ao desativar endpoint")
      return
    }
    toast.success("Endpoint desativado")
    void load()
  }

  const setAuthField = (key: string, value: string) => {
    setEndpointForm((f) => ({
      ...f,
      auth_config: { ...f.auth_config, [key]: value },
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/docs/api" target="_blank">
            <BookOpen className="mr-2 h-4 w-4" />
            Documentação
            <ExternalLink className="ml-1 h-3 w-3" />
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <KeyRound className="h-5 w-5" />
                  API Keys (inbound)
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Chaves para o ERP acessar <code className="text-xs">/api/v1/*</code>
                </p>
              </div>
              <Button size="sm" onClick={openNewKeyDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Nova chave
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Prefixo</TableHead>
                    <TableHead>Escopos</TableHead>
                    <TableHead>Último uso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhuma chave cadastrada.
                      </TableCell>
                    </TableRow>
                  )}
                  {keys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell className="font-mono text-xs">{key.key_prefix}…</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {key.scopes.map((s) => (
                            <Badge key={s} variant="secondary" className="text-[10px]">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {key.last_used_at
                          ? format(new Date(key.last_used_at), "dd/MM/yy HH:mm", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={key.active}
                          onCheckedChange={() => void toggleKeyActive(key)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => void revokeKey(key.id)}
                        >
                          Revogar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Server className="h-5 w-5" />
                  Endpoints outbound (Valore → ERP)
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  URLs que o Valore chama quando pedidos/requisições mudam no portal
                </p>
              </div>
              <Button size="sm" onClick={() => openEndpointDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Novo endpoint
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Ações</TableHead>
                    <TableHead>Auth</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endpoints.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum endpoint configurado.
                      </TableCell>
                    </TableRow>
                  )}
                  {endpoints.map((ep) => (
                    <TableRow key={ep.id}>
                      <TableCell className="font-medium">{ep.name}</TableCell>
                      <TableCell className="max-w-[200px] truncate font-mono text-xs">
                        {ep.base_url}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {ep.actions.map((a) => (
                            <Badge key={a} variant="outline" className="text-[10px]">
                              {ACTION_LABELS[a] ?? a}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{ep.auth_type}</TableCell>
                      <TableCell>
                        <Badge variant={ep.active ? "default" : "secondary"}>
                          {ep.active ? "Sim" : "Não"}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => openEndpointDialog(ep)}>
                          Editar
                        </Button>
                        {ep.active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => void deactivateEndpoint(ep.id)}
                          >
                            Desativar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog
        open={keyDialogOpen}
        onOpenChange={(open) => {
          setKeyDialogOpen(open)
          if (!open) setRevealedKey(null)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{revealedKey ? "Chave criada" : "Nova API key"}</DialogTitle>
            <DialogDescription>
              {revealedKey
                ? "Copie e guarde em local seguro. Não será possível recuperar depois."
                : "Defina nome e escopos de acesso."}
            </DialogDescription>
          </DialogHeader>

          {revealedKey ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted p-3 font-mono text-xs break-all">{revealedKey}</div>
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  void navigator.clipboard.writeText(revealedKey)
                  toast.success("Copiado!")
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar chave
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="ERP Produção"
                />
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                <Label>Escopos</Label>
                {availableScopes.map((scope) => (
                  <label key={scope} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={keyScopes.includes(scope)}
                      onCheckedChange={() => toggleScope(scope)}
                    />
                    {SCOPE_LABELS[scope] ?? scope}
                  </label>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setKeyDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => void createKey()} disabled={keySaving || !keyName.trim()}>
                  {keySaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={endpointDialogOpen} onOpenChange={setEndpointDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEndpointId ? "Editar endpoint" : "Novo endpoint outbound"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={endpointForm.name}
                onChange={(e) => setEndpointForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>URL base</Label>
              <Input
                value={endpointForm.base_url}
                onChange={(e) => setEndpointForm((f) => ({ ...f, base_url: e.target.value }))}
                placeholder="https://erp.empresa.com/api/valore"
              />
            </div>
            <div className="space-y-2">
              <Label>Autenticação</Label>
              <Select
                value={endpointForm.auth_type}
                onValueChange={(v) =>
                  setEndpointForm((f) => ({ ...f, auth_type: v, auth_config: {} }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  <SelectItem value="bearer">Bearer token</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="api_key_header">API Key (header)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {endpointForm.auth_type === "bearer" && (
              <div className="space-y-2">
                <Label>Token</Label>
                <Input
                  type="password"
                  value={endpointForm.auth_config.token ?? ""}
                  onChange={(e) => setAuthField("token", e.target.value)}
                  placeholder={editingEndpointId ? "Deixe em branco para manter" : ""}
                />
              </div>
            )}
            {endpointForm.auth_type === "basic" && (
              <>
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Input
                    value={endpointForm.auth_config.username ?? ""}
                    onChange={(e) => setAuthField("username", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    value={endpointForm.auth_config.password ?? ""}
                    onChange={(e) => setAuthField("password", e.target.value)}
                  />
                </div>
              </>
            )}
            {endpointForm.auth_type === "api_key_header" && (
              <>
                <div className="space-y-2">
                  <Label>Nome do header</Label>
                  <Input
                    value={endpointForm.auth_config.headerName ?? ""}
                    onChange={(e) => setAuthField("headerName", e.target.value)}
                    placeholder="X-Api-Key"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input
                    type="password"
                    value={endpointForm.auth_config.headerValue ?? ""}
                    onChange={(e) => setAuthField("headerValue", e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Timeout (ms)</Label>
              <Input
                type="number"
                value={endpointForm.timeout_ms}
                onChange={(e) =>
                  setEndpointForm((f) => ({
                    ...f,
                    timeout_ms: Number(e.target.value) || 30000,
                  }))
                }
              />
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto">
              <Label>Ações</Label>
              {OUTBOUND_INTEGRATION_ACTIONS.map((action) => (
                <label key={action} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={endpointForm.actions.includes(action)}
                    onCheckedChange={() => toggleEndpointAction(action)}
                  />
                  {ACTION_LABELS[action] ?? action}
                </label>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={endpointForm.active}
                onCheckedChange={(v) => setEndpointForm((f) => ({ ...f, active: v }))}
              />
              Endpoint ativo
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEndpointDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void saveEndpoint()} disabled={endpointSaving}>
              {endpointSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
