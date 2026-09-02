"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pencil, Plus, Trash2 } from "lucide-react"
import type { CompanyBranch } from "@/lib/branches/types"

export function BranchSettings() {
  const { companyId } = useUser()
  const [items, setItems] = React.useState<CompanyBranch[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [dialog, setDialog] = React.useState<{
    open: boolean
    mode: "create" | "edit"
    item: CompanyBranch | null
  }>({ open: false, mode: "create", item: null })
  const [deleteDialog, setDeleteDialog] = React.useState<{
    open: boolean
    item: CompanyBranch | null
  }>({ open: false, item: null })
  const [form, setForm] = React.useState({
    code: "",
    name: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    active: true,
  })

  const load = React.useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("company_branches")
      .select(
        "id, company_id, code, name, address, city, state, zip_code, active, created_at",
      )
      .eq("company_id", companyId)
      .order("code", { ascending: true })
    if (error) {
      toast.error(error.message)
      setItems([])
    } else {
      setItems((data ?? []) as CompanyBranch[])
    }
    setLoading(false)
  }, [companyId])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleSave = async () => {
    if (!companyId) return
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Preencha código e nome do centro / filial.")
      return
    }
    if (!form.address.trim() || !form.city.trim() || !form.state.trim()) {
      toast.error("Preencha endereço, cidade e estado para entrega.")
      return
    }

    const code = form.code.trim().toUpperCase()
    const payload = {
      code,
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim().toUpperCase().slice(0, 2),
      zip_code: form.zip_code.trim() || null,
      active: form.active,
    }

    setSaving(true)
    const supabase = createClient()
    try {
      if (dialog.mode === "create") {
        const { data, error } = await supabase
          .from("company_branches")
          .insert({ company_id: companyId, ...payload })
          .select()
          .single()
        if (error) {
          toast.error("Erro ao salvar: " + error.message)
          return
        }
        setItems((prev) =>
          [...prev, data as CompanyBranch].sort((a, b) => a.code.localeCompare(b.code)),
        )
      } else if (dialog.item) {
        const { error } = await supabase
          .from("company_branches")
          .update(payload)
          .eq("id", dialog.item.id)
        if (error) {
          toast.error("Erro ao salvar: " + error.message)
          return
        }
        setItems((prev) =>
          prev
            .map((row) =>
              row.id === dialog.item!.id ? { ...row, ...payload } : row,
            )
            .sort((a, b) => a.code.localeCompare(b.code)),
        )
      }
      setDialog((d) => ({ ...d, open: false }))
      toast.success("Centro / filial salvo.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const item = deleteDialog.item
    if (!item) return
    if (item.code === "MATRIZ") {
      toast.error("A filial MATRIZ padrão não pode ser excluída.")
      return
    }
    setDeleting(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.from("company_branches").delete().eq("id", item.id)
      if (error) {
        toast.error("Erro ao excluir: " + error.message)
        return
      }
      setItems((prev) => prev.filter((r) => r.id !== item.id))
      setDeleteDialog({ open: false, item: null })
      toast.success("Centro / filial removido.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Centros / Filiais</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Cadastre os locais de entrega. Cada linha de requisição e pedido deve
                apontar para um centro; o endereço do pedido é definido pelo centro.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setForm({
                  code: "",
                  name: "",
                  address: "",
                  city: "",
                  state: "",
                  zip_code: "",
                  active: true,
                })
                setDialog({ open: true, mode: "create", item: null })
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo Centro / Filial
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum centro cadastrado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono font-medium">{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.city ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={row.active ? "default" : "secondary"}>
                        {row.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setForm({
                              code: row.code,
                              name: row.name,
                              address: row.address ?? "",
                              city: row.city ?? "",
                              state: row.state ?? "",
                              zip_code: row.zip_code ?? "",
                              active: row.active,
                            })
                            setDialog({ open: true, mode: "edit", item: row })
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          disabled={row.code === "MATRIZ"}
                          onClick={() => setDeleteDialog({ open: true, item: row })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog.mode === "create" ? "Novo Centro / Filial" : "Editar Centro / Filial"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="Ex: SP-01"
                  className="font-mono"
                  disabled={dialog.mode === "edit" && dialog.item?.code === "MATRIZ"}
                />
              </div>
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Filial São Paulo"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Endereço de entrega *</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Rua, número, complemento"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label>Cidade *</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>UF *</Label>
                <Input
                  value={form.state}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, state: e.target.value.toUpperCase().slice(0, 2) }))
                  }
                  maxLength={2}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input
                value={form.zip_code}
                onChange={(e) => setForm((f) => ({ ...f, zip_code: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="branch-active">Ativo</Label>
              <Switch
                id="branch-active"
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog((d) => ({ ...d, open: false }))}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog((d) => ({ ...d, open, item: open ? d.item : null }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir centro / filial</AlertDialogTitle>
            <AlertDialogDescription>
              Remover &quot;{deleteDialog.item?.code}&quot;? Linhas vinculadas impedem a
              exclusão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
