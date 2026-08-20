import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { MonitorContent } from "./monitor-content"

export default function AdminIntegracoesMonitorPage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <MonitorContent />
    </Suspense>
  )
}
