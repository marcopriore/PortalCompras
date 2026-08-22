import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

type PageLoadingProps = {
  label?: string
  className?: string
  /** Bloqueia interação com a tela (ex.: navegação ou submit). */
  overlay?: boolean
  /** Altura mínima do bloco centralizado (padrão em páginas). */
  minHeight?: string
}

export function PageLoading({
  label = "Carregando...",
  className,
  overlay = false,
  minHeight = "min-h-[40vh]",
}: PageLoadingProps) {
  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        !overlay && minHeight,
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Spinner className="size-8 text-primary" />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  )

  if (overlay) {
    return (
      <div
        className="fixed inset-0 z-[95] flex cursor-wait items-center justify-center bg-background/50 backdrop-blur-[1px]"
        role="status"
        aria-live="polite"
        aria-busy="true"
        onClick={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="rounded-xl border border-border bg-card px-8 py-6 shadow-lg">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <Spinner className="size-8 text-primary" />
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
          </div>
        </div>
      </div>
    )
  }

  return content
}
