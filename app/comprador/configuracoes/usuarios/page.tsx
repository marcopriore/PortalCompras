'use client'

import * as React from 'react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { logAudit } from '@/lib/audit'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Users,
  UserCheck,
  Search,
  Plus,
  Pencil,
  Copy,
  Check,
  RefreshCw,
  Upload,
  Download,
  ChevronDown,
} from 'lucide-react'

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'buyer', label: 'Comprador' },
  { value: 'manager', label: 'Gestor de Compras' },
  { value: 'approver_requisition', label: 'Aprovador de Requisições' },
  { value: 'approver_order', label: 'Aprovador de Pedidos' },
  { value: 'requester', label: 'Requisitante' },
] as const

type RoleValue = (typeof ROLES)[number]['value']

type Profile = {
  id: string
  full_name: string
  role: string
  roles?: string[] | null
  status: string
  created_at: string
}

type UserForm = {
  fullName: string
  email: string
  roles: string[]
  status: string
}

function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const special = '@#$%&*'
  const all = upper + lower + digits + special
  const rand = (chars: string) =>
    chars[Math.floor(Math.random() * chars.length)]
  const base = [rand(upper), rand(lower), rand(digits), rand(special)]
  for (let i = 0; i < 6; i++) base.push(rand(all))
  return base.sort(() => Math.random() - 0.5).join('')
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
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
]

function getAvatarColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

function getRoleLabel(role: string): string {
  return ROLES.find((r) => r.value === role)?.label ?? role
}

function RolesMultiSelect({
  value,
  onChange,
  disabled,
}: {
  value: string[]
  onChange: (v: string[]) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const toggle = (v: string) => {
    if (value.includes(v)) {
      if (value.length <= 1) return
      onChange(value.filter((r) => r !== v))
    } else {
      onChange([...value, v])
    }
  }

  const triggerText =
    value.length === 0
      ? 'Selecione pelo menos um perfil'
      : value.length === 1
        ? getRoleLabel(value[0])
        : `${value.length} perfis selecionados`

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between gap-2 border rounded-md px-3 py-2 text-sm bg-background',
          'border-border text-foreground',
          value.length === 0 && 'text-muted-foreground',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span className="truncate text-left">{triggerText}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-lg min-w-[200px] py-1 max-h-56 overflow-auto">
          {ROLES.map((r) => {
            const isSelected = value.includes(r.value)
            return (
              <div
                key={r.value}
                role="option"
                onClick={() => toggle(r.value)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/60',
                  isSelected && 'bg-primary/5',
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border',
                    isSelected && 'bg-primary',
                  )}
                >
                  {isSelected ? (
                    <Check className="h-3 w-3 text-primary-foreground" />
                  ) : null}
                </span>
                <span>{r.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function TenantUsersPage() {
  const { userId, companyId, isSuperAdmin, hasRole } = useUser()

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState<UserForm>({
    fullName: '',
    email: '',
    roles: ['buyer'],
    status: 'active',
  })
  const [editForm, setEditForm] = useState<{ roles: string[]; status: string }>({
    roles: ['buyer'],
    status: 'active',
  })
  const [importOpen, setImportOpen] = useState(false)
  const [importStep, setImportStep] = useState<
    'upload' | 'review' | 'importing' | 'done'
  >('upload')
  const [importRows, setImportRows] = useState<
    {
      fullName: string
      email: string
      roles: string[]
      status: string
      valid: boolean
      error?: string
    }[]
  >([])
  const [importProgress, setImportProgress] = useState<{
    current: number
    total: number
  }>({ current: 0, total: 0 })
  const [importErrors, setImportErrors] = useState<
    { email: string; reason: string }[]
  >([])

  useEffect(() => {
    if (!companyId) return
    const fetchProfiles = async () => {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role, roles, status, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
      if (data) setProfiles(data as Profile[])
      setLoading(false)
    }
    fetchProfiles()
  }, [companyId])

  const currentIsAdmin =
    isSuperAdmin || hasRole('admin') || hasRole('manager')

  const filtered = profiles.filter((p) =>
    !search
      ? true
      : p.full_name.toLowerCase().includes(search.toLowerCase()),
  )

  const handleCopy = async () => {
    if (!generatedPassword) return
    await navigator.clipboard.writeText(generatedPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCreate = async () => {
    if (!form.fullName || !form.email || !companyId) return
    if (form.roles.length === 0) return
    if (!generatedPassword) {
      setGeneratedPassword(generatePassword())
    }
    setSubmitting(true)
    try {
      const passwordToUse =
        generatedPassword || generatePassword()

      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: passwordToUse,
          fullName: form.fullName,
          roles: form.roles,
          role: form.roles[0],
          companyId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        // eslint-disable-next-line no-alert
        alert(data.error ?? 'Erro ao criar usuário')
        return
      }

      await logAudit({
        eventType: 'user.created',
        description: `Usuário "${form.fullName}" criado`,
        companyId,
        userId,
        entity: 'profiles',
        entityId: data.userId,
        metadata: { email: form.email, roles: form.roles },
      })

      const supabase = createClient()
      const { data: updated } = await supabase
        .from('profiles')
        .select('id, full_name, role, roles, status, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
      if (updated) setProfiles(updated as Profile[])

      setCreateOpen(false)
      setForm({
        fullName: '',
        email: '',
        roles: ['buyer'],
        status: 'active',
      })
      setGeneratedPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async () => {
    if (!selectedProfile || !companyId || editForm.roles.length === 0) return
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .update({
          role: editForm.roles[0],
          roles: editForm.roles,
          status: editForm.status,
        })
        .eq('id', selectedProfile.id)
        .select('id, role, roles, status')

      if (error) {
        // eslint-disable-next-line no-console
        console.error('Erro ao atualizar perfil:', error)
        return
      }

      if (data && data[0]) {
        const updated = data[0]
        await logAudit({
          eventType: 'user.updated',
          description: `Usuário "${selectedProfile.full_name}" atualizado`,
          companyId,
          userId,
          entity: 'profiles',
          entityId: selectedProfile.id,
          metadata: { roles: editForm.roles, status: editForm.status },
        })

        setProfiles((prev) =>
          prev.map((p) =>
            p.id === selectedProfile.id
              ? {
                  ...p,
                  role: updated.role ?? editForm.roles[0],
                  roles: updated.roles ?? editForm.roles,
                  status: updated.status ?? editForm.status,
                }
              : p,
          ),
        )
        setEditOpen(false)
        setSelectedProfile(null)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadTemplate = async () => {
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()

    // Aba 1 - Importação
    const wsImport = workbook.addWorksheet('Importação')
    wsImport.columns = [
      { header: 'Nome Completo', key: 'fullName', width: 35 },
      { header: 'E-mail', key: 'email', width: 38 },
      { header: 'Perfil', key: 'role', width: 28 },
      { header: 'Status', key: 'status', width: 15 },
    ]

    const headerRow = wsImport.getRow(1)
    headerRow.values = ['Nome Completo', 'E-mail', 'Perfil', 'Status']
    headerRow.height = 22
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' },
      }
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      }
    })

    const exampleRow = wsImport.getRow(2)
    exampleRow.values = [
      'João da Silva',
      'joao@empresa.com.br',
      'buyer,approver_requisition',
      'Ativo',
    ]
    exampleRow.height = 18
    exampleRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F5F5' },
      }
      cell.font = { color: { argb: 'FF333333' }, size: 10 }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      }
    })

    // Linhas 3 a 52
    for (let i = 3; i <= 52; i++) {
      const row = wsImport.getRow(i)
      row.height = 18
      row.eachCell(
        { includeEmpty: true },
        (cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFEEEEEE' } },
            bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } },
            left: { style: 'thin', color: { argb: 'FFEEEEEE' } },
            right: { style: 'thin', color: { argb: 'FFEEEEEE' } },
          }
        },
      )
    }

    // Aba 2 - Instruções
    const wsInstr = workbook.addWorksheet('Instruções')
    wsInstr.columns = [
      { header: '', key: 'col', width: 28 },
      { header: '', key: 'val', width: 65 },
    ]

    const titleRow = wsInstr.getRow(1)
    titleRow.values = ['INSTRUÇÕES DE PREENCHIMENTO']
    titleRow.height = 24
    wsInstr.mergeCells('A1:B1')
    titleRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' },
      }
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })

    // Linha 2 vazia
    wsInstr.getRow(2)

    // Cabeçalho tabela (linha 3)
    const headerInstr = wsInstr.getRow(3)
    headerInstr.values = ['Coluna', 'Valores aceitos']
    headerInstr.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8E8E8' },
      }
      cell.font = { bold: true }
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      }
    })

    // Linhas 4-7
    const instrRows = [
      [
        'Nome Completo',
        'Texto livre, mínimo 3 caracteres. Obrigatório.',
      ],
      ['E-mail', 'E-mail válido. Obrigatório.'],
      [
        'Perfil',
        'Múltiplos perfis separados por vírgula: admin, buyer, manager, approver_requisition, approver_order, requester',
      ],
      ['Status', 'Ativo, Inativo'],
    ]

    instrRows.forEach((vals, idx) => {
      const rowIndex = 4 + idx
      const row = wsInstr.getRow(rowIndex)
      row.values = vals
      const isEven = rowIndex % 2 === 0
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFF9F9F9' : 'FFFFFFFF' },
        }
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        }
      })
    })

    // Linha 8 vazia
    wsInstr.getRow(8)

    // Observações
    const obsRow = wsInstr.getRow(9)
    obsRow.getCell(1).value = 'Observações:'
    obsRow.getCell(1).font = { bold: true }

    const notes = [
      '- Não altere os cabeçalhos da aba Importação',
      '- Preencha a partir da linha 2',
      '- Máximo de 50 usuários por importação',
      '- Campos em branco causarão erro de validação',
    ]
    notes.forEach((text, idx) => {
      const rowIndex = 10 + idx
      const row = wsInstr.getRow(rowIndex)
      row.getCell(1).value = text
      row.getCell(1).font = { color: { argb: 'FF555555' }, size: 10 }
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template_importacao_usuarios.xlsx'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const VALID_ROLE_KEYS = new Set(ROLES.map((r) => r.value))

  const mapLabelToRole = (trimmed: string): RoleValue | null => {
    if (trimmed === 'administrador') return 'admin'
    if (trimmed === 'comprador') return 'buyer'
    if (trimmed === 'gestor de compras') return 'manager'
    if (trimmed === 'aprovador de requisições' || trimmed === 'aprov. requisição')
      return 'approver_requisition'
    if (trimmed === 'aprovador de pedidos' || trimmed === 'aprov. pedido')
      return 'approver_order'
    if (trimmed === 'requisitante') return 'requester'
    if ((VALID_ROLE_KEYS as Set<string>).has(trimmed)) return trimmed as RoleValue
    return null
  }

  const parseRolesFromCell = (value: string): RoleValue[] | null => {
    const parts = value
      .split(/[,;]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    const mapped: RoleValue[] = []
    for (const p of parts) {
      const role = mapLabelToRole(p)
      if (role && VALID_ROLE_KEYS.has(role)) {
        if (!mapped.includes(role)) mapped.push(role)
      } else {
        return null
      }
    }
    return mapped.length > 0 ? mapped : null
  }

  const mapStatus = (value: string): string | null => {
    const trimmed = value.trim().toLowerCase()
    if (trimmed === 'ativo') return 'active'
    if (trimmed === 'inativo') return 'inactive'
    return null
  }

  const validateEmail = (email: string): boolean => {
    // simples validação de e-mail
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    const buffer: ArrayBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = (err) => reject(err)
      reader.readAsArrayBuffer(file)
    })

    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      setImportRows([])
      return
    }

    const parsed: {
      fullName: string
      email: string
      roles: string[]
      status: string
      valid: boolean
      error?: string
    }[] = []

    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber: number) => {
      if (rowNumber === 1) return // cabeçalho

      const fullName = row.getCell(1).text?.trim() ?? ''
      const email = row.getCell(2).text?.trim() ?? ''
      const perfil = row.getCell(3).text?.trim() ?? ''
      const status = row.getCell(4).text?.trim() ?? ''

      if (!fullName && !email && !perfil && !status) {
        return
      }

      let error: string | undefined
      let valid = true

      if (!fullName || fullName.length < 3) {
        valid = false
        error = 'Nome inválido (mínimo 3 caracteres)'
      } else if (!email || !validateEmail(email)) {
        valid = false
        error = 'E-mail inválido'
      } else {
        const mappedRoles = parseRolesFromCell(perfil)
        const mappedStatus = mapStatus(status)
        if (!mappedRoles || mappedRoles.length === 0) {
          valid = false
          error = 'Perfil inválido (use vírgula para múltiplos)'
        } else if (!mappedStatus) {
          valid = false
          error = 'Status inválido'
        }
      }

      const mappedRoles = parseRolesFromCell(perfil) ?? ['buyer']
      const mappedStatus = mapStatus(status) ?? 'active'

      parsed.push({
        fullName,
        email,
        roles: mappedRoles,
        status: mappedStatus,
        valid,
        error,
      })
    })

    setImportRows(parsed)
    setImportStep('review')
  }

  const handleImportUsers = async () => {
    if (!companyId) return
    const validRows = importRows.filter((r) => r.valid)
    if (validRows.length === 0) return

    setImportStep('importing')
    setImportProgress({ current: 0, total: validRows.length })
    setImportErrors([])

    try {
      const payload = {
        users: validRows.map((r) => ({
          email: r.email,
          fullName: r.fullName,
          roles: r.roles,
          role: r.roles[0],
          status: r.status,
          companyId,
        })),
      }

      const res = await fetch('/api/admin/import-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      const createdCount: number = data.created ?? 0
      const errs: { email: string; reason: string }[] = data.errors ?? []

      setImportProgress({ current: createdCount, total: validRows.length })
      setImportErrors(errs)
      setImportStep('done')

      await logAudit({
        eventType: 'user.created',
        description: `Importação em massa: ${createdCount} usuários criados`,
        companyId,
        userId,
        entity: 'profiles',
        entityId: null,
        metadata: { created: createdCount, total: validRows.length },
      })

      // recarregar lista de perfis
      const supabase = createClient()
      const { data: updated } = await supabase
        .from('profiles')
        .select('id, full_name, role, roles, status, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
      if (updated) setProfiles(updated as Profile[])
    } catch {
      setImportStep('done')
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Cards de métricas */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl p-5 flex items-center gap-4 border border-blue-100 bg-blue-50">
          <div className="rounded-full bg-blue-100 p-3 flex items-center justify-center">
            <Users className="w-7 h-7 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-blue-600 font-medium">
              Total de Usuários
            </p>
            <p className="text-3xl font-bold text-blue-700">
              {profiles.length}
            </p>
          </div>
        </div>
        <div className="rounded-xl p-5 flex items-center gap-4 border border-green-100 bg-green-50">
          <div className="rounded-full bg-green-100 p-3 flex items-center justify-center">
            <UserCheck className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-green-600 font-medium">
              Usuários Ativos
            </p>
            <p className="text-3xl font-bold text-green-700">
              {profiles.filter((p) => p.status === 'active').length}
            </p>
          </div>
        </div>
      </div>

      {/* Cabeçalho da seção */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Usuários
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os acessos ao sistema
          </p>
        </div>
        {currentIsAdmin && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setImportStep('upload')
                setImportRows([])
                setImportErrors([])
                setImportProgress({ current: 0, total: 0 })
                setImportOpen(true)
              }}
            >
              <Upload className="mr-2 h-4 w-4" />
              Importar Usuários
            </Button>
            <Button
              type="button"
              onClick={() => {
                setGeneratedPassword(generatePassword())
                setCreateOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo Usuário
            </Button>
          </div>
        )}
      </div>

      {/* Barra de busca */}
      <div className="bg-muted/40 border border-border rounded-xl p-3 flex items-center gap-2 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
        />
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Carregando usuários...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
            Nenhum usuário encontrado.
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data de Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((profile) => (
                <TableRow
                  key={profile.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="px-3 py-2 align-top">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{
                          backgroundColor: getAvatarColor(profile.full_name),
                        }}
                      >
                        {getInitials(profile.full_name)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {profile.full_name}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top">
                    <div className="flex flex-wrap gap-1">
                      {(profile.roles ?? (profile.role ? [profile.role] : [])).map(
                        (r) => (
                          <Badge
                            key={r}
                            variant="secondary"
                            className="text-xs font-normal"
                          >
                            {getRoleLabel(r)}
                          </Badge>
                        ),
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top">
                    {profile.status === 'active' ? (
                      <Badge className="bg-green-100 text-green-800">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top text-sm text-muted-foreground">
                    {format(new Date(profile.created_at), 'dd/MM/yyyy', {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top text-right">
                    {currentIsAdmin && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          setSelectedProfile(profile)
                          setEditForm({
                            roles:
                              profile.roles ?? (profile.role ? [profile.role] : ['buyer']),
                            status: profile.status,
                          })
                          setEditOpen(true)
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Editar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog Novo Usuário */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados e compartilhe a senha gerada com o usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nome Completo *</Label>
              <Input
                value={form.fullName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fullName: e.target.value }))
                }
                placeholder="Ex: João da Silva"
              />
            </div>
            <div>
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="joao@empresa.com.br"
              />
            </div>
            <div>
              <Label>Perfis *</Label>
              <RolesMultiSelect
                value={form.roles}
                onChange={(v) => setForm((f) => ({ ...f, roles: v }))}
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Selecione pelo menos um perfil
              </p>
            </div>
            <div>
              <Label>Senha Gerada</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={generatedPassword}
                  readOnly
                  className="font-mono text-sm bg-muted"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0 gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setGeneratedPassword(generatePassword())}
                  className="shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Compartilhe esta senha com o usuário. Ela não poderá ser
                recuperada depois.
              </p>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={
                submitting ||
                !form.fullName ||
                !form.email ||
                form.roles.length === 0 ||
                !companyId
              }
            >
              {submitting ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Usuário */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              {selectedProfile?.full_name ?? ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Perfis *</Label>
              <RolesMultiSelect
                value={editForm.roles}
                onChange={(v) => setEditForm((f) => ({ ...f, roles: v }))}
                disabled={submitting}
              />
            </div>
            <div>
              <Label>Status</Label>
              <select
                value={editForm.status}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, status: e.target.value }))
                }
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleEdit}
              disabled={
                submitting || !selectedProfile || editForm.roles.length === 0
              }
            >
              {submitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Importar Usuários */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Importar Usuários em Massa</DialogTitle>
            <DialogDescription>
              {importStep === 'upload' && 'Passo 1 de 3 — Upload'}
              {importStep === 'review' && 'Passo 2 de 3 — Revisão'}
              {importStep === 'importing' && 'Passo 3 de 3 — Importando'}
              {importStep === 'done' && 'Importação concluída'}
            </DialogDescription>
          </DialogHeader>

          {importStep === 'upload' && (
            <div className="space-y-4 mt-2">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Faça download do modelo e preencha os dados dos usuários.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  className="gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar Planilha Modelo
                </Button>
              </div>

              <label className="mt-2 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/40 px-6 py-10 text-center cursor-pointer">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">
                  Arraste um arquivo aqui ou clique para selecionar
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          )}

          {importStep === 'review' && (
            <div className="space-y-4 mt-2">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {importRows.filter((r) => r.valid).length} usuários válidos /{' '}
                  {importRows.filter((r) => !r.valid).length} inválidos
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card max-h-80 overflow-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importRows.map((row, idx) => (
                      <TableRow key={`${row.email}-${idx}`}>
                        <TableCell className="text-sm">
                          {row.fullName}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.email}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex flex-wrap gap-1">
                            {row.roles.map((r) => (
                              <Badge
                                key={r}
                                variant="secondary"
                                className="text-xs font-normal"
                              >
                                {getRoleLabel(r)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.status === 'active' ? 'Ativo' : 'Inativo'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.valid ? (
                            <Badge className="bg-green-100 text-green-800">
                              Válido
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              Inválido{row.error ? `: ${row.error}` : ''}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter className="mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setImportStep('upload')}
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  onClick={handleImportUsers}
                  disabled={
                    importRows.filter((r) => r.valid).length === 0 ||
                    !companyId
                  }
                >
                  Importar{' '}
                  {importRows.filter((r) => r.valid).length} usuários
                </Button>
              </DialogFooter>
            </div>
          )}

          {importStep === 'importing' && (
            <div className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Importando usuários... Isso pode levar alguns segundos.
              </p>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-2 bg-primary transition-all"
                  style={{
                    width:
                      importProgress.total > 0
                        ? `${
                            (importProgress.current /
                              importProgress.total) *
                            100
                          }%`
                        : '0%',
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {importProgress.current} de {importProgress.total} usuários
                criados
              </p>
            </div>
          )}

          {importStep === 'done' && (
            <div className="space-y-4 mt-4">
              <p className="text-sm text-foreground">
                {importProgress.current} usuários criados com sucesso.
              </p>
              {importErrors.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-3 max-h-60 overflow-auto">
                  <p className="text-sm font-medium mb-2">
                    Erros durante a importação:
                  </p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {importErrors.map((err, idx) => (
                      <li key={`${err.email}-${idx}`}>
                        <span className="font-medium">{err.email}:</span>{' '}
                        {err.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => {
                    setImportOpen(false)
                  }}
                >
                  Concluir
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

