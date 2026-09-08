"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

type SettingsCollapsibleCardProps = {
  title: string
  description?: string
  /** Botões no cabeçalho (fora do trigger, para não colapsar ao clicar). */
  actions?: React.ReactNode
  defaultOpen?: boolean
  className?: string
  children: React.ReactNode
}

/**
 * Card colapsável para seções de Configuração de Campos.
 * Inicia fechado por padrão — a pessoa abre conforme a necessidade.
 */
export function SettingsCollapsibleCard({
  title,
  description,
  actions,
  defaultOpen = false,
  className,
  children,
}: SettingsCollapsibleCardProps) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
          className,
        )}
      >
        <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-start sm:justify-between">
          <CollapsibleTrigger
            type="button"
            className="group flex min-w-0 flex-1 items-start gap-3 rounded-md text-left outline-none transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown
              className={cn(
                "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-180",
              )}
              aria-hidden
            />
            <div className="min-w-0 space-y-1">
              <h3 className="text-base font-semibold leading-none tracking-tight">
                {title}
              </h3>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </CollapsibleTrigger>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2 shrink-0 sm:pl-2">
              {actions}
            </div>
          ) : null}
        </div>
        <CollapsibleContent>
          <div className="border-t border-border px-6 py-4">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
