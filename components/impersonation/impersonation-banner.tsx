"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { UserCog, X } from "lucide-react"
import { useImpersonation } from "@/contexts/impersonation-context"
import { Button } from "@/components/ui/button"

export function ImpersonationBanner() {
  const router = useRouter()
  const { isImpersonating, session, stopImpersonation } = useImpersonation()

  if (!isImpersonating || !session) return null

  const handleStop = async () => {
    await stopImpersonation()
    toast.success("Modo agir como encerrado.")
    router.push("/comprador/configuracoes?tab=usuarios")
    router.refresh()
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-950">
      <div className="flex items-center gap-2 text-sm">
        <UserCog className="h-4 w-4 shrink-0" />
        <span>
          Você está operando em nome de{" "}
          <strong>{session.impersonatedName ?? "usuário"}</strong>
        </span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 border-amber-400 bg-white hover:bg-amber-100"
        onClick={() => void handleStop()}
      >
        <X className="mr-1.5 h-3.5 w-3.5" />
        Finalizar
      </Button>
    </div>
  )
}
