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

export type Category = {
  id: string
  company_id: string
  code: string
  name: string
  active: boolean
  created_at: string
}

function slugCode(name: string): string {
  return name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase()
    .slice(0, 40)
}

export function CategoriesSettings() {
  const { companyId } = useUser()
  const [items, setItems] = React.useState<Category[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [dialog, setDialog] = React.useState<{
    open: boolean
    mode: "create" | "edit"
    item: Category | null
  }>({ open: false, mode: "create", item: null })
  const [deleteDialog, setDeleteDialog] = React.useState<{
    open: boolean
    item: Category | null
  }>({ open: false, item: null })
  const [form, setForm] = React.useState({
    code: "",
    name: "",
    active: true,
  })

  const load = React.useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("categories")
      .select("id, company_id, code, name, active, created_at")
      .eq("company_id", companyId)
      .order("name", { ascending: true })
    if (error) {
      toast.error(error.message)
      setItems([])
    } else {
      setItems((data ?? []) as Category[])
    }
    setLoading(false)
  }, [companyId])

  React.useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setForm({ code: "", name: "", active: true })
    setDialog({ open: true, mode: "create", item: null })
  }

  const openEdit = (item: Category) => {
    setForm({
      code: item.code,
      name: item.name,
      active: item.active,
    })
    setDialog({ open: true, mode: "edit", item })
  }

  const handleSave = async () => {
    if (!companyId) return
    if (!form.name.trim()) {
      toast.error("Informe o nome da categoria.")
      return
    }
    const name = form.name.trim()
    const code = (form.code.trim() || slugCode(name)).toUpperCase()
    if (!code) {
      toast.error("Informe um código válido.")
      return
    }

    setSaving(true)
    const supabase = createClient()
    try {
      if (dialog.mode === "create") {
        const { error } = await supabase.from("categories").insert({
          company_id: companyId,
          code,
          name,
          active: form.active,
        })
        if (error) {
          toast.error(
            error.code === "23505"
              ? "Já existe categoria com este código."
              : error.message,
          )
          return
        }
        toast.success("Categoria criada.")
      } else if (dialog.item) {
        const { error } = await supabase
          .from("categories")
          .update({
            code,
            name,
            active: form.active,
          })
          .eq("id", dialog.item.id)
          .eq("company_id", companyId)
        if (error) {
          toast.error(
            error.code === "23505"
              ? "Já existe categoria com este código."
              : error.message,
          )
          return
        }
        toast.success("Categoria atualizada.")
      }
      setDialog({ open: false, mode: "create", item: null })
      await load()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!companyId || !deleteDialog.item) return
    setDeleting(true)
    const supabase = createClient()
    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", deleteDialog.item.id)
        .eq("company_id", companyId)
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success("Categoria excluída.")
      setDeleteDialog({ open: false, item: null })
      await load()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Categorias</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastro único do tenant para itens (`commodity_group`) e
              fornecedores (categorias atendidas). Alinhe ao ERP na implantação.
            </p>
          </div>
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nova categoria
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma categoria cadastrada. Crie as categorias usadas no ERP
              antes de vincular itens e fornecedores.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.code}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant={item.active ? "default" : "secondary"}>
                        {item.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() =>
                            setDeleteDialog({ open: true, item })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
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
        onOpenChange={(o) =>
          !o && setDialog({ open: false, mode: "create", item: null })
        }
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog.mode === "create" ? "Nova categoria" : "Editar categoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nome</Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value
                  setForm((f) => ({
                    ...f,
                    name,
                    code:
                      dialog.mode === "create" && !f.code
                        ? slugCode(name)
                        : f.code,
                  }))
                }}
                placeholder="Ex: TI & Informática"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-code">Código</Label>
              <Input
                id="cat-code"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    code: e.target.value.toUpperCase().slice(0, 40),
                  }))
                }
                placeholder="Ex: TI_INFORMATICA"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Use o mesmo código do ERP quando houver. Único por tenant.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label htmlFor="cat-active">Ativa</Label>
              <Switch
                id="cat-active"
                checked={form.active}
                onCheckedChange={(active) => setForm((f) => ({ ...f, active }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog({ open: false, mode: "create", item: null })}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(o) => !o && setDeleteDialog({ open: false, item: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria {deleteDialog.item?.name} será removida do cadastro.
              Itens/fornecedores que já usam o nome em texto não são alterados
              automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
