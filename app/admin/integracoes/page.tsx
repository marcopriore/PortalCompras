import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { IntegracoesContent } from "./integracoes-content"

export const dynamic = 'force-dynamic'

export default function AdminIntegracoesConfigPage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <IntegracoesContent />
    </Suspense>
  )
}
