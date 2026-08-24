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

export type CostCenter = {
  id: string
  company_id: string
  code: string
  description: string
  active: boolean
  created_at: string
}

export function CostCentersSettings() {
  const { companyId } = useUser()
  const [items, setItems] = React.useState<CostCenter[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [dialog, setDialog] = React.useState<{
    open: boolean
    mode: "create" | "edit"
    item: CostCenter | null
  }>({ open: false, mode: "create", item: null })
  const [deleteDialog, setDeleteDialog] = React.useState<{
    open: boolean
    item: CostCenter | null
  }>({ open: false, item: null })
  const [form, setForm] = React.useState({
    code: "",
    description: "",
    active: true,
  })

  const load = React.useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("cost_centers")
      .select("id, company_id, code, description, active, created_at")
      .eq("company_id", companyId)
      .order("code", { ascending: true })
    if (error) {
      toast.error(error.message)
      setItems([])
    } else {
      setItems((data ?? []) as CostCenter[])
    }
    setLoading(false)
  }, [companyId])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleSave = async () => {
    if (!companyId) return
    if (!form.code.trim() || !form.description.trim()) {
      toast.error("Preencha código e descrição.")
      return
    }
    const code = form.code.trim().toUpperCase()
    const description = form.description.trim()
    setSaving(true)
    const supabase = createClient()
    try {
      if (dialog.mode === "create") {
        const { data, error } = await supabase
          .from("cost_centers")
          .insert({
            company_id: companyId,
            code,
            description,
            active: form.active,
          })
          .select()
          .single()
        if (error) {
          toast.error("Erro ao salvar: " + error.message)
          return
        }
        setItems((prev) =>
          [...prev, data as CostCenter].sort((a, b) =>
            a.code.localeCompare(b.code),
          ),
        )
      } else if (dialog.item) {
        const { error } = await supabase
          .from("cost_centers")
          .update({ code, description, active: form.active })
          .eq("id", dialog.item.id)
        if (error) {
          toast.error("Erro ao salvar: " + error.message)
          return
        }
        setItems((prev) =>
          prev
            .map((row) =>
              row.id === dialog.item!.id
                ? { ...row, code, description, active: form.active }
                : row,
            )
            .sort((a, b) => a.code.localeCompare(b.code)),
        )
      }
      setDialog((d) => ({ ...d, open: false }))
      toast.success("Centro de custo salvo.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const item = deleteDialog.item
    if (!item) return
    setDeleting(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.from("cost_centers").delete().eq("id", item.id)
      if (error) {
        toast.error("Erro ao excluir: " + error.message)
        return
      }
      setItems((prev) => prev.filter((r) => r.id !== item.id))
      setDeleteDialog({ open: false, item: null })
      toast.success("Centro de custo removido.")
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
              <CardTitle>Centros de Custo</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Cadastre os centros disponíveis para requisições e vínculo obrigatório
                no usuário.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setForm({ code: "", description: "", active: true })
                setDialog({ open: true, mode: "create", item: null })
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo Centro
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
              Nenhum centro cadastrado. Clique em &quot;Novo Centro&quot; para começar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono font-medium">{row.code}</TableCell>
                    <TableCell>{row.description}</TableCell>
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
                              description: row.description,
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog.mode === "create" ? "Novo Centro de Custo" : "Editar Centro de Custo"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="Ex: CC-001"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Ex: Operações SP"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="cc-active">Ativo</Label>
              <Switch
                id="cc-active"
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
            <AlertDialogTitle>Excluir centro de custo</AlertDialogTitle>
            <AlertDialogDescription>
              Remover &quot;{deleteDialog.item?.code}&quot;? Usuários vinculados
              ficarão sem centro padrão.
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
