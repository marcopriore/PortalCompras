'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import MultiSelectFilter from '@/components/ui/multi-select-filter'
import { Info, Search, X } from 'lucide-react'

type Item = {
  id: string
  code: string
  short_description: string
  long_description: string | null
  status: 'active' | 'inactive'
  unit_of_measure: string | null
  ncm: string | null
  commodity_group: string | null
  created_at: string
}

const UNIT_OPTIONS = ['UN', 'KG', 'L', 'M', 'M²', 'M³', 'CX', 'PC', 'HR', 'OUTRO']

export default function ItensPage() {
  const { companyId, loading: userLoading } = useUser()

  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const searchInputRef = useRef<HTMLDivElement>(null)
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [groupFilter, setGroupFilter] = useState<string[]>([])

  const [editOpen, setEditOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [formLongDescription, setFormLongDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const totalItems = items.length
  const activeItems = useMemo(
    () => items.filter((i) => i.status === 'active').length,
    [items],
  )

  const commodityGroups = useMemo(() => {
    const groups = new Set<string>()
    items.forEach((item) => {
      if (item.commodity_group) {
        groups.add(item.commodity_group)
      }
    })
    return Array.from(groups).sort()
  }, [items])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter.length > 0 && !statusFilter.includes(item.status)) {
        return false
      }
      if (groupFilter.length > 0 && (item.commodity_group == null || !groupFilter.includes(item.commodity_group))) {
        return false
      }
      if (!search.trim()) return true
      const q = search.toLowerCase()
      const long = (item.long_description ?? '').toLowerCase()
      return (
        item.code.toLowerCase().includes(q) ||
        item.short_description.toLowerCase().includes(q) ||
        long.includes(q)
      )
    })
  }, [items, statusFilter, groupFilter, search])

  useEffect(() => {
    const fetchItems = async () => {
      if (!companyId) return

      setLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('items')
          .select(
            'id, code, short_description, long_description, status, unit_of_measure, ncm, commodity_group, created_at',
          )
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Erro ao buscar itens:', error)
          toast.error('Erro ao carregar itens.')
          return
        }

        setItems((data as Item[]) ?? [])
      } finally {
        setLoading(false)
      }
    }

    fetchItems()
  }, [companyId])

  const openEdit = (item: Item) => {
    setEditingItem(item)
    setFormLongDescription(item.long_description ?? '')
    setEditOpen(true)
  }

  const handleSaveLongDescription = async () => {
    if (!companyId || !editingItem) return
    setSaving(true)
    try {
      const supabase = createClient()
      const trimmed = formLongDescription.trim()
      const { error } = await supabase
        .from('items')
        .update({ long_description: trimmed || null })
        .eq('id', editingItem.id)
        .eq('company_id', companyId)

      if (error) {
        console.error(error)
        toast.error('Não foi possível salvar a descrição detalhada.')
        return
      }

      setItems((prev) =>
        prev.map((i) =>
          i.id === editingItem.id ? { ...i, long_description: trimmed || null } : i,
        ),
      )
      toast.success('Descrição detalhada salva.')
      setEditOpen(false)
      setEditingItem(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Itens</h1>
          <p className="text-muted-foreground">
            Gerencie o cadastro de materiais
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          Atualizado via integração ERP
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total de Itens</p>
          <p className="mt-2 text-2xl font-semibold">{totalItems}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Itens Ativos</p>
          <p className="mt-2 text-2xl font-semibold">{activeItems}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-col w-full md:max-w-xs">
          <p className="text-xs font-medium text-muted-foreground mb-1 block">
            Buscar
          </p>
          <div ref={searchInputRef} className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:max-w-xs pl-9 pr-8"
            />
            {search.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  ;(searchInputRef.current?.querySelector('input') as HTMLInputElement)?.focus()
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0 border-0 bg-transparent"
                aria-label="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col">
          <p className="text-xs font-medium text-muted-foreground mb-1 block">
            Status
          </p>
          <MultiSelectFilter
            label="Status"
            options={[
              { value: "active", label: "Ativo" },
              { value: "inactive", label: "Inativo" },
            ]}
            selected={statusFilter}
            onChange={setStatusFilter}
            width="w-40"
          />
        </div>
        <div className="flex flex-col">
          <p className="text-xs font-medium text-muted-foreground mb-1 block">
            Grupo de mercadoria
          </p>
          <MultiSelectFilter
            label="Grupo"
            options={commodityGroups.map((g) => ({ value: g, label: g }))}
            selected={groupFilter}
            onChange={setGroupFilter}
            width="w-44"
          />
        </div>
      </div>

      {userLoading || loading ? (
        <p className="text-sm text-muted-foreground">Carregando itens...</p>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          Nenhum item cadastrado.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Descrição Curta</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Unidade</th>
                <th className="px-3 py-2 text-left">NCM</th>
                <th className="px-3 py-2 text-left">Grupo de Mercadoria</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 align-top font-medium">{item.code}</td>
                  <td className="px-3 py-2 align-top">
                    <span className="inline-flex items-start gap-1">
                      <span>{item.short_description}</span>
                      {item.long_description ? (
                        <span title={item.long_description} className="inline-flex shrink-0 mt-0.5">
                          <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Badge variant={item.status === 'active' ? 'default' : 'outline'}>
                      {item.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {item.unit_of_measure ?? '-'}
                  </td>
                  <td className="px-3 py-2 align-top">{item.ncm ?? '-'}</td>
                  <td className="px-3 py-2 align-top">
                    {item.commodity_group ?? '-'}
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(item)}>
                      Detalhes
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setEditingItem(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Item {editingItem?.code ?? ''}</DialogTitle>
          </DialogHeader>
          {editingItem ? (
            <div className="space-y-4">
              <div className="grid gap-1">
                <Label className="text-muted-foreground">Descrição curta</Label>
                <p className="text-sm text-foreground">{editingItem.short_description}</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="long_description">Descrição detalhada</Label>
                <Textarea
                  id="long_description"
                  placeholder="Descrição completa do item sem abreviações..."
                  value={formLongDescription}
                  onChange={(e) => setFormLongDescription(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Descrição completa para uso interno e exibição ao fornecedor.
                </p>
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSaveLongDescription()} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
