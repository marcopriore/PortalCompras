"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { logAudit } from "@/lib/audit"
import { toast } from "sonner"
import * as XLSX from "xlsx"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import {
  Bell,
  Building2,
  ClipboardList,
  Download,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Save,
  Shield,
  ShieldOff,
  ShoppingCart,
  Trash2,
  Upload,
  Settings2,
  User,
  Workflow,
} from "lucide-react"

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type CompanyForm = {
  name: string
  trade_name: string
  cnpj: string
  state_reg: string
  address: string
  city: string
  state: string
  zip_code: string
  logo_url: string | null
}

type ProfileForm = {
  full_name: string
  job_title: string
  department: string
  phone: string
  avatar_url: string | null
}

type NotificationForm = {
  new_requisition: boolean
  quotation_received: boolean
  order_approved: boolean
  delivery_done: boolean
  daily_summary: boolean
  new_requisition_bell: boolean
  new_requisition_email: boolean
  quotation_received_bell: boolean
  quotation_received_email: boolean
  order_accepted_bell: boolean
  order_accepted_email: boolean
  order_refused_bell: boolean
  order_refused_email: boolean
  order_approved_bell: boolean
  order_approved_email: boolean
  delivery_done_bell: boolean
  delivery_done_email: boolean
  daily_summary_bell: boolean
  daily_summary_email: boolean
}

function defaultNotificationForm(): NotificationForm {
  return {
    new_requisition: true,
    quotation_received: true,
    order_approved: true,
    delivery_done: true,
    daily_summary: false,
    new_requisition_bell: true,
    new_requisition_email: false,
    quotation_received_bell: true,
    quotation_received_email: false,
    order_accepted_bell: true,
    order_accepted_email: false,
    order_refused_bell: true,
    order_refused_email: false,
    order_approved_bell: true,
    order_approved_email: false,
    delivery_done_bell: true,
    delivery_done_email: false,
    daily_summary_bell: false,
    daily_summary_email: false,
  }
}

function notificationFormFromRow(raw: Record<string, unknown>): NotificationForm {
  const n = raw
  const legNewReq = Boolean(n.new_requisition ?? true)
  const legQuot = Boolean(n.quotation_received ?? true)
  const legOrdApp = Boolean(n.order_approved ?? true)
  const legDel = Boolean(n.delivery_done ?? true)
  const legDaily = Boolean(n.daily_summary ?? false)
  return {
    new_requisition: legNewReq,
    quotation_received: legQuot,
    order_approved: legOrdApp,
    delivery_done: legDel,
    daily_summary: legDaily,
    new_requisition_bell: Boolean(n.new_requisition_bell ?? legNewReq),
    new_requisition_email: Boolean(n.new_requisition_email ?? false),
    quotation_received_bell: Boolean(n.quotation_received_bell ?? legQuot),
    quotation_received_email: Boolean(n.quotation_received_email ?? false),
    order_accepted_bell: Boolean(n.order_accepted_bell ?? true),
    order_accepted_email: Boolean(n.order_accepted_email ?? false),
    order_refused_bell: Boolean(n.order_refused_bell ?? true),
    order_refused_email: Boolean(n.order_refused_email ?? false),
    order_approved_bell: Boolean(n.order_approved_bell ?? legOrdApp),
    order_approved_email: Boolean(n.order_approved_email ?? false),
    delivery_done_bell: Boolean(n.delivery_done_bell ?? legDel),
    delivery_done_email: Boolean(n.delivery_done_email ?? false),
    daily_summary_bell: Boolean(n.daily_summary_bell ?? false),
    daily_summary_email: Boolean(n.daily_summary_email ?? legDaily),
  }
}

const notificationTypes: {
  key: string
  label: string
  description: string
  bellKey: keyof NotificationForm
  emailKey: keyof NotificationForm
}[] = [
  {
    key: "new_requisition",
    label: "Nova Requisição",
    description: "Quando uma nova requisição for criada",
    bellKey: "new_requisition_bell",
    emailKey: "new_requisition_email",
  },
  {
    key: "quotation_received",
    label: "Proposta Recebida",
    description: "Quando um fornecedor enviar uma proposta",
    bellKey: "quotation_received_bell",
    emailKey: "quotation_received_email",
  },
  {
    key: "order_accepted",
    label: "Pedido Aceito",
    description: "Quando um fornecedor aceitar um pedido",
    bellKey: "order_accepted_bell",
    emailKey: "order_accepted_email",
  },
  {
    key: "order_refused",
    label: "Pedido Recusado",
    description: "Quando um fornecedor recusar um pedido",
    bellKey: "order_refused_bell",
    emailKey: "order_refused_email",
  },
  {
    key: "order_approved",
    label: "Pedido Aprovado",
    description: "Quando um pedido for aprovado no fluxo de aprovação",
    bellKey: "order_approved_bell",
    emailKey: "order_approved_email",
  },
  {
    key: "delivery_done",
    label: "Entrega Realizada",
    description: "Quando uma entrega for confirmada",
    bellKey: "delivery_done_bell",
    emailKey: "delivery_done_email",
  },
  {
    key: "daily_summary",
    label: "Resumo Diário",
    description: "Receba um resumo diário das atividades por e-mail",
    bellKey: "daily_summary_bell",
    emailKey: "daily_summary_email",
  },
]

type SecurityPasswordForm = {
  currentPassword: string
  newPassword: string
  confirmNewPassword: string
}

type ApprovalRule = {
  id: string
  flow: "requisition" | "order"
  cost_center: string | null
  category: string | null
  min_value: number | null
  max_value: number | null
  approver_id: string | null
  approver_name: string | null
}

type ApproverProfile = {
  id: string
  full_name: string | null
  role: string | null
  roles?: string[] | null
}

type ApprovalRuleForm = {
  costCenter: string
  useFallback: boolean
  approverId: string
}

type ApprovalOrderForm = {
  category: string
  useAllCategories: boolean
  minValue: string
  maxValue: string
  useNoMax: boolean
  approverId: string
}

type ActiveTab =
  | "empresa"
  | "perfil"
  | "notificacoes"
  | "aprovacoes"
  | "seguranca"
  | "campos"

type PaymentCondition = {
  id: string
  company_id: string
  code: string
  description: string
  active: boolean
  created_at: string
}

function maskCNPJ(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
}

function formatPhoneBR(value: string): string {
  const digits = value.replace(/\D/g, "")
  if (digits.length < 3) return digits
  const dd = digits.slice(0, 2)
  const rest = digits.slice(2)

  if (rest.length <= 8) {
    // Fixo: XXXX-XXXX
    const first = rest.slice(0, 4)
    const second = rest.slice(4, 8)
    return `(${dd}) ${first}${second ? `-${second}` : ""}`
  }

  // Celular: 9XXXX-XXXX
  const first = rest.slice(0, 5)
  const second = rest.slice(5, 9)
  return `(${dd}) ${first}${second ? `-${second}` : ""}`
}

const AVATAR_COLORS = [
  "#4f46e5",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#db2777",
  "#0284c7",
] as const

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")
}

function getAvatarColor(name: string): string {
  const index = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

export default function ConfiguracoesPage() {
  const router = useRouter()
  const { companyId, userId, isSuperAdmin, hasRole, loading: userLoading } = useUser()
  const [activeTab, setActiveTab] = React.useState<ActiveTab>("empresa")

  const canManageCompany = Boolean(isSuperAdmin || hasRole("admin"))
  const canManageApprovals = canManageCompany

  const [authEmail, setAuthEmail] = React.useState<string | null>(null)

  const [companyForm, setCompanyForm] = React.useState<CompanyForm>({
    name: "",
    trade_name: "",
    cnpj: "",
    state_reg: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    logo_url: null,
  })
  const [profileForm, setProfileForm] = React.useState<ProfileForm>({
    full_name: "",
    job_title: "",
    department: "",
    phone: "",
    avatar_url: null,
  })
  const [logoUploading, setLogoUploading] = React.useState(false)
  const [avatarUploading, setAvatarUploading] = React.useState(false)
  const [notifForm, setNotifForm] = React.useState<NotificationForm>(() => defaultNotificationForm())
  const [notifExists, setNotifExists] = React.useState(false)

  const [securityForm, setSecurityForm] = React.useState<SecurityPasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  })
  const [securitySaving, setSecuritySaving] = React.useState(false)
  const [securitySuccess, setSecuritySuccess] = React.useState<string | null>(null)
  const [securityError, setSecurityError] = React.useState<string | null>(null)

  const [mfaEnabled, setMfaEnabled] = React.useState(false)
  const [mfaLoading, setMfaLoading] = React.useState(false)
  const [mfaStep, setMfaStep] = React.useState<"idle" | "setup" | "verify" | "disable">("idle")
  const [mfaQR, setMfaQR] = React.useState<string | null>(null)
  const [mfaSecret, setMfaSecret] = React.useState<string | null>(null)
  const [mfaFactorId, setMfaFactorId] = React.useState<string | null>(null)
  const [mfaCode, setMfaCode] = React.useState("")
  const [mfaError, setMfaError] = React.useState<string | null>(null)
  const [mfaSuccess, setMfaSuccess] = React.useState<string | null>(null)

  const { hasFeature } = usePermissions()

  const [approvalRequisitionEnabled, setApprovalRequisitionEnabled] = React.useState(false)
  const [approvalOrderEnabled, setApprovalOrderEnabled] = React.useState(false)
  const [approvalRules, setApprovalRules] = React.useState<ApprovalRule[]>([])
  const [approvalOrderRules, setApprovalOrderRules] = React.useState<ApprovalRule[]>([])
  const [approversRequisition, setApproversRequisition] = React.useState<ApproverProfile[]>([])
  const [approversOrder, setApproversOrder] = React.useState<ApproverProfile[]>([])
  const [tenantCategories, setTenantCategories] = React.useState<string[]>([])
  const [ruleModalOpen, setRuleModalOpen] = React.useState(false)
  const [editingRuleId, setEditingRuleId] = React.useState<string | null>(null)
  const [ruleForm, setRuleForm] = React.useState<ApprovalRuleForm>({
    costCenter: "",
    useFallback: false,
    approverId: "",
  })
  const [orderModalOpen, setOrderModalOpen] = React.useState(false)
  const [editingOrderId, setEditingOrderId] = React.useState<string | null>(null)
  const [orderForm, setOrderForm] = React.useState<ApprovalOrderForm>({
    category: "",
    useAllCategories: false,
    minValue: "",
    maxValue: "",
    useNoMax: false,
    approverId: "",
  })
  const [deleteRuleId, setDeleteRuleId] = React.useState<string | null>(null)
  const [approvalsSaving, setApprovalsSaving] = React.useState(false)

  const [saving, setSaving] = React.useState({
    company: false,
    profile: false,
    notifications: false,
    approvals: false,
  })
  const [messages, setMessages] = React.useState<{
    company: { success: string | null; error: string | null }
    profile: { success: string | null; error: string | null }
    notifications: { success: string | null; error: string | null }
    approvals: { success: string | null; error: string | null }
  }>({
    company: { success: null, error: null },
    profile: { success: null, error: null },
    notifications: { success: null, error: null },
    approvals: { success: null, error: null },
  })

  const [loading, setLoading] = React.useState(true)

  const [paymentConditions, setPaymentConditions] = React.useState<PaymentCondition[]>([])
  const [loadingConditions, setLoadingConditions] = React.useState(false)
  const [conditionDialog, setConditionDialog] = React.useState<{
    open: boolean
    mode: "create" | "edit"
    item: PaymentCondition | null
  }>({ open: false, mode: "create", item: null })
  const [conditionForm, setConditionForm] = React.useState({
    code: "",
    description: "",
    active: true,
  })
  const [savingCondition, setSavingCondition] = React.useState(false)
  const [deleteConditionDialog, setDeleteConditionDialog] = React.useState<{
    open: boolean
    item: PaymentCondition | null
  }>({ open: false, item: null })
  const [deletingCondition, setDeletingCondition] = React.useState(false)
  const importInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const run = async () => {
      if (userLoading || !companyId || !userId) return
      setLoading(true)
      try {
        const supabase = createClient()

        const { data: authUser } = await supabase.auth.getUser()
        if (authUser?.user?.email) setAuthEmail(authUser.user.email)

        const [profileRes, companyRes, notifRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).single(),
          supabase.from("companies").select("*").eq("id", companyId).single(),
          supabase
            .from("notification_preferences")
            .select("*")
            .eq("user_id", userId)
            .eq("company_id", companyId)
            .maybeSingle(),
        ])

        if (profileRes.data) {
          const p = profileRes.data as any
          setProfileForm({
            full_name: p.full_name ?? "",
            job_title: p.job_title ?? "",
            department: p.department ?? "",
            phone: p.phone ?? "",
            avatar_url: p.avatar_url ?? null,
          })
        }

        if (companyRes.data) {
          const c = companyRes.data as any
          setCompanyForm({
            name: c.name ?? "",
            trade_name: c.trade_name ?? "",
            cnpj: c.cnpj ? String(c.cnpj) : "",
            state_reg: c.state_reg ?? "",
            address: c.address ?? "",
            city: c.city ?? "",
            state: c.state ?? "",
            zip_code: c.zip_code ?? "",
            logo_url: c.logo_url ?? null,
          })
        }

        if (notifRes.data) {
          setNotifForm(notificationFormFromRow(notifRes.data as Record<string, unknown>))
          setNotifExists(true)
        } else {
          setNotifForm(defaultNotificationForm())
          setNotifExists(false)
        }

        const { data: factorsData } = await supabase.auth.mfa.listFactors()
        const fd = factorsData as {
          totp?: { id: string; factor_type?: string; status?: string }[]
          all?: { id: string; factor_type?: string; status?: string }[]
        } | null
        const factorList =
          fd?.totp && fd.totp.length > 0 ? fd.totp : (fd?.all ?? [])
        const totpFactor = factorList.find(
          (f) =>
            String(f.factor_type ?? "").toLowerCase() === "totp" &&
            f.status === "verified",
        )
        setMfaEnabled(!!totpFactor)
        if (totpFactor) setMfaFactorId(totpFactor.id)
        else setMfaFactorId(null)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [companyId, userId, userLoading])

  React.useEffect(() => {
    const loadApprovals = async () => {
      if (userLoading || !companyId || !canManageApprovals || activeTab !== "aprovacoes") return
      const supabase = createClient()
      const [tfRes, levelsRes] = await Promise.all([
        supabase
          .from("tenant_features")
          .select("feature_key, enabled")
          .eq("company_id", companyId)
          .in("feature_key", ["approval_requisition", "approval_order"]),
        supabase
          .from("approval_levels")
          .select("id, flow, cost_center, category, min_value, max_value, approver_id, approver_name")
          .eq("company_id", companyId),
      ])
      const tfData = (tfRes.data ?? []) as { feature_key: string; enabled: boolean }[]
      tfData.forEach((row) => {
        if (row.feature_key === "approval_requisition") setApprovalRequisitionEnabled(Boolean(row.enabled))
        if (row.feature_key === "approval_order") setApprovalOrderEnabled(Boolean(row.enabled))
      })
      const levels = ((levelsRes.data ?? []) as ApprovalRule[]).map((r) => ({
        ...r,
        flow: (r.flow ?? "requisition") as "requisition" | "order",
      }))
      setApprovalRules(levels.filter((l) => l.flow === "requisition"))
      setApprovalOrderRules(levels.filter((l) => l.flow === "order"))
    }
    loadApprovals()
  }, [activeTab, companyId, canManageApprovals, userLoading])

  React.useEffect(() => {
    const loadApprovers = async () => {
      if (userLoading || !companyId || activeTab !== "aprovacoes") return
      const supabase = createClient()
      const [reqRes, orderRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, role, roles")
          .eq("company_id", companyId)
          .overlaps("roles", ["approver_requisition", "admin", "manager"]),
        supabase
          .from("profiles")
          .select("id, full_name, role, roles")
          .eq("company_id", companyId)
          .overlaps("roles", ["approver_order", "admin", "manager"]),
      ])
      setApproversRequisition(((reqRes.data as unknown) as ApproverProfile[]) ?? [])
      setApproversOrder(((orderRes.data as unknown) as ApproverProfile[]) ?? [])
    }
    loadApprovers()
  }, [companyId, activeTab, userLoading])

  React.useEffect(() => {
    const loadTenantCategories = async () => {
      if (userLoading || !companyId || activeTab !== "aprovacoes") return
      const supabase = createClient()
      const [quotRes, suppRes] = await Promise.all([
        supabase.from("quotations").select("category").eq("company_id", companyId),
        supabase.from("suppliers").select("category").eq("company_id", companyId),
      ])
      const set = new Set<string>()
      const addCategory = (v: unknown) => {
        if (typeof v === "string" && v.trim()) set.add(v.trim())
      }
      ;(quotRes.data ?? []).forEach((r: { category?: unknown }) => addCategory(r.category))
      ;(suppRes.data ?? []).forEach((r: { category?: unknown }) => addCategory(r.category))
      const fallback = ["MRO", "Matéria-Prima", "Serviços", "TI", "Outros"]
      const list = set.size > 0 ? Array.from(set).sort() : fallback
      setTenantCategories(list)
    }
    loadTenantCategories()
  }, [companyId, activeTab, userLoading])

  React.useEffect(() => {
    if (userLoading || activeTab !== "campos" || !companyId || !canManageCompany) return
    let cancelled = false
    const supabase = createClient()
    setLoadingConditions(true)
    void supabase
      .from("payment_conditions")
      .select("*")
      .eq("company_id", companyId)
      .order("code", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error(error)
          toast.error("Não foi possível carregar as condições de pagamento.")
          setPaymentConditions([])
        } else {
          setPaymentConditions((data ?? []) as PaymentCondition[])
        }
        setLoadingConditions(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, companyId, canManageCompany, userLoading])

  const handleSaveCondition = async () => {
    if (!conditionForm.code.trim() || !conditionForm.description.trim()) {
      toast.error("Preencha código e descrição.")
      return
    }
    if (!companyId) return
    const supabase = createClient()
    const code = conditionForm.code.trim().toUpperCase()
    const description = conditionForm.description.trim()
    setSavingCondition(true)
    try {
      if (conditionDialog.mode === "create") {
        const { data, error } = await supabase
          .from("payment_conditions")
          .insert({
            company_id: companyId,
            code,
            description,
            active: conditionForm.active,
          })
          .select()
          .single()
        if (error) {
          toast.error("Erro ao salvar: " + error.message)
          return
        }
        setPaymentConditions((prev) =>
          [...prev, data as PaymentCondition].sort((a, b) => a.code.localeCompare(b.code)),
        )
      } else if (conditionDialog.item) {
        const { error } = await supabase
          .from("payment_conditions")
          .update({
            code,
            description,
            active: conditionForm.active,
          })
          .eq("id", conditionDialog.item.id)
        if (error) {
          toast.error("Erro ao salvar: " + error.message)
          return
        }
        setPaymentConditions((prev) =>
          prev
            .map((pc) =>
              pc.id === conditionDialog.item!.id
                ? { ...pc, code, description, active: conditionForm.active }
                : pc,
            )
            .sort((a, b) => a.code.localeCompare(b.code)),
        )
      }
      setConditionDialog((d) => ({ ...d, open: false }))
    } finally {
      setSavingCondition(false)
    }
  }

  const handleConfirmDeleteCondition = async () => {
    const item = deleteConditionDialog.item
    if (!item) return
    setDeletingCondition(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.from("payment_conditions").delete().eq("id", item.id)
      if (error) {
        toast.error("Erro ao excluir: " + error.message)
        return
      }
      setPaymentConditions((prev) => prev.filter((pc) => pc.id !== item.id))
      setDeleteConditionDialog({ open: false, item: null })
      toast.success("Condição removida.")
    } finally {
      setDeletingCondition(false)
    }
  }

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["codigo", "descricao", "ativo", "excluir"],
      ["30D", "30 dias", "sim", "não"],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Condições")
    XLSX.writeFile(wb, "modelo_condicoes_pagamento.xlsx")
  }

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    if (!companyId) {
      toast.error("Empresa não identificada.")
      return
    }

    const normalizeHeader = (v: unknown) =>
      String(v)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()

    const getCol = (row: Record<string, unknown>, keys: string[]) => {
      const found = Object.keys(row).find((k) => keys.includes(normalizeHeader(k)))
      return found ? String(row[found] ?? "").trim() : ""
    }

    const isTruthy = (v: string) =>
      ["sim", "true", "1", "s", "yes"].includes(v.toLowerCase())

    let created = 0
    let deleted = 0
    let errors = 0

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: "array" })
      const ws = wb.Sheets[wb.SheetNames[0] ?? ""]
      if (!ws) {
        toast.error("Planilha inválida.")
        return
      }
      const dataRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })

      if (dataRows.length === 0) {
        toast.error("Arquivo vazio ou sem dados.")
        return
      }

      const supabase = createClient()

      for (const row of dataRows) {
        const code = getCol(row, ["codigo", "code"]).toUpperCase()
        const description = getCol(row, ["descricao", "description"])
        const activeStr = getCol(row, ["ativo", "active"])
        const deleteStr = getCol(row, ["excluir", "delete"])
        const active = activeStr === "" ? true : isTruthy(activeStr)
        const shouldDelete = isTruthy(deleteStr)

        if (!code) {
          errors++
          continue
        }

        if (shouldDelete) {
          const { error } = await supabase
            .from("payment_conditions")
            .delete()
            .eq("company_id", companyId)
            .eq("code", code)
          if (error) errors++
          else deleted++
        } else {
          if (!description) {
            errors++
            continue
          }
          const { error } = await supabase
            .from("payment_conditions")
            .upsert(
              { company_id: companyId, code, description, active },
              { onConflict: "company_id,code" },
            )
          if (error) errors++
          else created++
        }
      }

      const { data } = await supabase
        .from("payment_conditions")
        .select("*")
        .eq("company_id", companyId)
        .order("code", { ascending: true })
      setPaymentConditions((data ?? []) as PaymentCondition[])

      const msg = `Importação concluída: ${created} criados/atualizados, ${deleted} excluídos, ${errors} erros.`
      if (errors === 0) toast.success(msg)
      else toast.warning(msg)
    } catch (err) {
      console.error(err)
      toast.error("Não foi possível ler o arquivo.")
    }
  }

  const handleSaveCompany = async () => {
    if (!companyId) return
    if (!canManageCompany) return
    setSaving((s) => ({ ...s, company: true }))
    setMessages((m) => ({ ...m, company: { success: null, error: null } }))

    const supabase = createClient()
    try {
      await supabase
        .from("companies")
        .update({
          name: companyForm.name.trim(),
          trade_name: companyForm.trade_name.trim(),
          cnpj: companyForm.cnpj ? companyForm.cnpj : null,
          state_reg: companyForm.state_reg.trim() || null,
          address: companyForm.address.trim(),
          city: companyForm.city.trim(),
          state: companyForm.state.trim(),
          zip_code: companyForm.zip_code.trim(),
        })
        .eq("id", companyId)

      await logAudit({
        eventType: "tenant.updated",
        description: `Tenant "${companyForm.name}" atualizado`,
        companyId,
        entity: "companies",
        entityId: companyId,
        metadata: {
          name: companyForm.name,
          state: companyForm.state,
        },
      })

      setMessages((m) => ({ ...m, company: { success: "Alterações salvas com sucesso.", error: null } }))
    } catch (e: any) {
      setMessages((m) => ({ ...m, company: { success: null, error: e?.message ?? "Falha ao salvar." } }))
    } finally {
      setSaving((s) => ({ ...s, company: false }))
    }
  }

  const handleSaveProfile = async () => {
    if (!userId) return
    setSaving((s) => ({ ...s, profile: true }))
    setMessages((m) => ({ ...m, profile: { success: null, error: null } }))

    const supabase = createClient()
    try {
      await supabase
        .from("profiles")
        .update({
          full_name: profileForm.full_name.trim(),
          job_title: profileForm.job_title.trim() || null,
          department: profileForm.department.trim() || null,
          phone: profileForm.phone.trim() || null,
        })
        .eq("id", userId)

      await logAudit({
        eventType: "user.updated",
        description: `Usuário "${profileForm.full_name}" atualizou seu perfil`,
        companyId,
        userId,
        entity: "profiles",
        entityId: userId,
        metadata: { full_name: profileForm.full_name },
      })

      setMessages((m) => ({ ...m, profile: { success: "Perfil atualizado com sucesso.", error: null } }))
    } catch (e: any) {
      setMessages((m) => ({ ...m, profile: { success: null, error: e?.message ?? "Falha ao salvar." } }))
    } finally {
      setSaving((s) => ({ ...s, profile: false }))
    }
  }

  async function handleLogoUpload(file: File) {
    if (!companyId) return
    setLogoUploading(true)

    try {
      const supabase = createClient()
      if (!file.type.startsWith("image/")) {
        toast.error("Arquivo inválido", { description: "Selecione uma imagem." })
        return
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Arquivo muito grande", { description: "Máximo 2MB." })
        return
      }

      const ext = file.name.split(".").pop() || "png"
      const path = `${companyId}/logo.${ext}`

      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from("company-logos").getPublicUrl(path)
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from("companies")
        .update({ logo_url: publicUrl })
        .eq("id", companyId)

      if (updateError) throw updateError

      setCompanyForm((prev) => ({ ...prev, logo_url: publicUrl }))
      toast.success("Logo atualizada com sucesso!")
    } catch {
      toast.error("Erro ao fazer upload")
    } finally {
      setLogoUploading(false)
    }
  }

  async function handleAvatarUpload(file: File) {
    if (!userId) return
    setAvatarUploading(true)

    try {
      const supabase = createClient()
      if (!file.type.startsWith("image/")) {
        toast.error("Arquivo inválido", { description: "Selecione uma imagem." })
        return
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Arquivo muito grande", { description: "Máximo 2MB." })
        return
      }

      const ext = file.name.split(".").pop() || "png"
      const path = `${userId}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from("profile-avatars").getPublicUrl(path)
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId)

      if (updateError) throw updateError

      setProfileForm((prev) => ({ ...prev, avatar_url: publicUrl }))
      toast.success("Foto atualizada com sucesso!")
    } catch {
      toast.error("Erro ao fazer upload")
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSaveNotifications = async () => {
    if (!companyId || !userId) return
    setSaving((s) => ({ ...s, notifications: true }))
    setMessages((m) => ({ ...m, notifications: { success: null, error: null } }))

    const supabase = createClient()
    const legacyFlags = {
      new_requisition:
        notifForm.new_requisition_bell || notifForm.new_requisition_email,
      quotation_received:
        notifForm.quotation_received_bell || notifForm.quotation_received_email,
      order_approved:
        notifForm.order_approved_bell || notifForm.order_approved_email,
      delivery_done:
        notifForm.delivery_done_bell || notifForm.delivery_done_email,
      daily_summary:
        notifForm.daily_summary_bell || notifForm.daily_summary_email,
    }
    const channelPayload = {
      new_requisition_bell: notifForm.new_requisition_bell,
      new_requisition_email: notifForm.new_requisition_email,
      quotation_received_bell: notifForm.quotation_received_bell,
      quotation_received_email: notifForm.quotation_received_email,
      order_accepted_bell: notifForm.order_accepted_bell,
      order_accepted_email: notifForm.order_accepted_email,
      order_refused_bell: notifForm.order_refused_bell,
      order_refused_email: notifForm.order_refused_email,
      order_approved_bell: notifForm.order_approved_bell,
      order_approved_email: notifForm.order_approved_email,
      delivery_done_bell: notifForm.delivery_done_bell,
      delivery_done_email: notifForm.delivery_done_email,
      daily_summary_bell: notifForm.daily_summary_bell,
      daily_summary_email: notifForm.daily_summary_email,
    }
    const preferencesPayload = { ...legacyFlags, ...channelPayload }
    try {
      if (notifExists) {
        await supabase
          .from("notification_preferences")
          .update(preferencesPayload)
          .eq("user_id", userId)
          .eq("company_id", companyId)
      } else {
        await supabase.from("notification_preferences").insert({
          user_id: userId,
          company_id: companyId,
          ...preferencesPayload,
        })
        setNotifExists(true)
      }
      setNotifForm((f) => ({
        ...f,
        ...legacyFlags,
      }))

      setMessages((m) => ({ ...m, notifications: { success: "Preferências salvas.", error: null } }))
    } catch (e: any) {
      setMessages((m) => ({
        ...m,
        notifications: { success: null, error: e?.message ?? "Falha ao salvar." },
      }))
    } finally {
      setSaving((s) => ({ ...s, notifications: false }))
    }
  }

  const handleToggleApprovalFeature = async (
    key: "approval_requisition" | "approval_order",
    enabled: boolean
  ) => {
    if (!companyId) return
    const supabase = createClient()
    try {
      await supabase
        .from("tenant_features")
        .upsert(
          { company_id: companyId, feature_key: key, enabled },
          { onConflict: "company_id,feature_key" }
        )
      if (key === "approval_requisition") setApprovalRequisitionEnabled(enabled)
      else setApprovalOrderEnabled(enabled)
      toast.success(enabled ? "Módulo habilitado." : "Módulo desabilitado.")
    } catch {
      toast.error("Falha ao atualizar.")
    }
  }

  const handleOpenNewRule = () => {
    setEditingRuleId(null)
    setRuleForm({ costCenter: "", useFallback: false, approverId: "" })
    setRuleModalOpen(true)
  }

  const handleOpenEditRule = (rule: ApprovalRule) => {
    setEditingRuleId(rule.id)
    setRuleForm({
      costCenter: rule.cost_center === "*" ? "" : (rule.cost_center ?? ""),
      useFallback: rule.cost_center === "*",
      approverId: rule.approver_id ?? "",
    })
    setRuleModalOpen(true)
  }

  const handleSaveRule = async () => {
    if (!companyId) return
    const costCenterValue = ruleForm.useFallback ? "*" : ruleForm.costCenter.trim()
    if (!costCenterValue) {
      setMessages((m) => ({
        ...m,
        approvals: { success: null, error: "Informe o Centro de Custo ou marque a opção de fallback." },
      }))
      return
    }
    if (!ruleForm.approverId) {
      setMessages((m) => ({
        ...m,
        approvals: { success: null, error: "Selecione um aprovador." },
      }))
      return
    }
    const approver = approversRequisition.find((a) => a.id === ruleForm.approverId)
    const approverName = approver?.full_name ?? null

    const existing = approvalRules.find(
      (r) => r.cost_center === costCenterValue && r.id !== editingRuleId
    )
    if (existing) {
      setMessages((m) => ({
        ...m,
        approvals: { success: null, error: "Já existe uma regra para este Centro de Custo." },
      }))
      return
    }

    setApprovalsSaving(true)
    setMessages((m) => ({ ...m, approvals: { success: null, error: null } }))
    const supabase = createClient()
    try {
      const payload = {
        flow: "requisition" as const,
        cost_center: costCenterValue,
        category: "*" as const,
        min_value: null as number | null,
        max_value: null as number | null,
        approver_id: ruleForm.approverId,
        approver_name: approverName,
      }
      if (editingRuleId) {
        const { data: updateData, error: updateErr } = await supabase
          .from("approval_levels")
          .update(payload)
          .eq("id", editingRuleId)
          .select("id")
        if (updateErr || !updateData?.length) {
          setMessages((m) => ({
            ...m,
            approvals: {
              success: null,
              error: "Erro ao salvar regra. Verifique suas permissões.",
            },
          }))
          return
        }
        setApprovalRules((prev) =>
          prev.map((r) =>
            r.id === editingRuleId ? { ...r, ...payload } : r
          )
        )
        setMessages((m) => ({ ...m, approvals: { success: "Regra atualizada.", error: null } }))
      } else {
        const insertPayload = {
          company_id: companyId,
          flow: payload.flow,
          cost_center: payload.cost_center,
          category: payload.category,
          min_value: payload.min_value,
          max_value: payload.max_value,
          approver_id: payload.approver_id,
          approver_name: payload.approver_name,
          level_order: approvalRules.length + 1,
        }
        const { data: insertData, error: insertErr } = await supabase
          .from("approval_levels")
          .insert(insertPayload)
          .select("id, flow, cost_center, category, min_value, max_value, approver_id, approver_name")
        if (insertErr || !insertData?.length) {
          setMessages((m) => ({
            ...m,
            approvals: {
              success: null,
              error: "Erro ao salvar regra. Verifique suas permissões.",
            },
          }))
          return
        }
        setApprovalRules((prev) => [
          ...prev,
          ...(insertData as unknown as ApprovalRule[]),
        ])
        setMessages((m) => ({ ...m, approvals: { success: "Regra criada.", error: null } }))
      }
      setRuleModalOpen(false)
    } catch (e: unknown) {
      setMessages((m) => ({
        ...m,
        approvals: { success: null, error: (e as { message?: string })?.message ?? "Falha ao salvar." },
      }))
    } finally {
      setApprovalsSaving(false)
    }
  }

  const handleOpenNewOrder = () => {
    setEditingOrderId(null)
    setOrderForm({
      category: "",
      useAllCategories: false,
      minValue: "",
      maxValue: "",
      useNoMax: false,
      approverId: "",
    })
    setOrderModalOpen(true)
  }

  const handleOpenEditOrder = (rule: ApprovalRule) => {
    setEditingOrderId(rule.id)
    setOrderForm({
      category: rule.category === "*" ? "" : (rule.category ?? ""),
      useAllCategories: rule.category === "*",
      minValue: rule.min_value != null ? String(rule.min_value) : "",
      maxValue: rule.max_value != null ? String(rule.max_value) : "",
      useNoMax: rule.max_value == null,
      approverId: rule.approver_id ?? "",
    })
    setOrderModalOpen(true)
  }

  const handleSaveOrder = async () => {
    if (!companyId) return
    const categoryValue = orderForm.useAllCategories ? "*" : orderForm.category.trim()
    if (!categoryValue) {
      setMessages((m) => ({
        ...m,
        approvals: { success: null, error: "Informe a Categoria ou marque a opção Todas." },
      }))
      return
    }
    const minVal = Number(orderForm.minValue)
    if (!Number.isFinite(minVal) || minVal < 0) {
      setMessages((m) => ({
        ...m,
        approvals: { success: null, error: "Informe um valor mínimo válido." },
      }))
      return
    }
    const maxVal = orderForm.useNoMax ? null : (orderForm.maxValue.trim() ? Number(orderForm.maxValue) : null)
    if (maxVal != null && !Number.isFinite(maxVal)) {
      setMessages((m) => ({
        ...m,
        approvals: { success: null, error: "Informe um valor máximo válido." },
      }))
      return
    }
    if (maxVal != null && minVal >= maxVal) {
      setMessages((m) => ({
        ...m,
        approvals: { success: null, error: "O valor mínimo deve ser menor que o máximo." },
      }))
      return
    }
    if (!orderForm.approverId) {
      setMessages((m) => ({
        ...m,
        approvals: { success: null, error: "Selecione um aprovador." },
      }))
      return
    }
    const approver = approversOrder.find((a) => a.id === orderForm.approverId)
    const approverName = approver?.full_name ?? null

    setApprovalsSaving(true)
    setMessages((m) => ({ ...m, approvals: { success: null, error: null } }))
    const supabase = createClient()
    try {
      const payload = {
        flow: "order" as const,
        cost_center: "*" as const,
        category: categoryValue,
        min_value: minVal,
        max_value: maxVal,
        approver_id: orderForm.approverId,
        approver_name: approverName,
      }
      if (editingOrderId) {
        const { data: updateData, error: updateErr } = await supabase
          .from("approval_levels")
          .update(payload)
          .eq("id", editingOrderId)
          .select("id")
        if (updateErr || !updateData?.length) {
          setMessages((m) => ({
            ...m,
            approvals: {
              success: null,
              error: "Erro ao salvar regra. Verifique suas permissões.",
            },
          }))
          return
        }
        setApprovalOrderRules((prev) =>
          prev.map((r) => (r.id === editingOrderId ? { ...r, ...payload } : r))
        )
        setMessages((m) => ({ ...m, approvals: { success: "Alçada atualizada.", error: null } }))
      } else {
        const insertPayload = {
          company_id: companyId,
          flow: payload.flow,
          cost_center: payload.cost_center,
          category: payload.category,
          min_value: payload.min_value,
          max_value: payload.max_value,
          approver_id: payload.approver_id,
          approver_name: payload.approver_name,
          level_order: approvalOrderRules.length + 1,
        }
        const { data: insertData, error: insertErr } = await supabase
          .from("approval_levels")
          .insert(insertPayload)
          .select("id, flow, cost_center, category, min_value, max_value, approver_id, approver_name")
        if (insertErr || !insertData?.length) {
          setMessages((m) => ({
            ...m,
            approvals: {
              success: null,
              error: "Erro ao salvar regra. Verifique suas permissões.",
            },
          }))
          return
        }
        setApprovalOrderRules((prev) => [
          ...prev,
          ...(insertData as unknown as ApprovalRule[]),
        ])
        setMessages((m) => ({ ...m, approvals: { success: "Alçada criada.", error: null } }))
      }
      setOrderModalOpen(false)
    } catch (e: unknown) {
      setMessages((m) => ({
        ...m,
        approvals: { success: null, error: (e as { message?: string })?.message ?? "Falha ao salvar." },
      }))
    } finally {
      setApprovalsSaving(false)
    }
  }

  const handleConfirmDeleteRule = async () => {
    if (!deleteRuleId) return
    setApprovalsSaving(true)
    setMessages((m) => ({ ...m, approvals: { success: null, error: null } }))
    const supabase = createClient()
    try {
      await supabase.from("approval_levels").delete().eq("id", deleteRuleId)
      setApprovalRules((prev) => prev.filter((r) => r.id !== deleteRuleId))
      setApprovalOrderRules((prev) => prev.filter((r) => r.id !== deleteRuleId))
      setMessages((m) => ({ ...m, approvals: { success: "Regra removida.", error: null } }))
    } catch (e: unknown) {
      setMessages((m) => ({
        ...m,
        approvals: { success: null, error: (e as { message?: string })?.message ?? "Falha ao remover." },
      }))
    } finally {
      setApprovalsSaving(false)
      setDeleteRuleId(null)
    }
  }

  async function handleEnableMFA() {
    setMfaSuccess(null)
    setMfaLoading(true)
    setMfaError(null)
    const supabase = createClient()
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Valore 2FA",
    })
    if (error || !data) {
      setMfaError(error?.message ?? "Erro ao iniciar 2FA.")
      setMfaLoading(false)
      return
    }
    const totp = data.totp as { qr_code?: string; secret?: string }
    setMfaQR(totp.qr_code ?? null)
    setMfaSecret(totp.secret ?? null)
    setMfaFactorId(data.id)
    setMfaStep("setup")
    setMfaLoading(false)
  }

  async function handleVerifyMFA() {
    if (!mfaFactorId || mfaCode.length !== 6) return
    setMfaSuccess(null)
    setMfaLoading(true)
    setMfaError(null)
    const supabase = createClient()
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: mfaFactorId,
    })
    if (challengeError || !challengeData) {
      setMfaError(challengeError?.message ?? "Erro ao validar.")
      setMfaLoading(false)
      return
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challengeData.id,
      code: mfaCode,
    })
    if (verifyError) {
      setMfaError("Código inválido. Tente novamente.")
      setMfaLoading(false)
      return
    }
    setMfaEnabled(true)
    setMfaStep("idle")
    setMfaCode("")
    setMfaQR(null)
    setMfaSecret(null)
    setMfaSuccess("2FA ativado com sucesso!")
    setMfaLoading(false)
  }

  async function handleDisableMFA() {
    if (!mfaFactorId) return
    setMfaSuccess(null)
    setMfaLoading(true)
    setMfaError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId })
    if (error) {
      setMfaError(error.message)
      setMfaLoading(false)
      return
    }
    setMfaEnabled(false)
    setMfaFactorId(null)
    setMfaStep("idle")
    setMfaQR(null)
    setMfaSecret(null)
    setMfaCode("")
    setMfaSuccess("2FA desativado.")
    setMfaLoading(false)
  }

  async function handleCancelMfaSetup() {
    if (mfaFactorId) {
      try {
        const supabase = createClient()
        await supabase.auth.mfa.unenroll({ factorId: mfaFactorId })
      } catch {
        // fator pode já ter sido removido
      }
    }
    setMfaStep("idle")
    setMfaCode("")
    setMfaError(null)
    setMfaQR(null)
    setMfaSecret(null)
    setMfaFactorId(null)
    setMfaLoading(false)
  }

  const handleChangePassword = async () => {
    if (!userId) return

    setSecuritySuccess(null)
    setSecurityError(null)

    if (securityForm.newPassword.length < 8) {
      setSecurityError("A nova senha deve ter no mínimo 8 caracteres.")
      return
    }

    if (securityForm.newPassword !== securityForm.confirmNewPassword) {
      setSecurityError("A confirmação da nova senha não confere.")
      return
    }

    setSecuritySaving(true)
    const supabase = createClient()
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData?.user) {
        setSecurityError("Sessão expirada. Faça login novamente.")
        return
      }

      const { error } = await supabase.auth.updateUser({
        password: securityForm.newPassword,
      })

      if (error) {
        setSecurityError(error.message)
        return
      }

      setSecuritySuccess("Senha alterada com sucesso.")
      setSecurityForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" })
    } catch (e: any) {
      setSecurityError(e?.message ?? "Falha ao alterar senha.")
    } finally {
      setSecuritySaving(false)
    }
  }

  const getRoleLabel = (role: string | null, roles?: string[] | null) => {
    const map: Record<string, string> = {
      admin: "Administrador",
      manager: "Gestor",
      approver_requisition: "Aprov. Requisição",
      approver_order: "Aprov. Pedido",
      requester: "Requisitante",
    }
    if (roles && roles.length > 0) {
      return roles.map((r) => map[r] ?? r).join(", ")
    }
    return role ? (map[role] ?? role) : ""
  }

  const formatMoneyBR = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

  const formatOrderRange = (rule: ApprovalRule) => {
    const min = rule.min_value ?? 0
    if (rule.max_value == null) return `Acima de ${formatMoneyBR(min)}`
    return `${formatMoneyBR(min)} — ${formatMoneyBR(rule.max_value)}`
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Carregando...
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações do sistema de compras
        </p>
        {canManageCompany && (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/comprador/configuracoes/permissoes")}
            >
              <Shield className="mr-2 h-4 w-4" />
              Perfis de Acesso
            </Button>
          </div>
        )}
      </div>

      {/* Abas (mesmo padrão visual do detalhe do tenant) */}
      <div className="flex gap-1 border-b border-border mb-4">
        {(
          [
            ["empresa", "Empresa", Building2],
            ["perfil", "Perfil", User],
            ["notificacoes", "Notificações", Bell],
            ["aprovacoes", "Aprovações", Workflow],
            ["seguranca", "Segurança", Shield],
            ["campos", "Configuração de Campos", Settings2],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={[
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
              activeTab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ABA EMPRESA */}
      {activeTab === "empresa" && (
        <div className="grid gap-6">
          {!canManageCompany ? (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Apenas administradores podem editar as informações da empresa.
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Informações da Empresa</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Dados cadastrais da sua organização
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    {companyForm.logo_url ? (
                      <AvatarImage src={companyForm.logo_url} alt="Logo da empresa" />
                    ) : null}
                    <AvatarFallback
                      style={{ backgroundColor: getAvatarColor(companyForm.name || "Empresa") }}
                      className="text-xl"
                    >
                      {getInitials(companyForm.name || "Empresa")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-2">
                    <label className="cursor-pointer">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={logoUploading || !canManageCompany}
                        asChild
                      >
                        <span>
                          {logoUploading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              Alterar Logo
                            </>
                          )}
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={logoUploading || !canManageCompany}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void handleLogoUpload(file)
                          e.target.value = ""
                        }}
                      />
                    </label>
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
                      value={companyForm.name}
                      onChange={(e) =>
                        setCompanyForm((f) => ({ ...f, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                    <Input
                      id="nomeFantasia"
                      value={companyForm.trade_name}
                      onChange={(e) =>
                        setCompanyForm((f) => ({ ...f, trade_name: e.target.value }))
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      value={companyForm.cnpj}
                      onChange={(e) =>
                        setCompanyForm((f) => ({
                          ...f,
                          cnpj: maskCNPJ(e.target.value),
                        }))
                      }
                      disabled={!canManageCompany}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="inscricaoEstadual">
                      Inscrição Estadual
                    </Label>
                    <Input
                      id="inscricaoEstadual"
                      value={companyForm.state_reg}
                      onChange={(e) =>
                        setCompanyForm((f) => ({ ...f, state_reg: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      value={companyForm.address}
                      onChange={(e) =>
                        setCompanyForm((f) => ({ ...f, address: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      value={companyForm.city}
                      onChange={(e) =>
                        setCompanyForm((f) => ({ ...f, city: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 col-span-1">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="estado">Estado</Label>
                      <Input
                        id="estado"
                        value={companyForm.state}
                        onChange={(e) =>
                          setCompanyForm((f) => ({ ...f, state: e.target.value }))
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="cep">CEP</Label>
                      <Input
                        id="cep"
                        value={companyForm.zip_code}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            zip_code: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                {messages.company.error && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {messages.company.error}
                  </div>
                )}
                {messages.company.success && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                    {messages.company.success}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={handleSaveCompany} disabled={saving.company}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving.company ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ABA PERFIL */}
      {activeTab === "perfil" && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Meu Perfil</CardTitle>
              <p className="text-sm text-muted-foreground">
                Informações da sua conta de usuário
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  {profileForm.avatar_url ? (
                    <AvatarImage src={profileForm.avatar_url} alt="Foto de perfil" />
                  ) : null}
                  <AvatarFallback
                    style={{
                      backgroundColor: getAvatarColor(profileForm.full_name || "Usuário"),
                    }}
                    className="text-xl"
                  >
                    {getInitials(profileForm.full_name || "Usuário")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={avatarUploading}
                      asChild
                    >
                      <span>
                        {avatarUploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Alterar Foto
                          </>
                        )}
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={avatarUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void handleAvatarUpload(file)
                        e.target.value = ""
                      }}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    PNG ou JPG. Máximo 2MB.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input
                    id="nome"
                    value={profileForm.full_name}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, full_name: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" value={authEmail ?? ""} disabled />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cargo">Cargo</Label>
                  <Input
                    id="cargo"
                    value={profileForm.job_title}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, job_title: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="departamento">Departamento</Label>
                  <Input
                    id="departamento"
                    value={profileForm.department}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, department: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        phone: formatPhoneBR(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              {messages.profile.error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {messages.profile.error}
                </div>
              )}
              {messages.profile.success && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                  {messages.profile.success}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={saving.profile}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving.profile ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABA NOTIFICAÇÕES */}
      {activeTab === "notificacoes" && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Preferências de Notificação</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure quais notificações deseja receber
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-3 text-left font-medium text-muted-foreground">
                        Notificação
                      </th>
                      <th className="w-24 py-3 text-center font-medium text-muted-foreground">
                        <div className="flex flex-col items-center gap-1">
                          <Bell className="h-4 w-4" />
                          <span>Sininho</span>
                        </div>
                      </th>
                      <th className="w-24 py-3 text-center font-medium text-muted-foreground">
                        <div className="flex flex-col items-center gap-1">
                          <Mail className="h-4 w-4" />
                          <span>E-mail</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {notificationTypes.map((nt) => (
                      <tr key={nt.key} className="border-b border-border last:border-0">
                        <td className="py-4">
                          <p className="font-medium">{nt.label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{nt.description}</p>
                        </td>
                        <td className="py-4 text-center">
                          <Switch
                            checked={notifForm[nt.bellKey] as boolean}
                            onCheckedChange={(v) =>
                              setNotifForm((f) => ({ ...f, [nt.bellKey]: v }))
                            }
                          />
                        </td>
                        <td className="py-4 text-center">
                          <Switch
                            checked={notifForm[nt.emailKey] as boolean}
                            onCheckedChange={(v) =>
                              setNotifForm((f) => ({ ...f, [nt.emailKey]: v }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                * Notificações por e-mail requerem configuração do Resend. As notificações pelo
                sininho estão sempre disponíveis.
              </p>

              {messages.notifications.error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {messages.notifications.error}
                </div>
              )}
              {messages.notifications.success && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                  {messages.notifications.success}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleSaveNotifications} disabled={saving.notifications}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving.notifications ? "Salvando..." : "Salvar Preferências"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABA APROVAÇÕES */}
      {activeTab === "aprovacoes" && (
        <div className="grid gap-6">
          {!canManageApprovals ? (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Apenas administradores podem gerenciar as aprovações.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-3">
                        <ClipboardList className="h-8 w-8 text-muted-foreground shrink-0" />
                        <div>
                          <p className="font-medium">Aprovação de Requisições</p>
                          <p className="text-sm text-muted-foreground">
                            Requisições criadas entrarão em fila de aprovação antes de prosseguir.
                          </p>
                        </div>
                      </div>
                      {hasFeature("approval_requisition") ? (
                        <Switch
                          checked={approvalRequisitionEnabled}
                          onCheckedChange={(v) => handleToggleApprovalFeature("approval_requisition", v)}
                        />
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Switch checked={false} disabled />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Módulo não liberado para este tenant</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-3">
                        <ShoppingCart className="h-8 w-8 text-muted-foreground shrink-0" />
                        <div>
                          <p className="font-medium">Aprovação de Pedidos</p>
                          <p className="text-sm text-muted-foreground">
                            Pedidos gerados precisarão de aprovação conforme alçadas configuradas.
                          </p>
                        </div>
                      </div>
                      {hasFeature("approval_order") ? (
                        <Switch
                          checked={approvalOrderEnabled}
                          onCheckedChange={(v) => handleToggleApprovalFeature("approval_order", v)}
                        />
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Switch checked={false} disabled />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Módulo não liberado para este tenant</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {approvalRequisitionEnabled && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <CardTitle>Regras de Aprovação de Requisição</CardTitle>
                  <Button onClick={handleOpenNewRule} disabled={approvalsSaving}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Regra
                  </Button>
                </CardHeader>
                <CardContent>
                  {approvalRules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                      <ShieldOff className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-sm text-muted-foreground">
                        Nenhuma regra configurada. Requisições serão aprovadas automaticamente.
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Centro de Custo</TableHead>
                          <TableHead>Aprovador</TableHead>
                          <TableHead className="w-24 text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {approvalRules.map((rule) => (
                          <TableRow key={rule.id}>
                            <TableCell>
                              {rule.cost_center === "*" ? (
                                <Badge variant="secondary">Todos (fallback)</Badge>
                              ) : (
                                rule.cost_center ?? "—"
                              )}
                            </TableCell>
                            <TableCell>{rule.approver_name ?? "—"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenEditRule(rule)}
                                  disabled={approvalsSaving}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteRuleId(rule.id)}
                                  disabled={approvalsSaving}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
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
              )}

              {approvalOrderEnabled && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <CardTitle>Regras de Aprovação de Pedido</CardTitle>
                  <Button onClick={handleOpenNewOrder} disabled={approvalsSaving}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Alçada
                  </Button>
                </CardHeader>
                <CardContent>
                  {approvalOrderRules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                      <ShieldOff className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-sm text-muted-foreground">
                        Nenhuma alçada configurada.
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Faixa de Valor</TableHead>
                          <TableHead>Aprovador</TableHead>
                          <TableHead className="w-24 text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {approvalOrderRules.map((rule) => (
                          <TableRow key={rule.id}>
                            <TableCell>
                              {rule.category === "*" ? (
                                <Badge variant="secondary">Todas</Badge>
                              ) : (
                                rule.category ?? "—"
                              )}
                            </TableCell>
                            <TableCell>{formatOrderRange(rule)}</TableCell>
                            <TableCell>{rule.approver_name ?? "—"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenEditOrder(rule)}
                                  disabled={approvalsSaving}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteRuleId(rule.id)}
                                  disabled={approvalsSaving}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
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
              )}

              <Dialog open={ruleModalOpen} onOpenChange={setRuleModalOpen}>
                <DialogContent className="sm:max-w-[480px]">
                  <DialogHeader>
                    <DialogTitle>{editingRuleId ? "Editar Regra" : "Nova Regra"}</DialogTitle>
                    <DialogDescription>
                      Configure o Centro de Custo e o aprovador responsável
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="useFallback"
                        checked={ruleForm.useFallback}
                        onChange={(e) =>
                          setRuleForm((f) => ({
                            ...f,
                            useFallback: e.target.checked,
                            costCenter: e.target.checked ? "" : f.costCenter,
                          }))
                        }
                        className="h-4 w-4 rounded border-border"
                      />
                      <Label htmlFor="useFallback" className="cursor-pointer">
                        Fallback para todos os CCs
                      </Label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="costCenter">Centro de Custo</Label>
                      <Input
                        id="costCenter"
                        value={ruleForm.costCenter}
                        onChange={(e) =>
                          setRuleForm((f) => ({ ...f, costCenter: e.target.value }))
                        }
                        placeholder="Ex: CC-001"
                        disabled={ruleForm.useFallback}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Aprovador</Label>
                      <Select
                        value={ruleForm.approverId || undefined}
                        onValueChange={(v) =>
                          setRuleForm((f) => ({ ...f, approverId: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o aprovador" />
                        </SelectTrigger>
                        <SelectContent>
                          {approversRequisition.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              <span className="flex items-center gap-2">
                                {a.full_name ?? "Sem nome"}
                                {(a.roles?.length ?? a.role) && (
                                  <Badge variant="outline" className="text-xs">
                                    {getRoleLabel(a.role, a.roles)}
                                  </Badge>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter className="mt-4">
                    <Button
                      variant="outline"
                      onClick={() => setRuleModalOpen(false)}
                      disabled={approvalsSaving}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveRule} disabled={approvalsSaving}>
                      {approvalsSaving ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={orderModalOpen} onOpenChange={setOrderModalOpen}>
                <DialogContent className="sm:max-w-[480px]">
                  <DialogHeader>
                    <DialogTitle>{editingOrderId ? "Editar Alçada" : "Nova Alçada"}</DialogTitle>
                    <DialogDescription>
                      Configure categoria, faixa de valor e aprovador
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="useAllCategories"
                        checked={orderForm.useAllCategories}
                        onChange={(e) =>
                          setOrderForm((f) => ({
                            ...f,
                            useAllCategories: e.target.checked,
                            category: e.target.checked ? "" : f.category,
                          }))
                        }
                        className="h-4 w-4 rounded border-border"
                      />
                      <Label htmlFor="useAllCategories" className="cursor-pointer">
                        Todas as categorias
                      </Label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="orderCategory">Categoria</Label>
                      <Select
                        value={orderForm.category || undefined}
                        onValueChange={(v) =>
                          setOrderForm((f) => ({ ...f, category: v }))
                        }
                        disabled={orderForm.useAllCategories}
                      >
                        <SelectTrigger id="orderCategory">
                          <SelectValue placeholder="Ex: Suprimentos" />
                        </SelectTrigger>
                        <SelectContent>
                          {tenantCategories.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4 items-end">
                      <div className="space-y-2">
                        <Label htmlFor="orderMinValue">Valor Mínimo</Label>
                        <Input
                          id="orderMinValue"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={orderForm.minValue}
                          onChange={(e) =>
                            setOrderForm((f) => ({ ...f, minValue: e.target.value }))
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 min-h-[1.25rem]">
                          <Label htmlFor="orderMaxValue">Valor Máximo</Label>
                          <label
                            htmlFor="useNoMax"
                            className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer shrink-0"
                          >
                            <input
                              type="checkbox"
                              id="useNoMax"
                              checked={orderForm.useNoMax}
                              onChange={(e) =>
                                setOrderForm((f) => ({
                                  ...f,
                                  useNoMax: e.target.checked,
                                  maxValue: e.target.checked ? "" : f.maxValue,
                                }))
                              }
                              className="h-3.5 w-3.5 rounded border-border"
                            />
                            Sem limite superior
                          </label>
                        </div>
                        <Input
                          id="orderMaxValue"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={orderForm.maxValue}
                          onChange={(e) =>
                            setOrderForm((f) => ({ ...f, maxValue: e.target.value }))
                          }
                          placeholder="Opcional"
                          disabled={orderForm.useNoMax}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Aprovador</Label>
                      <Select
                        value={orderForm.approverId || undefined}
                        onValueChange={(v) =>
                          setOrderForm((f) => ({ ...f, approverId: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o aprovador" />
                        </SelectTrigger>
                        <SelectContent>
                          {approversOrder.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              <span className="flex items-center gap-2">
                                {a.full_name ?? "Sem nome"}
                                {(a.roles?.length ?? a.role) && (
                                  <Badge variant="outline" className="text-xs">
                                    {getRoleLabel(a.role, a.roles)}
                                  </Badge>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter className="mt-4">
                    <Button
                      variant="outline"
                      onClick={() => setOrderModalOpen(false)}
                      disabled={approvalsSaving}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveOrder} disabled={approvalsSaving}>
                      {approvalsSaving ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <AlertDialog open={!!deleteRuleId} onOpenChange={(open) => !open && setDeleteRuleId(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir regra</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir esta regra de aprovação? Esta ação não pode ser
                      desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={approvalsSaving}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleConfirmDeleteRule}
                      disabled={approvalsSaving}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {approvalsSaving ? "Excluindo..." : "Excluir"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {messages.approvals.error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {messages.approvals.error}
                </div>
              )}
              {messages.approvals.success && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                  {messages.approvals.success}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ABA SEGURANÇA */}
      {activeTab === "seguranca" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <Card>
            <CardHeader>
              <CardTitle>Alterar Senha</CardTitle>
              <p className="text-sm text-muted-foreground">Atualize sua senha de acesso</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="senhaAtual">Senha Atual</Label>
                <Input
                  id="senhaAtual"
                  type="password"
                  value={securityForm.currentPassword}
                  onChange={(e) =>
                    setSecurityForm((f) => ({ ...f, currentPassword: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="novaSenha">Nova Senha</Label>
                <Input
                  id="novaSenha"
                  type="password"
                  value={securityForm.newPassword}
                  onChange={(e) => setSecurityForm((f) => ({ ...f, newPassword: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmarSenha">Confirmar Nova Senha</Label>
                <Input
                  id="confirmarSenha"
                  type="password"
                  value={securityForm.confirmNewPassword}
                  onChange={(e) =>
                    setSecurityForm((f) => ({ ...f, confirmNewPassword: e.target.value }))
                  }
                />
              </div>
              {securityError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {securityError}
                </div>
              )}
              {securitySuccess && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                  {securitySuccess}
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={handleChangePassword} disabled={securitySaving}>
                  {securitySaving ? "Alterando..." : "Alterar Senha"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Autenticação em Dois Fatores</CardTitle>
              <p className="text-sm text-muted-foreground">
                Proteja sua conta com Google Authenticator
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Label>2FA via Aplicativo</Label>
                    <Badge variant={mfaEnabled ? "default" : "outline"}>
                      {mfaEnabled ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {mfaEnabled
                      ? "Sua conta está protegida com autenticação em dois fatores."
                      : "Use Google Authenticator ou similar para gerar códigos."}
                  </span>
                </div>
                <Switch
                  checked={mfaEnabled}
                  disabled={mfaLoading || mfaStep !== "idle"}
                  onCheckedChange={(val) =>
                    val ? void handleEnableMFA() : setMfaStep("disable")
                  }
                />
              </div>

              {mfaStep === "setup" && mfaQR && (
                <div className="flex flex-col gap-3 rounded-lg border p-4">
                  <p className="text-sm font-medium">
                    1. Escaneie o QR Code com seu aplicativo autenticador
                  </p>
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mfaQR} alt="QR Code 2FA" className="w-40 h-40" />
                  </div>
                  {mfaSecret && (
                    <p className="text-xs text-muted-foreground text-center">
                      Chave manual: <span className="font-mono font-medium">{mfaSecret}</span>
                    </p>
                  )}
                  <p className="text-sm font-medium">
                    2. Digite o código gerado pelo aplicativo
                  </p>
                  <Input
                    placeholder="000000"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    className="text-center tracking-widest text-lg"
                  />
                  {mfaError && <p className="text-sm text-destructive">{mfaError}</p>}
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => void handleCancelMfaSetup()}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleVerifyMFA()}
                      disabled={mfaLoading || mfaCode.length !== 6}
                    >
                      {mfaLoading ? "Verificando..." : "Ativar 2FA"}
                    </Button>
                  </div>
                </div>
              )}

              {mfaStep === "disable" && (
                <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <p className="text-sm font-medium text-destructive">
                    Desativar autenticação em dois fatores?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sua conta ficará menos protegida. Esta ação pode ser revertida a qualquer
                    momento.
                  </p>
                  {mfaError && <p className="text-sm text-destructive">{mfaError}</p>}
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => {
                        setMfaStep("idle")
                        setMfaError(null)
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      type="button"
                      onClick={() => void handleDisableMFA()}
                      disabled={mfaLoading}
                    >
                      {mfaLoading ? "Desativando..." : "Confirmar"}
                    </Button>
                  </div>
                </div>
              )}

              {mfaSuccess && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                  {mfaSuccess}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "campos" && (
        <div className="grid gap-6">
          {!canManageCompany ? (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Apenas administradores podem gerenciar a configuração de campos.
            </div>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Condições de Pagamento</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Defina as condições disponíveis para os fornecedores selecionarem.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => {
                        setConditionForm({ code: "", description: "", active: true })
                        setConditionDialog({ open: true, mode: "create", item: null })
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Nova Condição
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => importInputRef.current?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Importar Excel
                    </Button>
                    <input
                      ref={importInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(ev) => void handleImportExcel(ev)}
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={handleDownloadTemplate}>
                      <Download className="mr-2 h-4 w-4" />
                      Modelo
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingConditions ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                ) : paymentConditions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma condição cadastrada. Clique em &quot;Nova Condição&quot; para começar.
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
                      {paymentConditions.map((pc) => (
                        <TableRow key={pc.id}>
                          <TableCell className="font-mono font-medium">{pc.code}</TableCell>
                          <TableCell>{pc.description}</TableCell>
                          <TableCell>
                            <Badge variant={pc.active ? "default" : "secondary"}>
                              {pc.active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setConditionForm({
                                    code: pc.code,
                                    description: pc.description,
                                    active: pc.active,
                                  })
                                  setConditionDialog({ open: true, mode: "edit", item: pc })
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteConditionDialog({ open: true, item: pc })}
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
          )}
        </div>
      )}

      <Dialog
        open={conditionDialog.open}
        onOpenChange={(open) => setConditionDialog((d) => ({ ...d, open }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {conditionDialog.mode === "create"
                ? "Nova Condição de Pagamento"
                : "Editar Condição"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>
                Código <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Ex: 30D, AVISTA, 30-60-90"
                value={conditionForm.code}
                onChange={(e) =>
                  setConditionForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Código para integração com ERP (sem espaços, uppercase)
              </p>
            </div>
            <div className="grid gap-2">
              <Label>
                Descrição <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Ex: 30 dias, À vista, 30/60/90 dias"
                value={conditionForm.description}
                onChange={(e) =>
                  setConditionForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={conditionForm.active}
                onCheckedChange={(v) => setConditionForm((f) => ({ ...f, active: v }))}
              />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConditionDialog((d) => ({ ...d, open: false }))}
            >
              Cancelar
            </Button>
            <Button onClick={() => void handleSaveCondition()} disabled={savingCondition}>
              {savingCondition ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteConditionDialog.open}
        onOpenChange={(open) => !open && setDeleteConditionDialog({ open: false, item: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir condição de pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta condição? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingCondition}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmDeleteCondition()}
              disabled={deletingCondition}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingCondition ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

