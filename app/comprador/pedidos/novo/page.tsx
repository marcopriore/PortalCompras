"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { createDraftFromRequisition } from "@/lib/purchase-orders/create-draft-from-requisition"
import { Loader2 } from "lucide-react"

function NovoPedidoRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requisitionId = searchParams.get("requisitionId")
  const { companyId, userId, loading: userLoading } = useUser()

  React.useEffect(() => {
    if (userLoading) return
    if (!requisitionId) {
      router.replace("/comprador/requisicoes")
      return
    }
    if (!companyId || !userId) return

    let alive = true
    const run = async () => {
      const supabase = createClient()
      const result = await createDraftFromRequisition(supabase, {
        companyId,
        userId,
        requisitionId,
      })
      if (!alive) return
      if (!result.ok) {
        toast.error(result.error)
        router.replace(`/comprador/requisicoes/${requisitionId}`)
        return
      }
      if (result.codes && result.codes.length > 1) {
        toast.success(`${result.codes.length} pedidos criados: ${result.codes.join(", ")}`)
        router.replace("/comprador/pedidos")
        return
      }
      router.replace(`/comprador/pedidos/${result.purchaseOrderId}`)
    }

    void run()
    return () => {
      alive = false
    }
  }, [companyId, requisitionId, router, userId, userLoading])

  return (
    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Preparando pedido...
    </div>
  )
}

export default function NovoPedidoPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          Carregando...
        </div>
      }
    >
      <NovoPedidoRedirect />
    </React.Suspense>
  )
}
