'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Building2,
  ChevronLeft,
  FileText,
  Package,
} from 'lucide-react'
import { logAudit } from '@/lib/audit'

type QuotationStatus = 'draft' | 'waiting' | 'analysis' | 'completed' | 'cancelled'

interface Quotation {
  id: string
  code: string
  description: string
  status: QuotationStatus
  category: string | null
  payment_condition: string | null
  response_deadline: string | null
  created_at: string
}

interface QuotationItem {
  id: string
  material_code: string
  material_description: string
  unit_of_measure: string | null
  quantity: number
  complementary_spec: string | null
}

interface QuotationSupplier {
  id: string
  supplier_name: string
  supplier_cnpj: string | null
}

const statusConfig: Record<
  QuotationStatus,
  { label: string; variant: 'default' | 'outline' | 'secondary' | 'destructive' | 'success' }
> = {
  draft: { label: 'Rascunho', variant: 'outline' },
  waiting: { label: 'Aguardando Resposta', variant: 'default' },
  analysis: { label: 'Em Análise', variant: 'secondary' },
  completed: { label: 'Concluída', variant: 'success' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
}

type SectionKey = 'general' | 'items' | 'suppliers'

function Section({
  title,
  icon,
  sectionKey,
  open,
  onToggle,
  children,
}: {
  title: string
  icon: React.ReactNode
  sectionKey: SectionKey
  open: boolean
  onToggle: (key: SectionKey) => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => onToggle(sectionKey)}
        className="flex w-full items-center justify-between px-4 py-3 text-base font-medium hover:bg-muted/40 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </div>
        <span
          className={`inline-block text-xs text-muted-foreground transition-transform ${open ? 'rotate-180' : ''
            }`}
        >
          ▾
        </span>
      </button>
      {open && <div className="px-4 pb-4 pt-0">{children}</div>}
    </div>
  )
}

export default function QuotationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id } = use(params)
  const { companyId, userId } = useUser()
  const { hasFeature, hasPermission } = usePermissions()
  void hasFeature

  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [items, setItems] = useState<QuotationItem[]>([])
  const [suppliers, setSuppliers] = useState<QuotationSupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    general: true,
    items: true,
    suppliers: true,
  })
  const [updatingStatus, setUpdatingStatus] = useState<QuotationStatus | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  const toggleSection = (key: SectionKey) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => {
    if (!companyId) return

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const supabase = createClient()

        const { data: quotationData, error: quotationError } = await supabase
          .from('quotations')
          .select(
            'id, code, description, status, category, payment_condition, response_deadline, created_at',
          )
          .eq('id', id)
          .eq('company_id', companyId!)
          .single()

        if (quotationError || !quotationData) {
          setError('Não foi possível carregar a cotação.')
          setLoading(false)
          return
        }

        setQuotation(quotationData)

        const [{ data: itemsData }, { data: suppliersData }] = await Promise.all([
          supabase
            .from('quotation_items')
            .select(
              'id, material_code, material_description, unit_of_measure, quantity, complementary_spec',
            )
            .eq('quotation_id', id),
          supabase
            .from('quotation_suppliers')
            .select('id, supplier_name, supplier_cnpj')
            .eq('quotation_id', id),
        ])

        setItems((itemsData as QuotationItem[]) ?? [])
        setSuppliers((suppliersData as QuotationSupplier[]) ?? [])
      } catch (err) {
        console.error('Erro ao carregar detalhes da cotação:', err)
        setError('Ocorreu um erro ao carregar a cotação.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id, companyId])

  const handleStatusUpdate = async (newStatus: QuotationStatus) => {
    if (!quotation) return

    setUpdatingStatus(newStatus)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase
        .from('quotations')
        .update({ status: newStatus })
        .eq('id', quotation.id)
        .eq('company_id', companyId!)

      if (updateError) {
        toast.error('Não foi possível atualizar o status da cotação.')
        return
      }

      setQuotation({ ...quotation, status: newStatus })

      if (newStatus === 'waiting') {
        toast.success('Cotação enviada com sucesso!')
      } else if (newStatus === 'cancelled') {
        toast.success('Cotação cancelada.')
        await logAudit({
          eventType: 'quotation.cancelled',
          description: `Cotação ${quotation.code} cancelada`,
          companyId: companyId ?? null,
          userId: userId ?? null,
          userName: userId ?? null,
          entity: 'quotations',
          entityId: quotation.id,
          metadata: { code: quotation.code },
        })
      }
    } catch {
      toast.error('Erro ao atualizar o status da cotação.')
    } finally {
      setUpdatingStatus(null)
    }
  }

  const statusBadge =
    quotation &&
    statusConfig[quotation.status] && (
      <Badge variant={statusConfig[quotation.status].variant as any}>
        {statusConfig[quotation.status].label}
      </Badge>
    )

  const handleCancel = async () => {
    await handleStatusUpdate('cancelled')
    setCancelDialogOpen(false)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => router.push('/comprador/cotacoes')}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">
                {quotation ? quotation.code : 'Cotação'}
              </h1>
              {statusBadge}
            </div>
            <p className="text-sm text-muted-foreground">
              Detalhes da solicitação de cotação
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pl-11 sm:pl-0">
          {quotation && quotation.status !== 'cancelled' && quotation.status !== 'completed' && (
            !hasPermission('quotation.cancel') ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive/10"
                      onClick={() => setCancelDialogOpen(true)}
                      disabled
                      title="Sem permissão"
                    >
                      Cancelar Cotação
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Você não tem permissão para esta ação</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => setCancelDialogOpen(true)}
                disabled={updatingStatus !== null}
              >
                Cancelar Cotação
              </Button>
            )
          )}
          {quotation && quotation.status === 'draft' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/comprador/cotacoes/${quotation.id}/editar`)}
              >
                Editar
              </Button>
              <Button
                type="button"
                onClick={() => handleStatusUpdate('waiting')}
                disabled={updatingStatus !== null}
              >
                {updatingStatus === 'waiting' ? 'Enviando...' : 'Enviar Cotação'}
              </Button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando cotação...</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !quotation ? (
        <p className="text-sm text-destructive">Cotação não encontrada.</p>
      ) : (
        <div className="space-y-4">
          {/* Dados Gerais */}
          <Section
            title="Dados gerais"
            icon={<FileText className="h-4 w-4 text-primary" />}
            sectionKey="general"
            open={open.general}
            onToggle={toggleSection}
          >
            <div className="space-y-4 pt-2">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>ID da Cotação</Label>
                  <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                    {quotation.code}
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                  <Label>Descrição</Label>
                  <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                    {quotation.description}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <div className="rounded-md bg-muted/40 px-3 py-2 text-sm flex items-center gap-2">
                    {statusBadge}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                    {quotation.category ?? '-'}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Condição de Pagamento</Label>
                  <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                    {quotation.payment_condition ?? '-'}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Data Limite de Resposta</Label>
                  <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                    {quotation.response_deadline
                      ? new Date(quotation.response_deadline).toLocaleDateString('pt-BR')
                      : '-'}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Data de Criação</Label>
                  <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                    {new Date(quotation.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* Itens */}
          <Section
            title="Itens"
            icon={<Package className="h-4 w-4 text-primary" />}
            sectionKey="items"
            open={open.items}
            onToggle={toggleSection}
          >
            <div className="space-y-3 pt-2">
              {items.length === 0 ? (
                <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  Nenhum item nesta cotação
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-xs text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left">Código</th>
                      <th className="px-2 py-2 text-left">Descrição</th>
                      <th className="px-2 py-2 text-left">Unidade</th>
                      <th className="px-2 py-2 text-left">Quantidade</th>
                      <th className="px-2 py-2 text-left">Especificação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-border last:border-0">
                        <td className="px-2 py-2 align-top font-medium">
                          {item.material_code}
                        </td>
                        <td className="px-2 py-2 align-top">
                          {item.material_description}
                        </td>
                        <td className="px-2 py-2 align-top">
                          {item.unit_of_measure ?? '-'}
                        </td>
                        <td className="px-2 py-2 align-top">{item.quantity}</td>
                        <td className="px-2 py-2 align-top">
                          {item.complementary_spec || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Section>

          {/* Fornecedores */}
          <Section
            title="Fornecedores"
            icon={<Building2 className="h-4 w-4 text-primary" />}
            sectionKey="suppliers"
            open={open.suppliers}
            onToggle={toggleSection}
          >
            <div className="space-y-3 pt-2">
              {suppliers.length === 0 ? (
                <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  Nenhum fornecedor nesta cotação
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-xs text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left">Nome</th>
                      <th className="px-2 py-2 text-left">CNPJ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((s) => (
                      <tr key={s.id} className="border-b border-border last:border-0">
                        <td className="px-2 py-2 align-top">{s.supplier_name}</td>
                        <td className="px-2 py-2 align-top">
                          {s.supplier_cnpj || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Section>
        </div>
      )}

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar cotação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A cotação será marcada como cancelada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancel}
            >
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

