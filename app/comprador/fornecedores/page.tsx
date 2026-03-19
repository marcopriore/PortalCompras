'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import MultiSelectFilter from '@/components/ui/multi-select-filter'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Building2, CheckCircle2, Mail, Phone, Search, SearchX, X } from 'lucide-react'

type SupplierStatus = 'active' | 'inactive'

type Supplier = {
  id: string
  code: string
  name: string
  cnpj: string | null
  email: string | null
  phone: string | null
  category: string | null
  city: string | null
  state: string | null
  status: SupplierStatus
  created_at: string
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

const AVATAR_COLORS = [
  '#4f46e5',
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#db2777',
  '#0284c7',
] as const

function getAvatarColor(name: string): string {
  const index = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

export default function FornecedoresPage() {
  const { companyId, loading: userLoading } = useUser()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const searchInputRef = useRef<HTMLDivElement>(null)
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)

  useEffect(() => {
    const fetchSuppliers = async () => {
      if (!companyId) return

      setLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('suppliers')
          .select(
            'id, code, name, cnpj, email, phone, category, city, state, status, created_at',
          )
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Erro ao buscar fornecedores:', error)
          toast.error('Erro ao carregar fornecedores.')
          return
        }

        setSuppliers((data as Supplier[]) ?? [])
      } finally {
        setLoading(false)
      }
    }

    fetchSuppliers()
  }, [companyId])

  const categories = useMemo(() => {
    const set = new Set<string>()
    suppliers.forEach((s) => {
      if (s.category) {
        set.add(s.category)
      }
    })
    return Array.from(set).sort()
  }, [suppliers])

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const matchSearch =
        !search ||
        s.code.toLowerCase().includes(search.toLowerCase()) ||
        s.name.toLowerCase().includes(search.toLowerCase())

      const matchCategory = categoryFilter.length === 0 || (s.category != null && categoryFilter.includes(s.category))
      const matchStatus = statusFilter.length === 0 || statusFilter.includes(s.status)

      return matchSearch && matchCategory && matchStatus
    })
  }, [suppliers, search, categoryFilter, statusFilter])

  return (
    <div className="space-y-6">
      {/* Cards de métricas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
        <div className="rounded-xl p-5 flex items-center gap-4 border border-blue-100 bg-blue-50">
          <div className="rounded-full bg-blue-100 p-3 flex items-center justify-center">
            <Building2 className="w-7 h-7 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-blue-600 font-medium">Total de Fornecedores</p>
            <p className="text-3xl font-bold text-blue-700">{suppliers.length}</p>
          </div>
        </div>
        <div className="rounded-xl p-5 flex items-center gap-4 border border-green-100 bg-green-50">
          <div className="rounded-full bg-green-100 p-3 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-green-600 font-medium">Fornecedores Ativos</p>
            <p className="text-3xl font-bold text-green-700">
              {suppliers.filter((s) => s.status === 'active').length}
            </p>
          </div>
        </div>
      </div>

      {/* Cabeçalho da lista */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Lista de Fornecedores</h2>
          <p className="text-sm text-muted-foreground">
            Base sincronizada via ERP. Somente leitura.
          </p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1">
          {filteredSuppliers.length} fornecedor
          {filteredSuppliers.length !== 1 ? 'es' : ''}
        </Badge>
      </div>

      {/* Barra de filtros */}
      <div className="bg-muted/40 border border-border rounded-xl p-4 mb-4 flex flex-wrap gap-3">
        <div className="flex flex-col w-full md:max-w-sm">
          <p className="text-xs font-medium text-muted-foreground mb-1 block">
            Buscar
          </p>
          <div ref={searchInputRef} className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou nome do fornecedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8"
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
            Categoria
          </p>
          <MultiSelectFilter
            label="Categoria"
            options={categories.map((c) => ({ value: c, label: c }))}
            selected={categoryFilter}
            onChange={setCategoryFilter}
            width="w-44"
          />
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
      </div>

      {/* Estados especiais e tabela */}
      {userLoading || loading ? (
        <p className="text-sm text-muted-foreground">Carregando fornecedores...</p>
      ) : suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          <Building2 className="h-8 w-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Nenhum fornecedor cadastrado.</p>
            <p className="text-xs text-muted-foreground">
              Os fornecedores são sincronizados via ERP.
            </p>
          </div>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          <SearchX className="h-8 w-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Nenhum fornecedor encontrado.</p>
            <p className="text-xs text-muted-foreground">
              Ajuste os filtros ou a busca para ver outros resultados.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-3 py-2">Código ERP</TableHead>
                <TableHead className="px-3 py-2">Fornecedor</TableHead>
                <TableHead className="px-3 py-2">Categoria</TableHead>
                <TableHead className="px-3 py-2">Localização</TableHead>
                <TableHead className="px-3 py-2">Status</TableHead>
                <TableHead className="px-3 py-2 text-center">Pedidos</TableHead>
                <TableHead className="px-3 py-2 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((s) => (
                <TableRow
                  key={s.id}
                  className="border-border hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="px-3 py-2 align-top font-mono text-sm text-muted-foreground">
                    {s.code}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: getAvatarColor(s.name) }}
                      >
                        {getInitials(s.name)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.cnpj || '-'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top text-muted-foreground">
                    {s.category || '-'}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top text-muted-foreground">
                    {s.city && s.state ? `${s.city}, ${s.state}` : s.city || s.state || '-'}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top">
                    <Badge
                      variant={s.status === 'active' ? 'default' : 'destructive'}
                      className={
                        s.status === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : undefined
                      }
                    >
                      {s.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top text-center text-sm text-muted-foreground">
                    —
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => setSelectedSupplier(s)}
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Contatos
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selectedSupplier} onOpenChange={() => setSelectedSupplier(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedSupplier?.name ?? 'Contatos do fornecedor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="flex items-center gap-2 text-foreground">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{selectedSupplier?.email || 'E-mail não informado'}</span>
            </div>
            <div className="flex items-center gap-2 text-foreground">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{selectedSupplier?.phone || 'Telefone não informado'}</span>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedSupplier(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

