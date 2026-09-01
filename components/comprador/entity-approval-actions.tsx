"use client"

import * as React from "react"
import { Check, X } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

type ApprovalFlow = "requisition" | "order"

type PendingApproval = {
  id: string
  approver_id: string | null
  status: string
}

type EntityApprovalActionsProps = {
  flow: ApprovalFlow
  entityId: string
  companyId: string | null
  onDecided?: () => void | Promise<void>
}

export function EntityApprovalActions({
  flow,
  entityId,
  companyId,
  onDecided,
}: EntityApprovalActionsProps) {
  const { userId, hasRole, isSuperAdmin } = useUser()
  const { hasPermission } = usePermissions()

  const permissionKey = flow === "requisition" ? "approval.requisition" : "approval.order"
  const hasApprovalPermission = hasPermission(permissionKey)
  const isAdmin = isSuperAdmin || hasRole("admin")

  const [pendingRequest, setPendingRequest] = React.useState<PendingApproval | null>(null)
  const [loadingRequest, setLoadingRequest] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false)
  const [rejectReason, setRejectReason] = React.useState("")
  const [rejectSaving, setRejectSaving] = React.useState(false)

  const loadPending = React.useCallback(async () => {
    if (!companyId || !entityId) {
      setPendingRequest(null)
      setLoadingRequest(false)
      return
    }

    setLoadingRequest(true)
    try {
      const supabase = createClient()
      let query = supabase
        .from("approval_requests")
        .select("id, approver_id, status")
        .eq("company_id", companyId)
        .eq("entity_id", entityId)
        .eq("flow", flow)
        .eq("status", "pending")
        .order("created_at", { ascending: true })

      if (!isAdmin && userId) {
        query = query.eq("approver_id", userId)
      }

      const { data, error } = await query
      if (error) {
        setPendingRequest(null)
        return
      }

      const rows = (data ?? []) as PendingApproval[]
      const match =
        rows.find((row) => isAdmin || row.approver_id === userId) ?? rows[0] ?? null
      setPendingRequest(match)
    } finally {
      setLoadingRequest(false)
    }
  }, [companyId, entityId, flow, isAdmin, userId])

  React.useEffect(() => {
    void loadPending()
  }, [loadPending])

  const canAct =
    hasApprovalPermission &&
    Boolean(pendingRequest) &&
    pendingRequest?.status === "pending" &&
    Boolean(userId) &&
    (isAdmin || pendingRequest?.approver_id === userId)

  const handleApprove = async () => {
    if (!pendingRequest) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/approvals/${pendingRequest.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      })
      const payload = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(payload.error || "Erro ao aprovar. Tente novamente.")
        return
      }

      toast.success(
        flow === "requisition"
          ? "Requisição aprovada com sucesso."
          : "Pedido aprovado com sucesso.",
      )
      window.dispatchEvent(new Event("approval-updated"))
      await loadPending()
      await onDecided?.()
    } catch {
      toast.error("Erro ao aprovar. Tente novamente.")
    } finally {
      setActionLoading(false)
    }
  }

  const handleRejectConfirm = async () => {
    if (!pendingRequest || !rejectReason.trim()) return
    setRejectSaving(true)
    try {
      const res = await fetch(`/api/approvals/${pendingRequest.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejectReason.trim() }),
      })
      const payload = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(payload.error || "Erro ao reprovar. Tente novamente.")
        return
      }

      toast.success(
        flow === "requisition" ? "Requisição reprovada." : "Pedido reprovado.",
      )
      setRejectDialogOpen(false)
      setRejectReason("")
      window.dispatchEvent(new Event("approval-updated"))
      await loadPending()
      await onDecided?.()
    } catch {
      toast.error("Erro ao reprovar. Tente novamente.")
    } finally {
      setRejectSaving(false)
    }
  }

  if (loadingRequest || !canAct || !pendingRequest) {
    return null
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => void handleApprove()}
        disabled={actionLoading || rejectSaving}
      >
        <Check className="mr-2 h-4 w-4" />
        {actionLoading ? "Aprovando..." : "Aprovar"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="text-destructive hover:text-destructive"
        onClick={() => {
          setRejectReason("")
          setRejectDialogOpen(true)
        }}
        disabled={actionLoading || rejectSaving}
      >
        <X className="mr-2 h-4 w-4" />
        Reprovar
      </Button>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo da reprovação</DialogTitle>
            <DialogDescription>
              Informe o motivo da reprovação. Este texto será registrado no histórico.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Descreva o motivo..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false)
                setRejectReason("")
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleRejectConfirm()}
              disabled={!rejectReason.trim() || rejectSaving}
            >
              {rejectSaving ? "Reprovando..." : "Confirmar reprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
